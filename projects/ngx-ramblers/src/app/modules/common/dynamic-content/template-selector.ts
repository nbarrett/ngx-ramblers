import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faAdd, faClone, faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { ContentTemplateType, PageContent, USER_TEMPLATES_PATH_PREFIX } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentService } from "../../../services/page-content.service";
import { UrlService } from "../../../services/url.service";
import { BadgeButtonComponent } from "../badge-button/badge-button";

export interface TemplateSelectEvent {
  template: PageContent;
  replace: boolean;
}

@Component({
  selector: "app-template-selector",
  template: `
    <div class="d-flex gap-2 flex-wrap align-items-end">
      <div class="flex-grow-1">
        <label class="form-label-sm" for="template-library-select">{{ label }}</label>
        <select class="form-select form-select-sm" id="template-library-select"
                [(ngModel)]="selectedTemplateFragmentId"
                (ngModelChange)="onSelectionChange()">
          <option value="">Select a template…</option>
          @for (fragment of templateFragments; track fragment.id) {
            <option [ngValue]="fragment.id">{{ templateFragmentLabel(fragment) }}</option>
          }
        </select>
      </div>
      <app-badge-button
        [icon]="faExternalLinkAlt"
        caption="View"
        [disabled]="!selectedTemplateFragmentId"
        (click)="openSelectedTemplate()"/>
      @if (showActionButtons) {
        <app-badge-button
          [icon]="faClone"
          caption="Replace"
          [tooltip]="'Replace content with template'"
          [disabled]="!selectedTemplateFragmentId"
          (click)="selectTemplate(true)"/>
        <app-badge-button
          [icon]="faAdd"
          caption="Append"
          [tooltip]="'Append template to content'"
          [disabled]="!selectedTemplateFragmentId"
          (click)="selectTemplate(false)"/>
      }
    </div>
    @if (templateFragmentsLoading) {
      <div class="small text-muted mt-2">Loading templates…</div>
    } @else if (!templateFragments?.length) {
      <div class="small text-muted mt-2">No templates published yet.</div>
    }
  `,
  imports: [FormsModule, FontAwesomeModule, BadgeButtonComponent],
  standalone: true
})
export class TemplateSelectorComponent implements OnInit {

  @Input() showActionButtons = true;
  @Input() label = "Select template";
  @Output() templateSelected = new EventEmitter<TemplateSelectEvent>();
  @Output() selectionChanged = new EventEmitter<PageContent | null>();

  protected faClone = faClone;
  protected faAdd = faAdd;
  protected faExternalLinkAlt = faExternalLinkAlt;

  private logger: Logger = inject(LoggerFactory).createLogger("TemplateSelectorComponent", NgxLoggerLevel.ERROR);
  private pageContentService: PageContentService = inject(PageContentService);
  private urlService: UrlService = inject(UrlService);

  public templateFragments: PageContent[] = [];
  public templateFragmentsLoading = false;
  public selectedTemplateFragmentId = "";

  ngOnInit() {
    this.refresh();
  }

  async refresh(showSpinner = true) {
    if (showSpinner) {
      this.templateFragmentsLoading = true;
    }
    try {
      const allContent = await this.pageContentService.all();
      const fragments = allContent.filter(p => this.normalisePath(p.path || "").startsWith("fragments/"));
      this.templateFragments = fragments.filter(fragment => this.fragmentIsTemplate(fragment));
      this.logger.info("refresh: found", this.templateFragments.length, "templates from", fragments.length, "fragments");
      if (!this.templateFragments.length) {
        this.selectedTemplateFragmentId = "";
      } else if (!this.selectedTemplateFragmentId || !this.templateFragments.some(fragment => fragment.id === this.selectedTemplateFragmentId)) {
        this.selectedTemplateFragmentId = this.templateFragments[0].id;
      }
      this.onSelectionChange();
    } catch (error) {
      this.logger.error("Failed to load template fragments:", error);
    } finally {
      if (showSpinner) {
        this.templateFragmentsLoading = false;
      }
    }
  }

  private normalisePath(path: string): string {
    return this.urlService.reformatLocalHref(path || "").replace(/^\/+/, "");
  }

  templateFragmentLabel(fragment: PageContent): string {
    const raw = fragment?.path || "Unknown";
    const normalised = this.normalisePath(raw);
    if (normalised.startsWith(USER_TEMPLATES_PATH_PREFIX)) {
      return normalised.replace(USER_TEMPLATES_PATH_PREFIX, "");
    }
    if (normalised.startsWith("fragments/")) {
      return normalised.replace("fragments/", "");
    }
    return normalised;
  }

  private fragmentIsTemplate(fragment: PageContent): boolean {
    return this.fragmentTemplateType(fragment) === ContentTemplateType.USER_TEMPLATE;
  }

  private fragmentTemplateType(fragment: PageContent): ContentTemplateType | "" {
    if (!fragment) {
      return "";
    }
    const templateType = fragment.migrationTemplate?.templateType;
    if (templateType) {
      return templateType;
    }
    if (fragment.migrationTemplate?.isTemplate) {
      return ContentTemplateType.MIGRATION_TEMPLATE;
    }
    const normalised = this.normalisePath(fragment.path || "");
    if (normalised.startsWith(USER_TEMPLATES_PATH_PREFIX)) {
      return ContentTemplateType.USER_TEMPLATE;
    }
    return "";
  }

  onSelectionChange() {
    this.selectionChanged.emit(this.selectedTemplate());
  }

  async selectTemplate(replace: boolean) {
    const template = this.selectedTemplate();
    if (!template) {
      this.logger.error("No template selected");
      return;
    }
    this.templateSelected.emit({template, replace});
  }

  selectedTemplate(): PageContent | null {
    if (!this.selectedTemplateFragmentId) {
      return null;
    }
    return this.templateFragments.find(f => f.id === this.selectedTemplateFragmentId) || null;
  }

  openSelectedTemplate(): void {
    const template = this.selectedTemplate();
    if (!template?.path) {
      return;
    }
    const href = this.urlService.pageUrl(template.path);
    window.open(href, "_blank");
  }
}
