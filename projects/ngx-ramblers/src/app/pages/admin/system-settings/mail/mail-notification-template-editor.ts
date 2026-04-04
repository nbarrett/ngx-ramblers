import { Component, EventEmitter, inject, OnDestroy, OnInit, Output } from "@angular/core";
import {
  MailMessagingConfig,
  MailSettingsTab,
  MemberSelection,
  NotificationConfig,
  overrideKeyToLabel,
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
import { cloneDeep, first, last } from "es-toolkit/compat";
import { Subscription } from "rxjs";
import {
  faAdd,
  faBackward,
  faChevronDown,
  faChevronUp,
  faCopy,
  faEraser,
  faForward,
  faImage,
  faSpinner,
  faTrash,
  faTriangleExclamation
} from "@fortawesome/free-solid-svg-icons";
import { BroadcastService } from "../../../../services/broadcast-service";
import { AlertLevel } from "../../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../../models/broadcast.model";
import { SiteMaintenanceService } from "../../../../services/site-maintenance.service";
import { FormsModule } from "@angular/forms";
import { MarkdownEditorComponent } from "../../../../markdown-editor/markdown-editor.component";
import { BadgeButtonComponent } from "../../../../modules/common/badge-button/badge-button";
import { BrevoButtonComponent } from "../../../../modules/common/third-parties/brevo-button";
import { BrevoDropdownItem } from "../../../../models/brevo-dropdown.model";
import { SenderRepliesAndSignoff } from "../../send-emails/sender-replies-and-signoff";
import {
  ForgotPasswordNotificationDetailsComponent
} from "../../../../notifications/admin/templates/forgot-password-notification-details";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ImageCropperAndResizerComponent } from "../../../../image-cropper-and-resizer/image-cropper-and-resizer";
import { AwsFileData } from "../../../../models/aws-object.model";
import { RootFolder } from "../../../../models/system.model";
import { ActivatedRoute } from "@angular/router";
import { Location } from "@angular/common";
import { StoredValue } from "../../../../models/ui-actions";
import { toKebabCase } from "../../../../functions/strings";
import { ImageActionsDropdownComponent } from "../../../../modules/common/dynamic-content/image-actions-dropdown";

