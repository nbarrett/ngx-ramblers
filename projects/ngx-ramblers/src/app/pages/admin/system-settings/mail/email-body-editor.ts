import { Component, Input, OnChanges, OnInit, inject } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { startCase } from "es-toolkit/compat";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { NotificationConfig } from "../../../../models/mail.model";
import { MemberMergeFieldHint, registerExampleValues, registerLinkDestinations } from "../../../../models/email-composer.model";
import { TiptapMarkdownEditor } from "../../../../modules/common/tiptap-editor/tiptap-markdown-editor";
import { SectionToggle, SectionToggleTab } from "../../../../shared/components/section-toggle";
import { MailService } from "../../../../services/mail/mail.service";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { LegacyUrlMappingService } from "../../../../services/legacy-redirect/legacy-url-mapping.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

const APP_URL_TOKEN = "{{params.systemMergeFields.APP_URL}}";
const BODY_CONTENT_PLACEHOLDER = "{{params.messageMergeFields.BODY_CONTENT}}";

function pageLabel(path: string): string {
  const clean = path.replace(/^\//, "").replace(/[-/]/g, " ").trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "Website home";
}

@Component({
  selector: "app-email-body-editor",
  standalone: true,
  imports: [FontAwesomeModule, TiptapMarkdownEditor, SectionToggle, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective],
  template: `
    <div class="col-sm-12 mt-2">
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading">Email content</div>
        @if (isAutomaticallyGenerated) {
          <div class="col-sm-12 mb-2">
            <small class="text-muted">This email's content is generated automatically by the built-in process when it is sent — there is nothing to edit here.</small>
          </div>
        } @else {
          <div class="col-sm-12">
            <app-section-toggle [tabs]="contentSourceTabs"
                                [selectedTab]="isComposerDriven() ? 'composer' : 'written'"
                                (selectedTabChange)="setContentSource($event)"/>
          </div>
          @if (isComposerDriven()) {
            <div class="col-sm-12 mb-2">
              <small class="text-muted">This email's content is written fresh each time it is sent, in the Email
                Composer. There is nothing to edit here - the body is just a placeholder that the composer fills in.</small>
            </div>
          } @else {
            <div class="col-sm-12 mb-2 d-flex justify-content-between align-items-start gap-2">
              <small class="text-muted">Edit the whole email as one document. Insert or change merge fields and
                links from the toolbar, drop in images, and delete anything you don't want.@if (notificationConfig?.templateName) {
                  Reset to default to start again from the centrally maintained wording.}</small>
              @if (notificationConfig?.templateName) {
                <div class="btn-group" dropdown [isDisabled]="busy">
                  <button dropdownToggle type="button" class="btn btn-sm btn-primary dropdown-toggle text-nowrap" [disabled]="busy">
                    <fa-icon [icon]="faRotateLeft"/> Reset to default
                  </button>
                  <ul *dropdownMenu class="dropdown-menu dropdown-menu-end">
                    @for (name of templateNames; track name) {
                      <li><a class="dropdown-item pointer" (click)="resetToTemplate(name)">{{ humanise(name) }}</a></li>
                    }
                  </ul>
                </div>
              }
            </div>
            @if (ready) {
              <div class="col-sm-12">
                <app-tiptap-markdown-editor [value]="notificationConfig.body || ''"
                                            [showMergeFields]="true"
                                            [constrainToEmailWidth]="true"
                                            [stickyToolbar]="true"
                                            [extraLinkDestinations]="internalPageDestinations"
                                            placeholder="Write the email content…"
                                            (valueChange)="onBodyChange($event)"/>
              </div>
            }
          }
        }
      </div>
    </div>`
})
export class EmailBodyEditorComponent implements OnInit, OnChanges {
  @Input() notificationConfig: NotificationConfig;
  @Input() isBuiltInProcess = false;
  private mailService = inject(MailService);
  private mailMessagingService = inject(MailMessagingService);
  private legacyUrlMappingService = inject(LegacyUrlMappingService);
  private logger: Logger = inject(LoggerFactory).createLogger("EmailBodyEditor", NgxLoggerLevel.ERROR);
  protected ready = false;
  protected busy = false;
  protected internalPageDestinations: MemberMergeFieldHint[] = [];
  protected readonly faRotateLeft = faRotateLeft;
  protected readonly contentSourceTabs: SectionToggleTab[] = [
    {value: "written", label: "Written here"},
    {value: "composer", label: "Composed in Email Composer"}
  ];
  private loadedForTemplate: string | null = null;
  private stashedWrittenBody: string | null = null;
  protected templateNames: string[] = [];
  protected isAutomaticallyGenerated = false;

  ngOnInit(): void {
    this.loadInternalPages();
    this.registerExampleParams();
    this.loadTemplateNames();
  }

  private async loadTemplateNames(): Promise<void> {
    try {
      this.templateNames = await this.mailService.queryLocalTemplateNames();
    } catch (error) {
      this.logger.error("failed to load template names", error);
    }
  }

  protected humanise(templateName: string): string {
    return startCase(templateName);
  }

  async resetToTemplate(templateName: string): Promise<void> {
    this.busy = true;
    this.ready = false;
    try {
      const response = await this.mailService.editableBody({templateName});
      this.notificationConfig.body = response.body;
    } catch (error) {
      this.logger.error("failed to reset to template", templateName, error);
    } finally {
      this.busy = false;
      this.ready = true;
    }
  }

  private registerExampleParams(): void {
    try {
      registerExampleValues(this.mailMessagingService.exampleEmailParams());
    } catch (error) {
      this.logger.error("failed to register example merge values", error);
    }
  }

  ngOnChanges(): void {
    this.ensureBody();
  }

  isComposerDriven(): boolean {
    return (this.notificationConfig?.body || "").trim() === BODY_CONTENT_PLACEHOLDER;
  }

  setContentSource(value: string): void {
    this.setComposerDriven(value === "composer");
  }

  private setComposerDriven(composer: boolean): void {
    if (!this.notificationConfig || composer === this.isComposerDriven()) {
      return;
    }
    if (composer) {
      this.stashedWrittenBody = this.notificationConfig.body || "";
      this.notificationConfig.body = BODY_CONTENT_PLACEHOLDER;
    } else {
      this.notificationConfig.body = this.stashedWrittenBody ?? "";
      this.stashedWrittenBody = null;
      this.ready = true;
    }
  }

  private async loadInternalPages(): Promise<void> {
    try {
      const targets = await this.legacyUrlMappingService.targetUrls();
      const byToken = new Map<string, MemberMergeFieldHint>();
      (targets || [])
        .filter(target => target.source === "page")
        .map(target => (target.path || "").replace(/^\//, "").split("#")[0])
        .filter(path => /^[a-z0-9][a-z0-9/-]*$/.test(path))
        .forEach(path => {
          const token = `${APP_URL_TOKEN}/${path}`;
          if (!byToken.has(token)) {
            byToken.set(token, {token, label: pageLabel(path)});
          }
        });
      this.internalPageDestinations = [...byToken.values()].sort((left, right) => left.label.localeCompare(right.label));
      registerLinkDestinations(this.internalPageDestinations);
    } catch (error) {
      this.logger.error("failed to load internal page destinations", error);
    }
  }

  private async ensureBody(): Promise<void> {
    if (!this.notificationConfig) {
      this.ready = false;
      return;
    }
    if (this.notificationConfig.templateName) {
      if (this.loadedForTemplate !== this.notificationConfig.templateName) {
        this.loadedForTemplate = this.notificationConfig.templateName;
        await this.loadBody(this.notificationConfig.templateOverrides);
      }
    } else {
      this.isAutomaticallyGenerated = false;
      if (this.notificationConfig.body == null) {
        this.notificationConfig.body = "";
      }
    }
    this.ready = true;
  }

  private isPlaceholderOrEmpty(body: string): boolean {
    return (body || "").split(BODY_CONTENT_PLACEHOLDER).join("").trim() === "";
  }

  private async loadBody(overrides?: NotificationConfig["templateOverrides"]): Promise<void> {
    this.busy = true;
    try {
      const response = await this.mailService.editableBody({templateName: this.notificationConfig.templateName, templateOverrides: overrides});
      this.isAutomaticallyGenerated = this.isBuiltInProcess && this.isPlaceholderOrEmpty(response.body);
      if (!this.isAutomaticallyGenerated && this.notificationConfig.body == null) {
        this.notificationConfig.body = response.body;
      }
    } catch (error) {
      this.logger.error("failed to load editable body", error);
    } finally {
      this.busy = false;
    }
  }

  onBodyChange(value: string): void {
    this.notificationConfig.body = value;
  }
}
