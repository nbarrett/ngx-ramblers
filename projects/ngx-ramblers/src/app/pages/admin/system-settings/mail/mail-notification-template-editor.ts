import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import {
  MailMessagingConfig,
  MailSettingsTab,
  MemberSelection,
  NotificationConfig,
  SendSmtpEmailParams,
  TemplateDiffResponse,
  WorkflowAction
} from "../../../../models/mail.model";
import { MailLinkService } from "../../../../services/mail/mail-link.service";
import { MailService } from "../../../../services/mail/mail.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { BannerConfig } from "../../../../models/banner-configuration.model";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { UrlService } from "../../../../services/url.service";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { extractParametersFrom } from "../../../../common/mail-parameters";
import { enumKeyValues, KEY_NULL_VALUE_NONE, KeyValue } from "../../../../functions/enums";
import { last } from "es-toolkit/compat";
import { Subscription } from "rxjs";
import { faAdd, faBackward, faCopy, faEraser, faForward, faUpload, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { cloneDeep } from "es-toolkit/compat";
import { first } from "es-toolkit/compat";
import { FormsModule } from "@angular/forms";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";
import { BrevoDropdownItem } from "../../../../models/brevo-dropdown.model";
import { SenderRepliesAndSignoffComponent } from "../../send-emails/sender-replies-and-signoff";
import { ForgotPasswordNotificationDetailsComponent } from "../../../../notifications/admin/templates/forgot-password-notification-details";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

@Component({
    selector: "app-mail-notification-template-mapping-editor",
    template: `
    @if (mailMessagingConfig) {
      <div class="row thumbnail-heading-frame">
        <div class="thumbnail-heading-with-select">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <label for="template-mapping">Email Configuration
              {{ mailMessagingConfig.notificationConfigs.indexOf(notificationConfig) + 1 }}
            of {{ mailMessagingConfig.notificationConfigs.length }}: </label>
            <select [(ngModel)]="notificationConfig"
              (ngModelChange)="select(notificationConfig)"
              id="template-mapping"
              class="form-control input-sm"
              style="width: auto; max-width: 300px;">
              @for (mapping of mailMessagingConfig.notificationConfigs; track mapping.subject.text) {
                <option
                  [ngValue]="mapping">{{ mapping?.subject?.text || '(no subject)' }}
                </option>
              }
            </select>
          </div>
        </div>
        <div class="col-sm-12 mt-2 mb-2">
          <app-markdown-editor standalone category="admin" name="mail-settings-email-configurations-help"
          description="Mail Settings Email Configuration Help"/>
        </div>
        <div class="col-sm-12">
          <div class="row">
            <div class="col pe-1">
              <app-badge-button fullWidth [icon]="faBackward" caption="Previous" (click)="previousConfig()"
                [disabled]="previousConfigDisabled()"/>
            </div>
            <div class="col pe-1">
              <app-badge-button fullWidth [icon]="faForward" caption="Next" (click)="nextConfig()"
                [disabled]="nextConfigDisabled()"/>
            </div>
            <div class="col pe-1">
              <app-badge-button fullWidth [icon]="faCopy" caption="Duplicate" (click)="duplicateConfig()"/>
            </div>
            <div class="col">
              <app-badge-button fullWidth [icon]="faAdd" caption="Add New" (click)="addNewConfig()"/>
            </div>
            <div class="col pe-1">
              <app-badge-button fullWidth [icon]="faEraser" caption="Delete" (click)="deleteConfig()"/>
            </div>
          </div>
        </div>
        @if (notificationConfig) {
          <div>
            <div class="row thumbnail-heading-frame">
              <div class="thumbnail-heading">Notification Settings</div>
              @if (notificationConfig?.subject) {
                <div class="col-sm-12">
                  <div class="row">
                    <div class="col">
                      <div class="form-group">
                        <label for="prefix-parameter">Subject Prefix</label>
                        <select [(ngModel)]="notificationConfig.subject.prefixParameter"
                          id="{{heading | kebabCase}-prefix-parameter"
                          class="form-control input-sm flex-grow-1 me-2">
                          @for (keyValue of parametersFrom; track keyValue.key) {
                            <option
                              [ngValue]="keyValue.key">{{ formatKeyValue(keyValue) }}
                            </option>
                          }
                        </select>
                      </div>
                    </div>
                    <div class="col">
                      <div class="form-group flex-grow-1">
                        <label for="title">Subject Text</label>
                        <input [(ngModel)]="notificationConfig.subject.text"
                          type="text" id="title"
                          class="form-control input-sm">
                      </div>
                    </div>
                    <div class="col">
                      <div class="form-group">
                        <label for="suffix-parameter">Subject Suffix</label>
                        <select [(ngModel)]="notificationConfig.subject.suffixParameter"
                          id="suffix-parameter"
                          class="form-control input-sm flex-grow-1 me-2">
                          @for (keyValue of parametersFrom; track keyValue.key) {
                            <option
                              [ngValue]="keyValue.key">{{ formatKeyValue(keyValue) }}
                            </option>
                          }
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              }
              <ng-container>
                <div class="col-sm-12">
                  <div class="form-group">
                    <label for="banner-lookup">Banner Image</label>
                    <select class="form-control input-sm"
                      id="banner-lookup"
                      [(ngModel)]="notificationConfig.bannerId" (ngModelChange)="bannerSelected($event)">
                      @for (banner of mailMessagingConfig.banners; track banner.id) {
                        <option
                          [ngValue]="banner.id">{{ toBannerInformation(banner) }}
                        </option>
                      }
                    </select>
                  </div>
                </div>
                @if (notificationConfig?.bannerId) {
                  <div class="col-sm-12 mb-2">
                    <img class="card-img"
                      [src]="mailMessagingService.bannerImageSource(notificationConfig, false)">
                  </div>
                }
              </ng-container>
              <div class="col-sm-12">
                <app-sender-replies-and-sign-off [mailMessagingConfig]="mailMessagingConfig"
                  [notificationConfig]="notificationConfig"/>
              </div>
              <div class="col-sm-12">
                <div class="form-group">
                  <label for="template">Brevo Template</label>
                  <div class="d-flex align-items-center gap-2">
                    <select [(ngModel)]="notificationConfig.templateId"
                      (ngModelChange)="templateChanged()"
                      id="template"
                      class="form-control input-sm">
                      @for (template of mailMessagingConfig?.brevo?.mailTemplates?.templates; track template.id) {
                        <option
                          [ngValue]="template.id">{{ template.name }}
                        </option>
                      }
                    </select>
                    <app-brevo-button button title="Template"
                      [disabled]="notReady()"
                      [dropdownItems]="templateDropdownItems"
                      (dropdownSelected)="handleTemplateDropdown($event)"/>
                    <app-brevo-button button title="Push Default Template"
                      [disabled]="notReady() || !localTemplateAvailable()"
                      (click)="pushDefaultTemplate()"/>
                  </div>
                  <div class="mt-1">
                    @if (templateDiffLoading) {
                      <span class="badge bg-secondary">
                        <fa-icon [icon]="faSpinner" [spin]="true"/>
                        <span class="ms-1">Checking...</span>
                      </span>
                    }
                    @if (!templateDiffLoading && templateDiffStatus) {
                      <span class="badge" [class.bg-success]="templateDiffStatus.matchesLocal"
                        [class.bg-warning]="!templateDiffStatus.matchesLocal && templateDiffStatus.hasLocalTemplate"
                        [class.bg-secondary]="!templateDiffStatus.hasLocalTemplate">{{ templateDiffLabel() }}</span>
                    }
                  </div>
                </div>
              </div>
            </div>
            <div class="thumbnail-heading-frame">
              <div class="thumbnail-heading">Member Selection And Actions</div>
              @if (mailMessagingService.workflowIdsFor(mailMessagingConfig?.mailConfig)?.includes(notificationConfig.id)) {
                <div class="row"
                  >
                  <div class="col-sm-12">
                    <div class="form-group">
                      <label>Member Selected automatically via built-in workflow on <a (click)="tabSelected.emit(MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS)">{{ MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS }}</a> tab</label>
                    </div>
                  </div>
                </div>
              }
              @if (!mailMessagingService.workflowIdsFor(mailMessagingConfig?.mailConfig)?.includes(notificationConfig.id)) {
                <div class="row">
                  <div class="col-sm-6">
                    <div class="form-group">
                      <label for="member-selection">Member Selection</label>
                      <select class="form-control input-sm"
                        [(ngModel)]="notificationConfig.defaultMemberSelection"
                        id="member-selection">
                        @for (type of memberSelections; track type.key) {
                          <option
                            [ngValue]="type.value">{{ stringUtils.asTitle(type.value) }}
                          </option>
                        }
                      </select>
                    </div>
                  </div>
                  <div class="col-sm-6">
                    @if (notificationConfig.defaultMemberSelection!==MemberSelection.MAILING_LIST) {
                      <div
                        class="form-group">
                        <label for="campaign-months-in-past-filter">Months In Past</label>
                        <input [(ngModel)]="notificationConfig.monthsInPast"
                          type="number" id="campaign-months-in-past-filter"
                          class="form-control input-sm">
                      </div>
                    }
                    @if (notificationConfig.defaultMemberSelection===MemberSelection.MAILING_LIST) {
                      <div
                        class="form-group">
                        <label for="default-list">
                        Default List</label>
                        <select [compareWith]="arrayComparer" class="form-control input-sm"
                          [(ngModel)]="notificationConfig.defaultListId"
                          id="default-list">
                          @for (list of mailMessagingConfig.brevo.lists.lists; track list.id) {
                            <option
                              [ngValue]="list.id">{{ list.name }}
                            </option>
                          }
                        </select>
                      </div>
                    }
                  </div>
                </div>
                @if (notificationConfig.defaultMemberSelection!==MemberSelection.MAILING_LIST) {
                  <div class="row">
                    <div class="col-sm-6">
                      <div class="form-group">
                        <label for="member-selection">
                        Pre-Send Action</label>
                        <select [compareWith]="arrayComparer" class="form-control input-sm"
                          [(ngModel)]="notificationConfig.preSendActions"
                          id="member-selection">
                          @for (type of workflowActions; track type.key) {
                            <option
                              [ngValue]="keyValueAsArray(type)">{{ stringUtils.asTitle(type.value) }}
                            </option>
                          }
                        </select>
                      </div>
                    </div>
                    <div class="col-sm-6">
                      <div class="form-group">
                        <label for="member-selection">
                        Post-Send Action</label>
                        <select [compareWith]="arrayComparer" class="form-control input-sm"
                          [(ngModel)]="notificationConfig.postSendActions"
                          id="member-selection">
                          @for (type of workflowActions; track type.key) {
                            <option
                              [ngValue]="keyValueAsArray(type)">{{ stringUtils.asTitle(type.value) }}
                            </option>
                          }
                        </select>
                      </div>
                    </div>
                  </div>
                }
              }
              @if (notificationConfig?.contentPreset) {
                <div class="row">
                  <div class="col-sm-12">
                    <div class="form-group">
                      <app-forgot-password-notification-details [params]="params"
                        [notificationConfig]="notificationConfig"/>
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
    `,
    styles: [],
    imports: [FormsModule, MarkdownEditorComponent, BadgeButtonComponent, BrevoButtonComponent, SenderRepliesAndSignoffComponent, ForgotPasswordNotificationDetailsComponent, FontAwesomeModule]
})

export class MailNotificationTemplateMappingComponent implements OnInit, OnDestroy {

  @Input("notificationConfig") set notificationConfigValue(notificationConfig: NotificationConfig) {
    this.notificationConfig = notificationConfig;
    this.logger.info("initialised with notificationConfig:", this.notificationConfig);
    if (this.notificationConfig) {
      this.mailMessagingService.initialiseSubject(this.notificationConfig);
    }
  }

  memberSelections: KeyValue<string>[] = [KEY_NULL_VALUE_NONE].concat(enumKeyValues(MemberSelection));
  workflowActions: KeyValue<string>[] = [KEY_NULL_VALUE_NONE].concat(enumKeyValues(WorkflowAction));
  private loggerFactory: LoggerFactory = inject(LoggerFactory);
  private subscriptions: Subscription[] = [];
  @Output() configDeleted: EventEmitter<string> = new EventEmitter();
  @Output() tabSelected: EventEmitter<MailSettingsTab> = new EventEmitter();
  private logger: Logger = this.loggerFactory.createLogger("MailNotificationTemplateMappingComponent", NgxLoggerLevel.ERROR);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public mailLinkService: MailLinkService = inject(MailLinkService);
  public mailService: MailService = inject(MailService);
  public urlService: UrlService = inject(UrlService);
  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  public templateDropdownItems: BrevoDropdownItem[] = [
    {id: "edit-rich-text", label: "Edit Rich Text"},
    {id: "view-template", label: "View Template"}
  ];
  public mailMessagingConfig: MailMessagingConfig;
  public parametersFrom: KeyValue<any>[] = [];
  public params: SendSmtpEmailParams;
  public notificationConfig!: NotificationConfig;
  public templateDiffStatus: TemplateDiffResponse;
  public templateDiffLoading = false;

  protected readonly faAdd = faAdd;
  protected readonly faEraser = faEraser;
  protected readonly faCopy = faCopy;
  protected readonly first = first;
  protected readonly faForward = faForward;
  protected readonly faBackward = faBackward;
  protected readonly faUpload = faUpload;
  protected readonly faSpinner = faSpinner;

  protected readonly MemberSelection = MemberSelection;

  protected readonly MailSettingsTab = MailSettingsTab;

  async ngOnInit() {
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.params = this.mailMessagingService.exampleEmailParams();
      this.notificationConfig = first(mailMessagingConfig.notificationConfigs);
      const parameters: KeyValue<any>[] = extractParametersFrom(this.params, false);
      const parametersAndValues: KeyValue<any>[] = extractParametersFrom(this.params, true);
      this.logger.debug("parameters:raw:", parameters, "parameters:wrapped:", parametersAndValues);
      this.parametersFrom = [{
        key: null,
        value: "(none)"
      }].concat(parameters.filter(item => !item.key.includes("subject")));
      this.refreshTemplateDiff();
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  arrayComparer(item1: string[], item2: string[]): boolean {
    return JSON.stringify(item1) === JSON.stringify(item2);
  }

  subject(): string {
    return this.notificationConfig?.subject?.text || "(no subject)";
  }

  toBannerInformation(bannerConfig: BannerConfig) {
    return `${bannerConfig.name || "Unnamed"} (${this.stringUtils.asTitle(bannerConfig.bannerType)})`;
  }

  notReady() {
    return !this.notificationConfig?.templateId;
  }

  bannerSelected(selectedBanner: BannerConfig) {
    this.logger.info("selectedBanner:", selectedBanner);
  }

  formatKeyValue(keyValue: KeyValue<any>) {
    const key: string = keyValue.key ? this.stringUtils.asTitle(last(keyValue.key.split("."))) + ": " : "";
    return key + (keyValue.value || "");
  }

  deleteConfig() {
    if (this.notificationConfig.id) {
      this.configDeleted.emit(this.notificationConfig.id);
    }
    this.removeFromNotificationConfigs(this.notificationConfig);
    this.notificationConfig = first(this.mailMessagingConfig.notificationConfigs);
  }

  duplicateConfig() {
    const clone = cloneDeep(this.notificationConfig);
    delete clone.id;
    clone.subject.text = `Copy of ${clone.subject.text}`;
    this.addToNotificationConfigs(clone);
    this.notificationConfig = clone;
  }

  private addToNotificationConfigs(notificationConfig: NotificationConfig) {
    this.mailMessagingConfig.notificationConfigs.push(notificationConfig);
    this.logger.info("adding:", notificationConfig, "notificationConfigs:", this.mailMessagingConfig.notificationConfigs);
  }

  private removeFromNotificationConfigs(notificationConfig: NotificationConfig) {
    this.mailMessagingConfig.notificationConfigs = this.mailMessagingConfig.notificationConfigs.filter(item => item !== notificationConfig);
    this.logger.info("removing:", notificationConfig, this.mailMessagingConfig.notificationConfigs);
  }

  addNewConfig() {
    this.notificationConfig = {
      subject: {
        prefixParameter: null,
        text: null,
        suffixParameter: null
      },
      preSendActions: [],
      postSendActions: [],
      defaultMemberSelection: null,
      contentPreset: null,
      templateId: null,
      monthsInPast: 2,
      bannerId: null,
      senderRole: "membership",
      replyToRole: "membership",
      signOffRoles: ["membership"],
    };
    this.mailMessagingConfig.notificationConfigs.push(this.notificationConfig);
  }

  keyValueAsArray(input: KeyValue<string>) {
    const value = input.key ? [input.value] : [];
    this.logger.off("keyValueAsArray:input:", input, "value:", value);
    return value;
  }

  nextConfig() {
    if (!this.nextConfigDisabled()) {
      this.select(this.mailMessagingConfig.notificationConfigs[this.mailMessagingConfig.notificationConfigs.indexOf(this.notificationConfig) + 1]);
    }
  }

  previousConfig() {
    if (!this.previousConfigDisabled()) {
      this.select(this.mailMessagingConfig.notificationConfigs[this.mailMessagingConfig.notificationConfigs.indexOf(this.notificationConfig) - 1]);
    }
  }

  public select(notificationConfig: NotificationConfig) {
    this.notificationConfig = notificationConfig;
    this.mailMessagingService.initialiseSubject(this.notificationConfig);
    this.logger.info("selected notificationConfig:", this.notificationConfig);
    this.refreshTemplateDiff();
  }

  handleTemplateDropdown(item: BrevoDropdownItem) {
    if (!this.notificationConfig?.templateId) {
      return;
    }
    if (item.id === "edit-rich-text") {
      this.mailLinkService.editTemplateRichTextWithNotifications(this.notificationConfig.templateId, this.notReady(), this.mailMessagingConfig);
    } else if (item.id === "view-template") {
      this.mailLinkService.editTemplateWithNotifications(this.notificationConfig.templateId, this.notReady(), this.mailMessagingConfig);
    }
  }

  nextConfigDisabled() {
    return this.mailMessagingConfig.notificationConfigs.indexOf(this.notificationConfig) === this.mailMessagingConfig.notificationConfigs.length - 1;
  }

  previousConfigDisabled() {
    return this.mailMessagingConfig.notificationConfigs.indexOf(this.notificationConfig) === 0;
  }

  selectedTemplateName(): string {
    const template = this.mailMessagingConfig?.brevo?.mailTemplates?.templates?.find(t => t.id === this.notificationConfig?.templateId);
    return template?.name || null;
  }

  templateChanged() {
    this.templateDiffStatus = null;
    this.refreshTemplateDiff();
  }

  refreshTemplateDiff() {
    const templateName = this.selectedTemplateName();
    const templateId = this.notificationConfig?.templateId;
    if (!templateId || !templateName) {
      this.templateDiffStatus = null;
      return;
    }
    this.templateDiffLoading = true;
    this.mailService.templateDiff({templateId, templateName}).then(response => {
      this.templateDiffStatus = response;
      this.templateDiffLoading = false;
      this.logger.info("template diff result:", response);
    }).catch(error => {
      this.logger.error("template diff error:", error);
      this.templateDiffLoading = false;
    });
  }

  pushDefaultTemplate() {
    const templateName = this.selectedTemplateName();
    const templateId = this.notificationConfig?.templateId;
    if (!templateId || !templateName) {
      return;
    }
    this.templateDiffLoading = true;
    this.mailService.pushDefaultTemplate({templateId, templateName}).then(response => {
      this.logger.info("push default template result:", response);
      this.refreshTemplateDiff();
    }).catch(error => {
      this.logger.error("push default template error:", error);
      this.templateDiffLoading = false;
    });
  }

  templateDiffLabel(): string {
    if (!this.templateDiffStatus) {
      return "";
    }
    if (!this.templateDiffStatus.hasLocalTemplate) {
      return "No local default";
    }
    if (this.templateDiffStatus.matchesLocal) {
      return "Matches local default";
    }
    return "Differs from local default";
  }

  localTemplateAvailable(): boolean {
    return !!this.templateDiffStatus?.hasLocalTemplate;
  }

}