@Component({
    selector: "app-mail-notification-template-mapping-editor",
    styles: [`
      .override-accordion-toggle
        background: var(--ramblers-colour-mintcake) !important
        border: 0
        color: #ffffff !important

      .override-accordion-toggle span,
      .override-accordion-toggle .fw-bold,
      .override-accordion-toggle .text-muted,
      .override-accordion-toggle .small
        color: #ffffff !important

      .override-accordion-toggle fa-icon,
      .override-accordion-toggle svg
        color: #ffffff !important
        fill: #ffffff !important

      .override-accordion-toggle:hover,
      .override-accordion-toggle:focus
        background: var(--ramblers-colour-sunrise) !important
        color: #000000 !important
        box-shadow: none

      .override-accordion-toggle:hover span,
      .override-accordion-toggle:hover .fw-bold,
      .override-accordion-toggle:hover .text-muted,
      .override-accordion-toggle:hover .small,
      .override-accordion-toggle:focus span,
      .override-accordion-toggle:focus .fw-bold,
      .override-accordion-toggle:focus .text-muted,
      .override-accordion-toggle:focus .small
        color: #000000 !important

      .override-accordion-toggle:hover fa-icon,
      .override-accordion-toggle:hover svg,
      .override-accordion-toggle:focus fa-icon,
      .override-accordion-toggle:focus svg
        color: #000000 !important
        fill: #000000 !important

      .override-accordion-toggle-active,
      .override-accordion-toggle-active:hover,
      .override-accordion-toggle-active:focus
        background: var(--ramblers-colour-sunrise) !important
        color: #000000 !important

      .override-accordion-toggle-active span,
      .override-accordion-toggle-active .fw-bold,
      .override-accordion-toggle-active .text-muted,
      .override-accordion-toggle-active .small
        color: #000000 !important

      .override-accordion-toggle-active fa-icon,
      .override-accordion-toggle-active svg
        color: #000000 !important
        fill: #000000 !important

      .brevo-icon
        width: 17px
    `],
    template: `
      @if (mailMessagingConfig) {
        <div class="row thumbnail-heading-frame">
          <div class="thumbnail-heading-with-select">
            <div class="d-flex flex-wrap align-items-center gap-2">
              <label for="template-mapping">Email Configuration
                {{ mailMessagingConfig.notificationConfigs.indexOf(notificationConfig) + 1 }}
                of {{ mailMessagingConfig.notificationConfigs.length }}: </label>
              <select [ngModel]="selectedConfigValue()"
                      (ngModelChange)="selectByValue($event)"
                      id="template-mapping"
                      class="form-control input-sm"
                      style="width: auto; max-width: 300px;">
                @for (mapping of mailMessagingConfig.notificationConfigs; track mapping.id || mapping.subject.text; let index = $index) {
                  <option [ngValue]="configSelectionValue(mapping, index)">{{ cachedConfigLabels.get(mapping) || mapping?.subject?.text }}</option>
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
            @if (cachedIssues.length > 0) {
              <div class="col-sm-12 mt-2">
                <div class="alert alert-warning py-2 mb-2">
                  <fa-icon [icon]="faTriangleExclamation" class="me-1"/>
                  <strong>{{ cachedIssues.length }} issue{{ cachedIssues.length > 1 ? 's' : '' }} found:</strong>
                  @for (issue of cachedIssues; track issue) {
                    <div><small>{{ issue }}</small></div>
                  }
                </div>
              </div>
            }
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
                              [class.is-invalid]="!notificationConfig.bannerId"
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
                              [class.is-invalid]="!notificationConfig.templateId"
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
                      <app-brevo-button button title="Snapshot Templates"
                                        [showTooltip]="true"
                                        [disabled]="snapshotTemplatesDisabled()"
                                        (click)="snapshotTemplates()"/>
                    </div>
                    <div class="mt-1">
                      @if (templateDiffLoading) {
                        <span class="badge bg-secondary">
                        <fa-icon [icon]="faSpinner" animation="spin"/>
                        <span class="ms-1">Checking...</span>
                      </span>
                      }
                      @if (snapshotLoading) {
                        <span class="badge bg-secondary ms-2">
                        <fa-icon [icon]="faSpinner" animation="spin"/>
                        <span class="ms-1">Snapshotting templates...</span>
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
                @if (discoveredOverrideKeys.length > 0) {
                  <div class="col-sm-12 mt-2">
                    <div class="row thumbnail-heading-frame">
                      <div class="thumbnail-heading">Template Image Overrides</div>
                      <div class="col-sm-12 mb-2">
                        <small class="text-muted">Upload site-specific screenshots for this template. These are
                          preserved when the base template is updated centrally.</small>
                      </div>
                      @for (key of discoveredOverrideKeys; track key) {
                        <div class="col-sm-12 mb-3">
                          <div class="border rounded overflow-hidden">
                            <button type="button"
                                    class="btn text-start text-decoration-none w-100 d-flex justify-content-between align-items-center px-3 py-2 override-accordion-toggle"
                                    [class.override-accordion-toggle-active]="activeOverrideAccordion === key"
                                    (click)="toggleOverrideAccordion(key)">
                              <span>
                                <span class="fw-bold">{{ labelForKey(key) }}</span>
                                <span class="ms-2 small text-muted">{{ overrideValue(key) ? "configured" : "not configured" }}</span>
                              </span>
                              <fa-icon [icon]="activeOverrideAccordion === key ? faChevronUp : faChevronDown"/>
                            </button>
                            @if (activeOverrideAccordion === key) {
                              <div class="p-3 border-top">
                                @if (overrideValue(key)) {
                                  <div class="mb-2 p-2 border rounded" style="background: #fafafa;">
                                    <img [src]="overrideValue(key)" [alt]="labelForKey(key)"
                                         style="max-width: 100%; height: auto; display: block;">
                                  </div>
                                } @else {
                                  <div class="mb-2">
                                    <small class="text-muted">No image configured</small>
                                  </div>
                                }
                                <div class="mb-3">
                                  <app-image-actions-dropdown [hasImage]="!!overrideValue(key)"
                                                              (edit)="editOverrideImage(key)"
                                                              (replace)="replaceOverrideImage(key)"
                                                              (remove)="removeOverrideValue(key)"/>
                                </div>
                                @if (activeOverrideEditor === key) {
                                  <app-image-cropper-and-resizer
                                    [rootFolder]="overrideImageFolder"
                                    [preloadImage]="overridePreloadImage(key)"
                                    [hideFileSelection]="editingExistingOverride(key)"
                                    (imageChange)="overrideImageChanged(key, $event)"
                                    (save)="overrideImageSaved(key, $event)"
                                    (quit)="closeOverrideEditor(key)">
                                  </app-image-cropper-and-resizer>
                                }
                              </div>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
              <div class="thumbnail-heading-frame">
                <div class="thumbnail-heading">Member Selection And Actions</div>
                @if (isWorkflowConfig) {
                  <div class="row"
                  >
                    <div class="col-sm-12">
                      <div class="form-group">
                        <label>Member Selected automatically via built-in workflow on <a
                          (click)="tabSelected.emit(MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS)">{{ MailSettingsTab.BUILT_IN_PROCESS_MAPPINGS }}</a>
                          tab</label>
                      </div>
                    </div>
                  </div>
                }
                @if (!isWorkflowConfig) {
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
                      @if (notificationConfig.defaultMemberSelection !== MemberSelection.MAILING_LIST) {
                        <div
                          class="form-group">
                          <label for="campaign-months-in-past-filter">Months In Past</label>
                          <input [(ngModel)]="notificationConfig.monthsInPast"
                                 type="number" id="campaign-months-in-past-filter"
                                 class="form-control input-sm">
                        </div>
                      }
                      @if (notificationConfig.defaultMemberSelection === MemberSelection.MAILING_LIST) {
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
                  @if (notificationConfig.defaultMemberSelection !== MemberSelection.MAILING_LIST) {
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
                                [ngValue]="workflowActionValue(type.key)">{{ stringUtils.asTitle(type.value) }}
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
                                [ngValue]="workflowActionValue(type.key)">{{ stringUtils.asTitle(type.value) }}
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
    imports: [FormsModule, MarkdownEditorComponent, BadgeButtonComponent, SenderRepliesAndSignoff, BrevoButtonComponent, ForgotPasswordNotificationDetailsComponent, FontAwesomeModule, ImageCropperAndResizerComponent, ImageActionsDropdownComponent]
})

export class MailNotificationTemplateEditor implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("MailNotificationTemplateEditor", NgxLoggerLevel.ERROR);

  memberSelections: KeyValue<string>[] = [KEY_NULL_VALUE_NONE].concat(enumKeyValues(MemberSelection));
  workflowActions: KeyValue<string>[] = [KEY_NULL_VALUE_NONE].concat(enumKeyValues(WorkflowAction));
  workflowActionValues: Map<string, string[]> = new Map(
    this.workflowActions.map(item => [item.key, item.key ? [item.value] : []])
  );

  private subscriptions: Subscription[] = [];
  @Output() configDeleted: EventEmitter<string> = new EventEmitter();
  @Output() tabSelected: EventEmitter<MailSettingsTab> = new EventEmitter();

  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public mailLinkService: MailLinkService = inject(MailLinkService);
  public mailService: MailService = inject(MailService);
  public urlService: UrlService = inject(UrlService);
  public mailMessagingService: MailMessagingService = inject(MailMessagingService);
  private broadcastService: BroadcastService<any> = inject(BroadcastService);
  private siteMaintenanceService: SiteMaintenanceService = inject(SiteMaintenanceService);
  public templateDropdownItems: BrevoDropdownItem[] = [
    {id: "edit-rich-text", label: "Edit Rich Text"},
    {id: "view-template", label: "View Template"}
  ];
  public mailMessagingConfig: MailMessagingConfig;
  public parametersFrom: KeyValue<any>[] = [];
  public params: SendSmtpEmailParams;
  public notificationConfig: NotificationConfig = null;
  public templateDiffStatus: TemplateDiffResponse;
  public templateDiffLoading = false;
  public snapshotLoading = false;
  public snapshotAllowed = false;

  protected readonly faAdd = faAdd;
  protected readonly faEraser = faEraser;
  protected readonly faCopy = faCopy;
  protected readonly first = first;
  protected readonly faForward = faForward;
  protected readonly faBackward = faBackward;
  protected readonly faSpinner = faSpinner;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faImage = faImage;
  protected readonly faTrash = faTrash;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronUp = faChevronUp;
  public activeOverrideAccordion: string = null;
  public activeOverrideEditor: string = null;
  public activeOverrideEditorMode: "edit" | "replace" | null = null;
  public pendingOverridePreviews: Record<string, string> = {};
  public overrideImageFolder = RootFolder.siteContent;
  public discoveredOverrideKeys: string[] = [];
  private activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  private location: Location = inject(Location);
  private configurationParam: string = null;
  public cachedIssues: string[] = [];
  public cachedConfigLabels: Map<NotificationConfig, string> = new Map();
  public isWorkflowConfig = false;

  protected readonly MemberSelection = MemberSelection;

  protected readonly MailSettingsTab = MailSettingsTab;

  async ngOnInit() {
    this.logger.info("ngOnInit:start");
    this.configurationParam = this.activatedRoute.snapshot.queryParams[StoredValue.CONFIGURATION] || null;
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.logger.info("mailMessagingConfig:", mailMessagingConfig, "configurationParam:", this.configurationParam);
      this.mailMessagingConfig = mailMessagingConfig;
      this.params = this.mailMessagingService.exampleEmailParams();
      this.ensureNotificationConfigSelection(mailMessagingConfig);
      this.refreshCachedState();
      const parameters: KeyValue<any>[] = extractParametersFrom(this.params, false);
      const parametersAndValues: KeyValue<any>[] = extractParametersFrom(this.params, true);
      this.logger.info("parameters:raw:", parameters, "parameters:wrapped:", parametersAndValues);
      this.parametersFrom = [{
        key: null,
        value: "(none)"
      }].concat(parameters.filter(item => !item.key.includes("subject")));
      this.refreshTemplateDiff();
      this.logger.info("refreshTemplateDiff:complete");
    }));
    const systemStatus = await this.siteMaintenanceService.getMigrationStatus();
    const environmentName = systemStatus?.environment?.env || systemStatus?.environment?.nodeEnv;
    this.snapshotAllowed = environmentName === "development";
    this.logger.info("ngOnInit:complete");
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  arrayComparer(item1: string[], item2: string[]): boolean {
    return JSON.stringify(item1) === JSON.stringify(item2);
  }

  notificationConfigComparer(item1: NotificationConfig, item2: NotificationConfig): boolean {
    if (!item1 || !item2) {
      return item1 === item2;
    }
    if (item1.id && item2.id) {
      return item1.id === item2.id;
    }
    return this.configSlug(item1) === this.configSlug(item2);
  }

  configSelectionValue(config: NotificationConfig, index: number): string {
    if (!config) {
      return null;
    }
    if (config.id) {
      return config.id;
    }
    return `${this.configSlug(config)}-${index}`;
  }

  selectedConfigValue(): string {
    const selectedIndex = this.mailMessagingConfig?.notificationConfigs?.indexOf(this.notificationConfig) ?? -1;
    return selectedIndex > -1 ? this.configSelectionValue(this.notificationConfig, selectedIndex) : null;
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

  workflowActionValue(key: string): string[] {
    return this.workflowActionValues.get(key) || [];
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
    if (!notificationConfig) {
      return;
    }
    if (this.notificationConfig === notificationConfig) {
      return;
    }
    this.notificationConfig = notificationConfig;
    this.mailMessagingService.initialiseSubject(this.notificationConfig);
    this.refreshCachedState();
    this.logger.info("selected notificationConfig:", this.notificationConfig);
    this.updateConfigurationUrl(notificationConfig);
    this.refreshTemplateDiff();
  }

  selectByValue(selectionValue: string) {
    const selectedConfig = this.mailMessagingConfig?.notificationConfigs?.find((config, index) => this.configSelectionValue(config, index) === selectionValue);
    this.select(selectedConfig);
  }

  private updateConfigurationUrl(config: NotificationConfig) {
    const slug = this.configSlug(config);
    if (slug !== this.configurationParam) {
      this.configurationParam = slug;
      const params = new URLSearchParams(window.location.search);
      params.set(StoredValue.CONFIGURATION, slug);
      this.location.replaceState(window.location.pathname, params.toString());
    }
  }

  private configSlug(config: NotificationConfig): string {
    return toKebabCase(config?.subject?.text || "");
  }

  private selectedConfigFor(mailMessagingConfig: MailMessagingConfig): NotificationConfig {
    const notificationConfigs = mailMessagingConfig?.notificationConfigs || [];
    const selectedConfigByCurrentValue = notificationConfigs.find(config => this.notificationConfigComparer(config, this.notificationConfig));
    if (selectedConfigByCurrentValue) {
      this.logger.info("selected configuration from current value:", selectedConfigByCurrentValue);
      return selectedConfigByCurrentValue;
    }
    const selectedConfigByParam = this.configurationParam
      ? notificationConfigs.find(config => this.configSlug(config) === this.configurationParam)
      : null;
    if (selectedConfigByParam) {
      this.logger.info("selected configuration from query param:", selectedConfigByParam);
      return selectedConfigByParam;
    }
    const firstConfig = first(notificationConfigs);
    this.logger.info("selected first configuration:", firstConfig);
    return firstConfig;
  }

  private ensureNotificationConfigSelection(mailMessagingConfig: MailMessagingConfig) {
    const selectedConfig = this.selectedConfigFor(mailMessagingConfig);
    if (!selectedConfig) {
      this.notificationConfig = null;
      return;
    }
    if (this.notificationConfigComparer(this.notificationConfig, selectedConfig)) {
      return;
    }
    this.notificationConfig = selectedConfig;
    this.mailMessagingService.initialiseSubject(this.notificationConfig);
    this.logger.info("ensured notificationConfig:", this.notificationConfig);
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
      this.discoveredOverrideKeys = [];
      return;
    }
    this.templateDiffLoading = true;
    this.mailService.templateDiff({templateId, templateName}).then(response => {
      this.templateDiffStatus = response;
      this.discoveredOverrideKeys = response.overrideKeys || [];
      this.templateDiffLoading = false;
      this.logger.info("template diff result:", response, "discoveredOverrideKeys:", this.discoveredOverrideKeys);
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
      this.templateDiffStatus = {
        ...(this.templateDiffStatus || {}),
        hasLocalTemplate: true,
        matchesLocal: true,
        overrideKeys: this.discoveredOverrideKeys
      } as TemplateDiffResponse;
      this.templateDiffLoading = false;
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

  snapshotTemplatesDisabled(): boolean {
    return !this.snapshotAllowed || this.snapshotLoading || !this.mailMessagingConfig?.brevo?.mailTemplates?.templates?.length;
  }

  snapshotTemplates() {
    this.snapshotLoading = true;
    this.mailService.snapshotTemplates({sanitiseHtml: true}).then(response => {
      const savedMessage = this.stringUtils.pluraliseWithCount(response.savedCount, "template");
      const createdMessage = this.stringUtils.pluraliseWithCount(response.createdCount, "created template", "created templates");
      const updatedMessage = this.stringUtils.pluraliseWithCount(response.updatedCount, "updated template", "updated templates");
      const unchangedMessage = this.stringUtils.pluraliseWithCount(response.unchangedCount, "unchanged template", "unchanged templates");
      const failedMessage = response.failedTemplates.length > 0 ? `, ${this.stringUtils.pluraliseWithCount(response.failedTemplates.length, "failed")}` : "";
      const message = `Snapshot complete: ${savedMessage} saved (${createdMessage}, ${updatedMessage}, ${unchangedMessage})${failedMessage}`;
      const type = response.failedTemplates.length > 0 ? AlertLevel.ALERT_WARNING : AlertLevel.ALERT_SUCCESS;
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
        message: {title: "Brevo templates", message},
        type
      }));
      this.snapshotLoading = false;
      this.refreshTemplateDiff();
    }).catch(error => {
      const message = error?.message || error;
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.NOTIFY_MESSAGE, {
        message: {title: "Brevo templates snapshot failed", message},
        type: AlertLevel.ALERT_ERROR
      }));
      this.snapshotLoading = false;
    });
  }

  refreshCachedState() {
    this.cachedIssues = this.configIssues();
    this.cachedConfigLabels = new Map();
    this.mailMessagingConfig?.notificationConfigs?.forEach(config => {
      this.cachedConfigLabels.set(config, this.configLabel(config));
    });
    this.isWorkflowConfig = this.mailMessagingService.workflowIdsFor(this.mailMessagingConfig?.mailConfig)?.includes(this.notificationConfig?.id);
  }

  configIssues(config?: NotificationConfig): string[] {
    const target = config || this.notificationConfig;
    if (!target) {
      return [];
    }
    const issues: string[] = [];
    if (!target.templateId) {
      issues.push("No Brevo template selected - emails cannot be sent");
    }
    if (!target.bannerId) {
      issues.push("No banner image selected");
    }
    if (!target.senderRole) {
      issues.push("No sender role configured - emails cannot be sent");
    }
    if (!target.replyToRole) {
      issues.push("No reply-to role configured");
    }
    if (!target.signOffRoles?.length) {
      issues.push("No sign-off roles selected");
    }
    if (this.mailMessagingConfig?.committeeReferenceData) {
      const committeeMembers = this.mailMessagingConfig.committeeReferenceData.committeeMembers();
      if (target.senderRole && !committeeMembers.some(member => member.type === target.senderRole)) {
        issues.push(`Sender role "${target.senderRole}" not found in committee roles`);
      }
      if (target.replyToRole && !committeeMembers.some(member => member.type === target.replyToRole)) {
        issues.push(`Reply-to role "${target.replyToRole}" not found in committee roles`);
      }
      target.signOffRoles?.filter(role => !committeeMembers.some(member => member.type === role))
        .forEach(role => issues.push(`Sign-off role "${role}" not found in committee roles`));
    }
    return issues;
  }

  configLabel(config: NotificationConfig): string {
    const text = config?.subject?.text || "(no subject)";
    const issueCount = this.configIssues(config).length;
    return issueCount > 0 ? `${text} (${issueCount} issue${issueCount > 1 ? "s" : ""})` : text;
  }

  labelForKey(key: string): string {
    return overrideKeyToLabel(key);
  }

  overrideValue(key: string): string {
    return this.pendingOverridePreviews[key] || this.notificationConfig?.templateOverrides?.[key] || "";
  }

  toggleOverrideAccordion(key: string) {
    if (this.activeOverrideAccordion === key) {
      this.closeOverrideEditor(key);
    } else {
      this.activeOverrideAccordion = key;
      this.activeOverrideEditor = null;
      this.activeOverrideEditorMode = null;
    }
  }

  editOverrideImage(key: string) {
    this.activeOverrideAccordion = key;
    this.activeOverrideEditor = key;
    this.activeOverrideEditorMode = "edit";
  }

  replaceOverrideImage(key: string) {
    this.activeOverrideAccordion = key;
    this.activeOverrideEditor = key;
    this.activeOverrideEditorMode = "replace";
  }

  editingExistingOverride(key: string): boolean {
    return this.activeOverrideEditor === key && this.activeOverrideEditorMode === "edit" && !!this.overrideValue(key);
  }

  overridePreloadImage(key: string): string {
    return this.editingExistingOverride(key) ? this.overrideValue(key) : null;
  }

  overrideImageChanged(key: string, awsFileData: AwsFileData) {
    this.pendingOverridePreviews[key] = awsFileData?.image || "";
  }

  overrideImageSaved(key: string, awsFileData: AwsFileData) {
    if (!this.notificationConfig.templateOverrides) {
      this.notificationConfig.templateOverrides = {};
    }
    this.notificationConfig.templateOverrides[key] = this.urlService.imageSource(awsFileData.awsFileName, true);
    delete this.pendingOverridePreviews[key];
    this.activeOverrideEditor = null;
    this.activeOverrideEditorMode = null;
    this.logger.info("override image saved for", key, ":", this.notificationConfig.templateOverrides[key]);
  }

  removeOverrideValue(key: string) {
    if (this.notificationConfig.templateOverrides) {
      delete this.notificationConfig.templateOverrides[key];
    }
    delete this.pendingOverridePreviews[key];
    this.activeOverrideEditor = null;
    this.activeOverrideEditorMode = null;
  }

  closeOverrideEditor(key: string) {
    delete this.pendingOverridePreviews[key];
    if (this.activeOverrideAccordion === key) {
      this.activeOverrideAccordion = null;
    }
    if (this.activeOverrideEditor === key) {
      this.activeOverrideEditor = null;
    }
    this.activeOverrideEditorMode = null;
  }

}
