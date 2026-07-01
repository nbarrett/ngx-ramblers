import { AdminPath } from "../../models/admin-route-paths.model";
import { ChangeDetectorRef, Component, ElementRef, inject, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from "@angular/core";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { Location, NgClass, NgTemplateOutlet } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subscription, timer } from "rxjs";
import { switchMap } from "rxjs/operators";
import { isArray, isNumber, isString, isUndefined, kebabCase, keys, values } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import {
  faAddressCard,
  faAlignLeft,
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faAngleLeft,
  faAngleRight,
  faArrowLeft,
  faArrowRight,
  faArrowRotateLeft,
  faCalendarDays,
  faCheckCircle,
  faChevronDown,
  faChevronRight,
  faCircleInfo,
  faCompress,
  faExpand,
  faFile,
  faFloppyDisk,
  faFolderOpen,
  faGripLines,
  faGripVertical,
  faPaperPlane,
  faPlus,
  faSignature,
  faSpinner,
  faTableColumns,
  faTrash,
  faTriangleExclamation,
  faXmark
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { Step, StepList, StepPanel, StepPanels, Stepper, StepperModule } from "primeng/stepper";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../services/notifier.service";
import { AlertTarget } from "../../models/alert-target.model";
import { PageComponent } from "../../page/page.component";
import { Member, MemberBulkLoadDateMap } from "../../models/member.model";
import { MemberBulkLoadAuditService } from "../../services/member/member-bulk-load-audit.service";
import {
  ADDRESSEE_OPTIONS,
  AddresseeType,
  ArticleBlock,
  ArticleBlockPosition,
  BatchSendProgress,
  BatchSendStatus,
  BatchTransactionalSendRequest,
  BRANDING_MODE_OPTIONS,
  BrandingMode,
  buildDefaultFragmentOrder,
  ComposerExternalRecipient,
  ComposerFragment,
  ComposerFragmentKind,
  DateInputMode,
  DEFAULT_COLUMN_GAP_PX,
  defaultEmailComposerState,
  dividerHtml,
  DragHoverPosition,
  EMAIL_COMPOSER_STEPS,
  EmailComposerState,
  EmailComposerStepKey,
  EmailComposition,
  EmailCompositionStatus,
  EmailCompositionSummary,
  EventInclusionMode,
  EXPANDABLE_FRAGMENT_KINDS,
  findRecycledTrackingUrls,
  newDividerFragment,
  newMultiColumnFragment,
  EmailComposerContextSource,
  PreviewStepDirection,
  PROMOTIONAL_LANGUAGE_PATTERN,
  RecipientField,
  RecipientMode,
  REPLY_OR_FORWARD_SUBJECT_PATTERN,
  SECTION_DIVIDER_OPTIONS,
  SectionDividerStyle,
  SendingChannel,
  UNBRANDED_HARD_CAP_RECIPIENTS,
  UNBRANDED_LIST_SEND_WARNING_THRESHOLD,
  UNBRANDED_LONG_BODY_CHAR_THRESHOLD,
  PriorSendExclusion,
  ValidationError,
  ValidationErrorWithLink
} from "../../models/email-composer.model";
import {
  CreateCampaignRequest,
  ListInfo,
  MailMessagingConfig,
  MemberSelection,
  NotificationConfig,
  SendSmtpEmailParams,
  StatusMappedResponseSingleInput,
  TemplateRenderRequest,
  WorkflowAction
} from "../../models/mail.model";
import { toCampaignContactTokens } from "../../common/campaign-contact-tokens";
import { MailMessagingService } from "../../services/mail/mail-messaging.service";
import { MailService } from "../../services/mail/mail.service";
import { MailListUpdaterService } from "../../services/mail/mail-list-updater.service";
import { MemberService } from "../../services/member/member.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { ListSubscriberService } from "../../services/mail/list-subscriber.service";
import { ListSubscriberCountComponent } from "../../modules/common/mail/list-subscriber-count";
import { UrlService } from "../../services/url.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { TiptapMarkdownEditor } from "../../modules/common/tiptap-editor/tiptap-markdown-editor";
import { MaximisablePanelComponent } from "../../modules/common/maximisable-panel/maximisable-panel";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { MemberMultiSelect } from "../../modules/common/member-multi-select/member-multi-select";
import { RecipientFieldComponent } from "../../modules/common/recipient-field/recipient-field";
import { ArticleBlockSingleEditor } from "../../modules/common/article-blocks/article-block-single-editor";
import { SectionDividerSelectComponent } from "../../modules/common/section-divider-select/section-divider-select";
import { EmailComposerRenderingService } from "../../services/email-composer/email-composer-rendering.service";
import { EmailComposerSendService } from "../../services/email-composer/email-composer-send.service";
import { InboxReplyHandoffService } from "../../services/inbox/inbox-reply-handoff.service";
import { InboxReplyOutboundContext } from "../../models/inbox.model";
import TurndownService from "turndown";
import { EmailCompositionsService } from "../../services/email-composer/email-compositions.service";
import { NotificationConfigSelectorComponent } from "../admin/system-settings/mail/notification-config-selector";
import { SenderRepliesAndSignoff } from "../admin/send-emails/sender-replies-and-signoff";
import { EmailPreviewComponent } from "../../modules/common/email-preview/email-preview.component";
import { NotificationDirective } from "../../notifications/common/notification.directive";
import { SystemConfig } from "../../models/system.model";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { CommitteeQueryService } from "../../services/committee/committee-query.service";
import { WalksAndEventsService } from "../../services/walks-and-events/walks-and-events.service";
import { GoogleMapsService } from "../../services/google-maps.service";
import { CommitteeFile, CommitteeMember, GroupEventSummary, Notification, NotificationItem } from "../../models/committee.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { MediaQueryService } from "../../services/committee/media-query.service";
import { CommitteeDisplayService } from "../committee/committee-display.service";
import { PageService } from "../../services/page.service";
import { PageContentService } from "../../services/page-content.service";
import { EM_DASH_WITH_SPACES, PageContent } from "../../models/content-text.model";
import { SiteLinkInputComponent } from "../../modules/common/site-link-input/site-link-input";
import { CommitteeFileMultiSelectComponent } from "../../modules/common/committee-file-multi-select/committee-file-multi-select";
import { ExternalRecipient } from "../../models/external-recipient.model";
import { ExternalRecipientService } from "../../services/external-recipient/external-recipient.service";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { DateValue } from "../../models/date.model";
import { DatePicker } from "../../date-and-time/date-picker";
import { DateRange, DateRangeSlider } from "../../components/date-range-slider/date-range-slider";
import { LinkComponent } from "../../link/link";
import { MarkdownComponent } from "ngx-markdown";
import {
  CommitteeNotificationDetailsComponent
} from "../../notifications/committee/templates/committee-notification-details.component";
import {
  CommitteeNotificationRamblersMessageItemComponent
} from "../../notifications/committee/templates/committee-notification-ramblers-message-item";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { Confirm, ConfirmType, StoredValue } from "../../models/ui-actions";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { NgSelectModule } from "@ng-select/ng-select";
import {
  AdvancedSearchPreset,
  createAllTimePreset,
  createFuturePreset,
  createPastPreset
} from "../../models/search.model";
import { DateTime } from "luxon";
import { campaignOverflowNotice } from "../../functions/brevo-campaigns";
import { CampaignOverflowNotice, NGX_BREVO_CAMPAIGN_TAG } from "../../models/brevo-campaign-queue.model";
import { BREVO_CAMPAIGN_RELEASE_TASK_ID } from "../../models/scheduled-task.model";
import { ScheduledTaskService } from "../../services/scheduled-task.service";

@Component({
  selector: "app-email-composer",
  styleUrls: ["./email-composer.sass"],
  imports: [
    PageComponent,
    AlertPanelComponent,
    ListSubscriberCountComponent,
    FormsModule,
    NgClass,
    NgTemplateOutlet,
    FontAwesomeModule,
    StepperModule,
    Stepper,
    Step,
    StepList,
    StepPanel,
    StepPanels,
    TooltipDirective,
    BsDropdownDirective,
    BsDropdownToggleDirective,
    BsDropdownMenuDirective,
    NgSelectModule,
    SiteLinkInputComponent,
    CommitteeFileMultiSelectComponent,
    TiptapMarkdownEditor,
    MaximisablePanelComponent,
    SectionDividerSelectComponent,
    MemberMultiSelect,
    RecipientFieldComponent,
    ArticleBlockSingleEditor,
    NotificationConfigSelectorComponent,
    SenderRepliesAndSignoff,
    EmailPreviewComponent,
    NotificationDirective,
    DatePicker,
    DateRangeSlider,
    LinkComponent,
    MarkdownComponent,
    CommitteeNotificationDetailsComponent,
    CommitteeNotificationRamblersMessageItemComponent,
    DisplayDatePipe,
    FullNameWithAliasPipe
  ],
  template: `
    <app-page autoTitle pageTitle="Email Composer" [showTitle]="false">
      <app-maximisable-panel #composerPanel="maximisablePanel" [showToggleButton]="false">
      <div panelControls class="composer-workspace-bar">
        <div class="composer-workspace-heading">
          <h1 class="composer-workspace-title">Email Composer</h1>
          @if (currentComposition) {
            <div class="composer-workspace-status">{{ lastSavedDescription() }}</div>
          }
        </div>
        <div class="composer-workspace-actions">
          <button type="button" class="btn btn-quiet d-none d-md-inline-block" (click)="composerPanel.toggle()"
                  [tooltip]="composerPanel.maximised ? composerPanel.restoreTooltip : composerPanel.maximiseTooltip">
            <fa-icon [icon]="composerPanel.maximised ? faCompress : faExpand" class="me-1"/>{{ composerPanel.maximised ? 'Restore' : 'Maximise' }}
          </button>
          <button type="button" class="btn btn-quiet" (click)="exitComposer()">
            <fa-icon [icon]="faXmark" class="me-1"/>Exit composer
          </button>
        </div>
      </div>
      @if (notifyTarget.showAlert) {
        <div class="alert {{notifyTarget.alertClass}} composer-workspace-alert">
          <fa-icon [icon]="notifyTarget.alert.icon"/>
          @if (notifyTarget.alertTitle) {
            <strong>{{ notifyTarget.alertTitle }}: </strong>
          }
          {{ notifyTarget.alertMessage }}
        </div>
      }
      @let recipientsValidationVisible = stepperActiveTab === EmailComposerStepKey.RECIPIENTS && (recipientsStepErrors().length > 0 || priorSendExclusions.length > 0);
      @if (postSendActionWarningVisible() || recipientsValidationVisible) {
        <div class="email-composer-validation-summary">
          @if (bulkDeletionPending()) {
            <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>This email workflow deletes its recipients</h5>
            <ul class="list-arrow">
              <li>The "{{ state.notificationConfig?.subject?.text }}" email type will permanently delete its recipients from the database once the email has gone out. This cannot be undone.</li>
              <li>{{ stringUtils.pluraliseWithCount(bulkDeletionMemberCount(), "member") }} will be removed after the send.</li>
            </ul>
          }
          @if (memberDisablePending()) {
            <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>This email workflow disables its recipients</h5>
            <ul class="list-arrow">
              <li>The "{{ state.notificationConfig?.subject?.text }}" email type will remove its recipients from the group (unticking Approved Group Member) once the email has gone out.</li>
              <li>{{ stringUtils.pluraliseWithCount(bulkDeletionMemberCount(), "member") }} will be disabled after the send.</li>
            </ul>
          }
          @if (recipientsValidationVisible) {
            @if (recipientsStepErrors().length > 0) {
              <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>Before you can continue:</h5>
              <ul class="list-arrow">
                @for (error of recipientsStepErrors(); track error) { <li>{{ error }}</li> }
              </ul>
            }
            @if (priorSendExclusions.length > 0) {
              <h5>
                <fa-icon [icon]="faTriangleExclamation" class="me-2"/>
                @if (!includeAlreadySent) {
                  {{ priorSendExclusions.length }} {{ priorSendExclusions.length === 1 ? "member was" : "members were" }} excluded because they already received this email{{ priorSendDateRangeLabel() }}.
                } @else {
                  Including {{ priorSendExclusions.length }} already-sent {{ priorSendExclusions.length === 1 ? "member" : "members" }} in this re-send (originally sent{{ priorSendDateRangeLabel() }}).
                }
                <button type="button" class="email-composer-inline-toggle ms-2"
                        (click)="togglePriorSendDetails()">
                  {{ priorSendDetailsExpanded ? "Hide who" : "Show who" }}
                </button>
              </h5>
              @if (priorSendDetailsExpanded) {
                <ul class="list-arrow mt-1">
                  @for (exclusion of priorSendExclusions; track exclusion.member.id) {
                    <li>{{ exclusion.member | fullNameWithAlias }} - sent {{ priorSendDateLabel(exclusion.sentAt) }}</li>
                  }
                </ul>
              }
              <div class="form-check mt-2">
                <input class="form-check-input"
                       type="checkbox"
                       id="include-already-sent"
                       [checked]="includeAlreadySent"
                       (change)="toggleIncludeAlreadySent()">
                <label class="form-check-label small" for="include-already-sent">Re-send to members already sent this email</label>
              </div>
            }
          }
          @if (postSendActionWarningVisible()) {
            <button type="button" class="btn btn-primary btn-sm mt-2" (click)="dismissPostSendActionWarning()">
              <fa-icon [icon]="faXmark"/> Dismiss
            </button>
          }
        </div>
      }
      <div class="row mb-3">
        <div class="col-sm-12">
          <p-stepper [value]="$any(stepperActiveTab)" (valueChange)="onStepperValueChange($event)" [linear]="false">
            <p-step-list>
              @for (step of visibleStepperSteps(); let idx = $index; track step.key) {
                <p-step [value]="$any(step.key)" [disabled]="!canAccessStep(step.key)">
                  <div class="email-composer-step-header">
                    <span class="email-composer-step-number">{{ idx + 1 }}</span>
                    <div class="email-composer-step-text">
                      <div class="email-composer-step-label">{{ step.label }}</div>
                      <div class="email-composer-step-hint">{{ stepHint(step.key) }}</div>
                    </div>
                  </div>
                </p-step>
              }
            </p-step-list>
            <p-step-panels>
              <p-step-panel [value]="$any(EmailComposerStepKey.RECIPIENTS)">
                <ng-template #content>
                  <ng-container *ngTemplateOutlet="recipientsStep"/>
                </ng-template>
              </p-step-panel>
              <p-step-panel [value]="$any(EmailComposerStepKey.TEMPLATE)">
                <ng-template #content>
                  <ng-container *ngTemplateOutlet="templateStep"/>
                </ng-template>
              </p-step-panel>
              <p-step-panel [value]="$any(EmailComposerStepKey.COMPOSE)">
                <ng-template #content>
                  <ng-container *ngTemplateOutlet="composeStep"/>
                </ng-template>
              </p-step-panel>
              <p-step-panel [value]="$any(EmailComposerStepKey.EVENTS)">
                <ng-template #content>
                  <ng-container *ngTemplateOutlet="eventsStep"/>
                </ng-template>
              </p-step-panel>
              <p-step-panel [value]="$any(EmailComposerStepKey.REVIEW)">
                <ng-template #content>
                  <ng-container *ngTemplateOutlet="reviewStep"/>
                </ng-template>
              </p-step-panel>
              <p-step-panel [value]="$any(EmailComposerStepKey.SEND)">
                <ng-template #content>
                  <ng-container *ngTemplateOutlet="sendStep"/>
                </ng-template>
              </p-step-panel>
            </p-step-panels>
          </p-stepper>
        </div>
      </div>
      @if (draftsPanelOpen) {
        <div class="email-composer-drafts-panel">
          @if (drafts.length === 0) {
            <div class="text-muted">No saved drafts yet.</div>
          } @else {
            <ul class="list-unstyled mb-0">
              @for (draft of drafts; track draft.id) {
                <li class="email-composer-draft-row">
                  <div class="email-composer-draft-meta" (click)="loadDraft(draft.id)" title="Click to load this draft">
                    <strong>{{ draft.title }}</strong>
                    @if (draft.shared) {
                      <span class="badge-cloudy ms-2" title="Shared with other committee members">Shared</span>
                    }
                    <span class="text-muted small ms-2">{{ draftSavedDescription(draft) }}</span>
                  </div>
                  <div class="email-composer-draft-actions">
                    <button type="button" class="btn btn-primary btn-sm" (click)="loadDraft(draft.id)">Load</button>
                    @if (pendingDraftDeleteId === draft.id) {
                      <button type="button" class="btn btn-danger btn-sm" (click)="confirmDeleteDraft(draft.id)">Confirm delete</button>
                      <button type="button" class="btn btn-primary btn-sm" (click)="cancelDeleteDraft()">Cancel</button>
                    } @else {
                      <button type="button" class="btn btn-danger btn-sm" (click)="requestDeleteDraft(draft.id)">Delete</button>
                    }
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      }
      @if (sentEmailsPanelOpen) {
        <div class="email-composer-drafts-panel">
          @if (sentEmails.length === 0) {
            <div class="text-muted">No sent emails yet.</div>
          } @else {
            <ul class="list-unstyled mb-0">
              @for (sent of sentEmails; track sent.id) {
                <li class="email-composer-draft-row">
                  <div class="email-composer-draft-meta" (click)="useAsTemplate(sent.id)" title="Click to use this sent email as a starting point">
                    <strong>{{ sent.title }}</strong>
                    @if (sent.shared) {
                      <span class="badge-cloudy ms-2" title="Shared with other committee members">Shared</span>
                    }
                    <span class="text-muted small ms-2">{{ sentDescription(sent) }}</span>
                    @if (sent.sentRecipientCount) {
                      <span class="text-muted small ms-2">to {{ stringUtils.pluraliseWithCount(sent.sentRecipientCount, "recipient") }}</span>
                    }
                  </div>
                  <div class="email-composer-draft-actions">
                    <button type="button" class="btn btn-primary btn-sm" (click)="useAsTemplate(sent.id)">Use as template</button>
                    @if (pendingDraftDeleteId === sent.id) {
                      <button type="button" class="btn btn-danger btn-sm" (click)="confirmDeleteDraft(sent.id)">Confirm delete</button>
                      <button type="button" class="btn btn-primary btn-sm" (click)="cancelDeleteDraft()">Cancel</button>
                    } @else {
                      <button type="button" class="btn btn-danger btn-sm" (click)="requestDeleteDraft(sent.id)">Delete</button>
                    }
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      }
      @if (!sendComplete()) {
        <div class="composer-options-strip">
          <div class="form-check form-switch mb-0">
            <input class="form-check-input" type="checkbox" role="switch" id="composition-shared"
                   [checked]="composeShared"
                   (change)="onSharedToggled($any($event.target).checked)">
            <label class="form-check-label ms-2" for="composition-shared">Other committee members can load, edit and send this email</label>
          </div>
        </div>
      }
      <div class="email-composer-action-bar">
        @if (!sendComplete()) {
          <div class="email-composer-toolbar">
            <button type="button" class="btn btn-quiet"
                    (click)="saveDraft()"
                    [disabled]="!hasContentToDraft()">
              <fa-icon [icon]="faFloppyDisk" class="me-1"/>Save as draft
            </button>
            @if (currentDraftId) {
              <button type="button" class="btn btn-quiet"
                      (click)="revertToSavedDraft()"
                      title="Discard unsaved changes and reload the last saved version of this draft">
                <fa-icon [icon]="faArrowRotateLeft" class="me-1"/>Revert
              </button>
            }
            <div class="btn-group" dropdown [container]="'body'">
              <button type="button" class="btn btn-quiet dropdown-toggle" dropdownToggle>
                <fa-icon [icon]="faFolderOpen" class="me-1"/>Show
              </button>
              <ul *dropdownMenu class="dropdown-menu" role="menu">
                <li role="menuitem">
                  <button type="button" class="dropdown-item" (click)="toggleDraftsPanel()">
                    <fa-icon [icon]="faFolderOpen" class="me-1"/>{{ draftsPanelOpen ? "Hide drafts" : "Drafts" }} ({{ drafts.length }})
                  </button>
                </li>
                <li role="menuitem">
                  <button type="button" class="dropdown-item" (click)="toggleSentEmailsPanel()">
                    <fa-icon [icon]="faPaperPlane" class="me-1"/>{{ sentEmailsPanelOpen ? "Hide sent" : "Sent" }} ({{ sentEmails.length }})
                  </button>
                </li>
              </ul>
            </div>
            <button type="button" class="btn btn-quiet" (click)="newComposition()" [disabled]="!hasContentToDraft()">
              <fa-icon [icon]="faFile" class="me-1"/>New
            </button>
          </div>
        }
        <div class="stepper-nav">
          @switch (stepperActiveTab) {
            @case (EmailComposerStepKey.TEMPLATE) {
              <button type="button" class="btn btn-quiet" (click)="cancel()"><fa-icon [icon]="faXmark"/> Cancel</button>
              <button type="button" class="btn btn-primary" (click)="goNext()" [disabled]="!templateStepValid()" [title]="templateStepValidationMessage()">
                Next <fa-icon [icon]="faArrowRight"/>
              </button>
            }
            @case (EmailComposerStepKey.RECIPIENTS) {
              <button type="button" class="btn btn-primary" (click)="goPrev()"><fa-icon [icon]="faArrowLeft"/> Back</button>
              <button type="button" class="btn btn-primary" (click)="goNext()" [disabled]="!recipientsStepValid() && state.brandingMode !== BrandingMode.UNBRANDED" [title]="recipientsStepValid() ? '' : recipientsStepValidationMessage()">
                Next <fa-icon [icon]="faArrowRight"/>
              </button>
            }
            @case (EmailComposerStepKey.COMPOSE) {
              <button type="button" class="btn btn-primary" (click)="goPrev()"><fa-icon [icon]="faArrowLeft"/> Back</button>
              <button type="button" class="btn btn-primary" (click)="goNext()" [disabled]="!composeStepValid() || !recipientsStepValid()" [title]="composeStepNextDisabledMessage()">
                Next <fa-icon [icon]="faArrowRight"/>
              </button>
            }
            @case (EmailComposerStepKey.EVENTS) {
              <button type="button" class="btn btn-primary" (click)="goPrev()"><fa-icon [icon]="faArrowLeft"/> Back</button>
              <button type="button" class="btn btn-primary" (click)="goNext()">Next <fa-icon [icon]="faArrowRight"/></button>
            }
            @case (EmailComposerStepKey.REVIEW) {
              <button type="button" class="btn btn-primary" (click)="goPrev()"><fa-icon [icon]="faArrowLeft"/> Back</button>
              <button type="button" class="btn btn-primary" (click)="goNext()">Next <fa-icon [icon]="faArrowRight"/></button>
            }
            @case (EmailComposerStepKey.SEND) {
              @if (sendComplete()) {
                <button type="button" class="btn btn-primary" (click)="newComposition()"><fa-icon [icon]="faFile"/> Start a new email</button>
                <button type="button" class="btn btn-quiet" (click)="closeAfterSend()"><fa-icon [icon]="faXmark"/> Close</button>
              } @else {
                <button type="button" class="btn btn-primary" (click)="goPrev()" [disabled]="sendInProgress"><fa-icon [icon]="faArrowLeft"/> Back</button>
                @if (sendConfirm.notificationsOutstanding()) {
                  <button type="button" class="btn btn-sunset"
                          (click)="confirmAndSend()"
                          [disabled]="sendInProgress">
                    <fa-icon [icon]="faPaperPlane"/> Confirm send
                  </button>
                  <button type="button" class="btn btn-quiet"
                          (click)="cancelSendConfirm()"
                          [disabled]="sendInProgress">
                    <fa-icon [icon]="faXmark"/> Cancel
                  </button>
                } @else {
                  <button type="button" class="btn btn-primary text-nowrap"
                          (click)="confirmAndSend()"
                          [disabled]="sendInProgress || sendDisabled() || hasSendBlockers()"
                          [title]="sendDisabledReason() || ('Send ' + sendingChannelLabel())">
                    <fa-icon [icon]="faPaperPlane"/> Send
                  </button>
                }
              }
            }
          }
        </div>
      </div>
      <div class="d-none">
        @for (fragment of state.fragmentOrder ?? []; track fragment.id) {
          @if (fragment.kind === ComposerFragmentKind.COMMITTEE_FILE) {
            <div [attr.data-fragment-id]="fragment.id" #committeeFileBlock>
              @for (file of committeeFilesFor(fragment); track file.id) {
                <app-committee-notification-ramblers-message-item [notificationItem]="committeeFileNotificationItemFor(file)">
                  @if (state.context?.sourcePagePath) {
                    <p style="margin: 4px 0 0 0;">Also available on our {{ systemConfig?.group?.shortName }}
                      <a [href]="absoluteSourcePageUrl()">{{ sourcePageTitleOrFallback() }}</a> page.
                    </p>
                  }
                  <table align="center" border="0" cellpadding="0" cellspacing="0"
                         style="border-collapse: collapse;width:100%;margin-top:12px;" width="100%">
                    <tbody><tr>
                      <td align="center" style="padding-top: 0;padding-bottom: 18px;" valign="top">
                        <table border="0" cellpadding="0" cellspacing="0"
                               style="border-collapse: separate !important;border-radius: 0px;background-color: #F9B104;"
                               width="100%">
                          <tbody><tr>
                            <td align="center"
                                style="font-family: Arial;font-size: 16px;padding: 12px;"
                                valign="middle">
                              <a [href]="committeeDisplayService.fileUrl(file, committeeFileLinkPath(file))"
                                 [title]="committeeFileDownloadLabel(file)"
                                 style="font-weight:bold;letter-spacing:normal;line-height:100%;text-align:center;text-decoration:none;color:#222222;display:block;">
                                {{ committeeFileDownloadLabel(file) }}
                              </a>
                            </td>
                          </tr></tbody>
                        </table>
                      </td>
                    </tr></tbody>
                  </table>
                </app-committee-notification-ramblers-message-item>
              }
            </div>
          }
        }
      </div>
      <div class="d-none" #eventsContent>
        @if ((state.eventInclusion === EventInclusionMode.AUTO_INCLUDE || state.eventInclusion === EventInclusionMode.SINGLE_EVENT) && synthesisedNotificationForCommittee()) {
          <app-committee-notification-details
            [notification]="synthesisedNotificationForCommittee()!"
            [members]="members"
            [sourcePagePath]="state.context?.sourcePagePath ?? ''"
            [sourcePageTitle]="state.context?.sourcePageTitle ?? ''"
            [betweenEventsDivider]="state.betweenEventsDivider"/>
        }
      </div>
      <div class="d-none">
        <ng-template app-notification-directive/>
      </div>
      </app-maximisable-panel>
    </app-page>

    <ng-template #recipientsStep>
      <div class="email-composer-section">
        @if (state.brandingMode !== BrandingMode.UNBRANDED) {
          <h3>Who is this email going to?</h3>
        }
        @if (state.brandingMode === BrandingMode.UNBRANDED) {
          <fieldset class="email-composer-fieldset">
            <legend>
              <button type="button" class="btn btn-link p-0 text-decoration-none fw-bold text-reset"
                      (click)="recipientsPanelExpanded = !recipientsPanelExpanded"
                      [attr.aria-expanded]="recipientsPanelExpanded">
                <fa-icon [icon]="recipientsPanelExpanded ? faChevronDown : faChevronRight" class="me-1"/>
                Who is this email going to?
              </button>
            </legend>
            @if (recipientsPanelExpanded) {
              <app-recipient-field
                [to]="state.externalRecipients" (toChange)="state.externalRecipients = $event"
                [cc]="state.ccRecipients" (ccChange)="state.ccRecipients = $event"
                [bcc]="state.bccRecipients" (bccChange)="state.bccRecipients = $event"
                [savedRecipients]="savedExternalRecipients"
                [(saveForReuse)]="newExternalSaveForReuse"/>
              @if (replyCcSuggestion.length > 0) {
                <app-alert-panel class="mt-2" title="Replying from a shared inbox">
                  Also Cc the other roles - <strong>{{ replyCcSuggestionLabel() }}</strong>?
                  <span alertActions>
                    <button type="button" class="btn btn-sm btn-primary" (click)="applyReplyCcSuggestion()">Cc these roles</button>
                    <button type="button" class="btn btn-sm btn-link text-decoration-none" (click)="replyCcSuggestion = []">Dismiss</button>
                  </span>
                </app-alert-panel>
              }
            } @else {
              <p class="text-muted small mb-0">{{ externalRecipientsSummaryLabel() }}</p>
            }
          </fieldset>
          <fieldset class="email-composer-fieldset mt-3">
            <legend>
              <button type="button" class="btn btn-link p-0 text-decoration-none fw-bold text-reset"
                      (click)="narrowMembersExpanded = !narrowMembersExpanded"
                      [attr.aria-expanded]="narrowMembersExpanded">
                <fa-icon [icon]="narrowMembersExpanded ? faChevronDown : faChevronRight" class="me-1"/>
                Also include some group members? (optional)
              </button>
            </legend>
            @if (narrowMembersExpanded) {
              <div class="row mb-2">
                <div class="col-sm-12">
                  <label>Limit to a mailing list:</label>
                  <div class="form-check">
                    <input class="form-check-input" type="radio" name="narrow-list-unbranded"
                           id="narrow-list-unbranded-any"
                           [checked]="state.narrowListId === null"
                           (change)="setNarrowListId(null)">
                    <label class="form-check-label" for="narrow-list-unbranded-any">Any member</label>
                  </div>
                  @for (list of nonEmptyLists(); track list.id) {
                    <div class="form-check">
                      <input class="form-check-input" type="radio" name="narrow-list-unbranded"
                             [id]="'narrow-list-unbranded-' + list.id"
                             [checked]="state.narrowListId === list.id"
                             (change)="setNarrowListId(list.id)">
                      <label class="form-check-label" [for]="'narrow-list-unbranded-' + list.id">
                        {{ list.name }}
                        <app-list-subscriber-count [list]="list" [members]="members"/>
                      </label>
                    </div>
                  }
                </div>
              </div>
              <app-member-multi-select
                [members]="candidateMembers()"
                [selectedIds]="state.selectedMemberIds"
                [preFilterKey]="state.preFilterKey"
                [notificationConfig]="state.notificationConfig"
                [memberBulkLoadDateMap]="memberBulkLoadDateMap"
                [requireConsent]="requiresConsent()"
                [respectBlocks]="respectsBlocks()"
                [unsubscribedDates]="unsubscribedMemberDates()"
                [lockedSelection]="!!forcedMemberId"
                [autoFill]="state.narrowListId !== null"
                [includeAlreadySent]="includeAlreadySent"
                (selectedIdsChange)="onSelectedMemberIdsChange($event)"
                (preFilterKeyChange)="onPreFilterKeyChange($event)"
                (priorSendExclusionsChange)="onPriorSendExclusionsChange($event)"/>
            } @else {
              <p class="text-muted small mb-0">Expand to also include group members.</p>
            }
          </fieldset>
        } @else if (forcedMemberId) {
          <div class="row mb-3">
            <div class="col-sm-12">
              <p class="mb-0">
                <fa-icon [icon]="faAddressCard" class="me-2"/>
                <strong>Single member</strong> - this email will be sent individually to
                <strong>{{ forcedMemberLabel() }}</strong>. To send to more people,
                <button type="button" class="btn btn-link p-0 align-baseline" (click)="clearForcedMember()">choose recipients</button>.
              </p>
            </div>
          </div>
        } @else {
          @if (showRecipientSourceRadios()) {
            <div class="row mb-3">
              <div class="col-sm-12">
                <div class="form-check">
                  <input id="mode-list" type="radio" class="form-check-input" name="recipient-mode"
                         [checked]="state.recipientMode === RecipientMode.ENTIRE_LIST"
                         (change)="setRecipientMode(RecipientMode.ENTIRE_LIST)">
                  <label class="form-check-label" for="mode-list">
                    <strong>A whole mailing list</strong> - one email sent to the entire list
                  </label>
                </div>
                <div class="form-check">
                  <input id="mode-selected" type="radio" class="form-check-input" name="recipient-mode"
                         [checked]="state.recipientMode === RecipientMode.SELECTED_MEMBERS"
                         (change)="setRecipientMode(RecipientMode.SELECTED_MEMBERS)">
                  <label class="form-check-label" for="mode-selected">
                    <strong>Specific members</strong> - sent individually to each person you choose
                  </label>
                </div>
              </div>
            </div>
          }
          @if (state.recipientMode === RecipientMode.ENTIRE_LIST) {
            <div class="row">
              <div class="col-sm-12">
                <label>Choose a list:</label>
                @for (list of nonEmptyLists(); track list.id) {
                  <div class="form-check">
                    <input class="form-check-input"
                           type="radio"
                           [id]="'send-list-' + list.id"
                           name="send-list"
                           [checked]="state.selectedListId === list.id"
                           (change)="selectList(list)"
                           [value]="list.id"/>
                    <label class="form-check-label" [for]="'send-list-' + list.id">
                      {{ list.name }}
                      <app-list-subscriber-count [list]="list" [members]="members"/>
                    </label>
                  </div>
                }
              </div>
            </div>
          } @else {
            <div class="row mb-2">
              <div class="col-sm-12">
                <label>Limit to a mailing list:</label>
                <div class="form-check">
                  <input class="form-check-input" type="radio" name="narrow-list"
                         id="narrow-list-any"
                         [checked]="state.narrowListId === null"
                         (change)="setNarrowListId(null)">
                  <label class="form-check-label" for="narrow-list-any">Any member</label>
                </div>
                @for (list of nonEmptyLists(); track list.id) {
                  <div class="form-check">
                    <input class="form-check-input" type="radio" name="narrow-list"
                           [id]="'narrow-list-' + list.id"
                           [checked]="state.narrowListId === list.id"
                           (change)="setNarrowListId(list.id)">
                    <label class="form-check-label" [for]="'narrow-list-' + list.id">
                      {{ list.name }}
                      <app-list-subscriber-count [list]="list" [members]="members"/>
                    </label>
                  </div>
                }
              </div>
            </div>
            <app-member-multi-select
              [members]="candidateMembers()"
              [selectedIds]="state.selectedMemberIds"
              [preFilterKey]="state.preFilterKey"
              [notificationConfig]="state.notificationConfig"
              [memberBulkLoadDateMap]="memberBulkLoadDateMap"
              [requireConsent]="requiresConsent()"
              [respectBlocks]="respectsBlocks()"
              [unsubscribedDates]="unsubscribedMemberDates()"
              [includeAlreadySent]="includeAlreadySent"
              (selectedIdsChange)="onSelectedMemberIdsChange($event)"
              (preFilterKeyChange)="onPreFilterKeyChange($event)"
              (priorSendExclusionsChange)="onPriorSendExclusionsChange($event)"/>
          }
        }
        @if (recipientsStepErrors().length === 0 && totalRecipientCount() > 0) {
          <div class="row recipients-summary-row">
            <div class="col-sm-12">
              <div class="alert alert-success mb-0">
                <fa-icon [icon]="faCheckCircle" class="me-2"/>
                <strong>Recipients chosen:</strong> {{ recipientCountSummary() }}
              </div>
            </div>
          </div>
        }
      </div>
    </ng-template>

    <ng-template #templateStep>
      <div class="email-composer-section">
        <h3>Sender &amp; Template</h3>
        <p class="text-muted small mb-3">Pick the email type (which determines the visual template, banner and any built-in content), then choose who the email is from, who replies should go to, and which committee roles sign off.</p>
        <fieldset class="email-composer-fieldset">
          <legend>Style</legend>
          <div>
            <div class="branding-mode-options">
              @for (option of brandingModeOptions; track option.key) {
                <div class="form-check branding-mode-option">
                  <input class="form-check-input" type="radio" [id]="'branding-' + option.key" name="branding-mode"
                         [checked]="state.brandingMode === option.key"
                         (change)="setBrandingMode(option.key)">
                  <label class="form-check-label" [for]="'branding-' + option.key">
                    <strong>{{ option.label }}</strong><span class="text-muted small">{{ EM_DASH_WITH_SPACES }}{{ option.hint }}</span>
                  </label>
                </div>
              }
            </div>
          </div>
        </fieldset>
        @if (templateStepErrors().length > 0) {
          <div class="email-composer-validation-summary">
            <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>Before you can continue:</h5>
            <ul class="list-arrow">
              @for (error of templateStepErrors(); track $index) {
                <li>
                  @if (isPlainError(error)) {
                    {{ error }}
                  } @else {
                    <span>{{ error.before }}</span><a [routerLink]="error.linkRouterLink"
                                                      [queryParams]="error.linkQueryParams"
                                                      [target]="error.linkTarget ?? null">{{ error.linkText }}</a>@if (error.after) {
                      <span>{{ error.after }}</span>
                    }
                  }
                </li>
              }
            </ul>
          </div>
        }
        @if (state.notificationConfigListing && state.brandingMode !== BrandingMode.UNBRANDED) {
          <fieldset class="email-composer-fieldset">
            <legend>Email type &amp; visual template</legend>
            <app-notification-config-selector
              (emailConfigChanged)="onEmailConfigChanged($event)"
              [notificationConfig]="state.notificationConfig"
              [notificationConfigListing]="state.notificationConfigListing"
              [showBranding]="true"/>
          </fieldset>
        }
        @if (state.notificationConfig && state.brandingMode !== BrandingMode.UNBRANDED) {
          <fieldset class="email-composer-fieldset">
            <legend>Sender, reply-to and sign-off</legend>
            <p class="text-muted small mb-2">Defaults come from the email type. Click <strong>Select All As Me</strong> to use yourself for all three.</p>
            <app-sender-replies-and-sign-off
              [mailMessagingConfig]="mailMessagingConfig"
              [notificationConfig]="state.notificationConfig"
              [signOffRolesOverride]="state.signoffRoles"
              (signOffRolesOverrideChange)="state.signoffRoles = $event"
              [allowSelectAllAsMe]="true"
              (senderExists)="senderExists = $event"
              (rolesChanged)="onSignoffRolesChanged()"/>
          </fieldset>
        }
        @if (state.brandingMode === BrandingMode.UNBRANDED) {
          @let roleOptions = unbrandedRoleOptions();
          @let senderInfo = unbrandedSenderInfo();
          @if (senderInfo.email) {
            @if (roleOptions.length > 1) {
              <fieldset class="email-composer-fieldset">
                <legend>Send from which committee role?</legend>
                <p class="text-muted small mb-2">You are linked to more than one role - pick which identity recipients should see.</p>
                <select class="form-select" [ngModel]="resolvedUnbrandedRole()?.type"
                        (ngModelChange)="onUnbrandedSenderRoleChange($event)">
                  @for (role of roleOptions; track role.type) {
                    <option [ngValue]="role.type">{{ role.description }} - {{ role.fullName || '—' }} &lt;{{ role.email }}&gt;</option>
                  }
                </select>
              </fieldset>
            }
            <div class="alert alert-success">
              <fa-icon [icon]="faCheckCircle" class="me-2"/>
              <strong>Sender:</strong> Unbranded emails will go from your <strong>{{ senderInfo.description }}</strong> role ({{ senderInfo.name }} &lt;{{ senderInfo.email }}&gt;). Sign off the email however you like in the body.
            </div>
          }
        }
      </div>
    </ng-template>

    <ng-template #composeStep>
      <div class="email-composer-section">
        <h3>Compose your email</h3>
        @if (pendingForwardedHeaderLines.length > 0 || unbrandedListSendBlocked() || showUnbrandedListSendWarning()) {
          <div class="email-composer-validation-summary">
            @if (pendingForwardedHeaderLines.length > 0) {
              <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>Forwarded email detected:</h5>
              <ul class="list-arrow">
                <li>Recipients and subject were extracted from the headers below and placed in the Recipients step and Subject field.</li>
                <li>The original sender details have been re-inserted into the body between two horizontal rules - edit or remove them in the editor below if you do not want them included.</li>
                <li>Type your own reply above the first rule.</li>
              </ul>
              <button type="button" class="btn btn-primary btn-sm mt-2 mb-3" (click)="dismissForwardedHeaderOffer()">
                <fa-icon [icon]="faXmark"/> Dismiss
              </button>
            }
            @if (unbrandedListSendBlocked()) {
              <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>Unbranded sends to more than {{ UNBRANDED_HARD_CAP_RECIPIENTS }} recipients are blocked:</h5>
              <ul class="list-arrow">
                <li>This send is for {{ totalRecipientCount() }} recipients - at this volume PECR and GDPR require the unsubscribe link and sender identity that only the Branded format includes. Unbranded omits both.</li>
                <li>Switch to Branded mode to continue, or reduce the recipient count.</li>
              </ul>
              <button type="button" class="btn btn-primary btn-sm mt-2" (click)="switchToBrandedFromWarning()">
                <fa-icon [icon]="faArrowRotateLeft"/> Switch to Branded
              </button>
            } @else if (showUnbrandedListSendWarning()) {
              <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>This looks like a broadcast rather than a one-to-one reply:</h5>
              <ul class="list-arrow">
                <li>Branded format includes the unsubscribe link and sender identity that PECR and GDPR require for marketing-style sends to a list. Unbranded omits both, so it is best kept for replies and one-to-few correspondence.</li>
                @for (reason of unbrandedListSendWarningReasons(); track reason) {
                  <li>{{ reason }}</li>
                }
              </ul>
              <div class="d-flex flex-wrap gap-2 mt-2">
                <button type="button" class="btn btn-primary btn-sm" (click)="switchToBrandedFromWarning()">
                  <fa-icon [icon]="faArrowRotateLeft"/> Switch to Branded
                </button>
                <button type="button" class="btn btn-primary btn-sm" (click)="dismissUnbrandedListSendWarning()">
                  <fa-icon [icon]="faXmark"/> Dismiss
                </button>
              </div>
            }
          </div>
        }
        @let composeUnbrandedNoRecipients = state.brandingMode === BrandingMode.UNBRANDED && !recipientsStepValid();
        @if (composeUnbrandedNoRecipients || composeStepErrors().length > 0) {
          <div class="email-composer-validation-summary">
            <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>Before you can continue:</h5>
            <ul class="list-arrow">
              @if (composeUnbrandedNoRecipients) {
                <li>Paste a forwarded email (with <code>To:</code>, <code>Cc:</code>, <code>Subject:</code> headers) into the body below and the addresses and subject will be picked up automatically, or go back to the Recipients step to add them by hand.</li>
              }
              @for (error of composeStepErrors(); track error) { <li>{{ error }}</li> }
            </ul>
          </div>
        }
        <fieldset class="email-composer-fieldset">
          <legend>Subject</legend>
          <div>
            <label for="email-subject">Subject line</label>
            <input id="email-subject" type="text" class="form-control" [(ngModel)]="state.subject"
                   [class.is-invalid]="!state.subject?.trim()"
                   placeholder="Enter the subject as it will appear in inboxes"/>
            @if (!state.subject?.trim()) {
              <small class="text-danger">Subject line is required</small>
            }
          </div>
        </fieldset>

        <fieldset class="email-composer-fieldset">
          <legend>Salutation</legend>
          <label>Greeting</label>
          <div>
            @for (option of addresseeOptions; track option.key) {
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" [id]="'addressee-' + option.key" name="addressee-type"
                       [checked]="state.addresseeType === option.key"
                       (change)="state.addresseeType = option.key">
                <label class="form-check-label" [for]="'addressee-' + option.key">{{ option.label }}</label>
              </div>
            }
          </div>
        </fieldset>

        <fieldset class="email-composer-fieldset">
          <legend>Sections</legend>
          <p class="text-muted small mb-2">Drag sections to reorder. Use multi-column rows to place sections side by side.</p>
          <ng-container *ngTemplateOutlet="fragmentListTemplate; context: { $implicit: state.fragmentOrder, parentPath: [] }"/>
          <div class="composer-add-row">
            <div class="btn-group" dropdown>
              <button type="button" class="btn btn-sm btn-quiet dropdown-toggle" dropdownToggle>
                <fa-icon [icon]="faPlus" class="me-1"/>Add section
              </button>
              <ul *dropdownMenu class="dropdown-menu" role="menu">
                <li role="menuitem">
                  <button type="button" class="dropdown-item" [disabled]="hasFragmentKindAtTopLevel(ComposerFragmentKind.INTRO)" (click)="addIntroFragment()">
                    <fa-icon [icon]="faPlus" class="me-2"/>Intro
                  </button>
                </li>
                @if (state.brandingMode !== BrandingMode.UNBRANDED) {
                  <li role="menuitem">
                    <button type="button" class="dropdown-item" (click)="addArticleFragment([])">
                      <fa-icon [icon]="faPlus" class="me-2"/>Article block
                    </button>
                  </li>
                  <li role="menuitem">
                    <button type="button" class="dropdown-item" [disabled]="hasFragmentKindAtTopLevel(ComposerFragmentKind.EVENTS)" (click)="addEventsFragment()">
                      <fa-icon [icon]="faPlus" class="me-2"/>Events
                    </button>
                  </li>
                }
                <li role="menuitem">
                  <button type="button" class="dropdown-item" [disabled]="hasFragmentKindAtTopLevel(ComposerFragmentKind.SIGNOFF)" (click)="addSignoffFragment()">
                    <fa-icon [icon]="faPlus" class="me-2"/>Signoff
                  </button>
                </li>
                <li role="menuitem">
                  <button type="button" class="dropdown-item" (click)="onAddCommitteeFileFragmentClicked()">
                    <fa-icon [icon]="faFile" class="me-2"/>Committee file
                  </button>
                </li>
                <li role="menuitem">
                  <button type="button" class="dropdown-item" (click)="addDividerFragment([])">
                    <fa-icon [icon]="faPlus" class="me-2"/>Divider
                  </button>
                </li>
                @if (state.brandingMode !== BrandingMode.UNBRANDED) {
                  <li class="dropdown-divider"></li>
                  <li role="menuitem">
                    <button type="button" class="dropdown-item" (click)="addMultiColumnFragment(2)">
                      <fa-icon [icon]="faTableColumns" class="me-2"/>2-column row
                    </button>
                  </li>
                  <li role="menuitem">
                    <button type="button" class="dropdown-item" (click)="addMultiColumnFragment(3)">
                      <fa-icon [icon]="faTableColumns" class="me-2"/>3-column row
                    </button>
                  </li>
                }
              </ul>
            </div>
          </div>
        </fieldset>

        @if (!composeStepValid()) {
          <div class="text-danger mt-2 mb-0 stepper-nav-reason"><small>{{ composeStepValidationMessage() }}</small></div>
        }
      </div>
    </ng-template>

    <ng-template #fragmentListTemplate let-fragments let-parentPath="parentPath">
      <div class="fragment-list">
        @for (fragment of fragments; let i = $index; track fragment.id + ':' + i) {
          <div class="fragment-row"
               [class.fragment-row-hover-before]="isDragHover(parentPath.concat([i])) && dragHoverPosition === DragHoverPosition.Before"
               [class.fragment-row-hover-after]="isDragHover(parentPath.concat([i])) && dragHoverPosition === DragHoverPosition.After"
               (dragover)="onFragmentDragOver(parentPath.concat([i]), $event)"
               (drop)="onFragmentDrop(parentPath.concat([i]))">
            <div class="fragment-row-header" [attr.draggable]="true"
                 (dragstart)="onFragmentDragStart(parentPath.concat([i]), $event)"
                 (dragend)="onFragmentDragEnd()"
                 [class.fragment-row-header-clickable]="fragmentIsExpandable(fragment) || fragment.kind === ComposerFragmentKind.EVENTS || fragment.kind === ComposerFragmentKind.TEMPLATE_CONTENT"
                 (click)="(fragmentIsExpandable(fragment) || fragment.kind === ComposerFragmentKind.EVENTS || fragment.kind === ComposerFragmentKind.TEMPLATE_CONTENT) && toggleFragmentExpanded(fragment.id)">
              <span class="fragment-handle" title="Drag to reorder this section">
                <fa-icon [icon]="faGripVertical"/>
              </span>
              <span class="fragment-icon">
                @switch (fragment.kind) {
                  @case (ComposerFragmentKind.INTRO) { <fa-icon [icon]="faAlignLeft"/> }
                  @case (ComposerFragmentKind.ARTICLE) { <fa-icon [icon]="faAddressCard"/> }
                  @case (ComposerFragmentKind.EVENTS) { <fa-icon [icon]="faCalendarDays"/> }
                  @case (ComposerFragmentKind.SIGNOFF) { <fa-icon [icon]="faSignature"/> }
                  @case (ComposerFragmentKind.TEMPLATE_CONTENT) { <fa-icon [icon]="faCircleInfo"/> }
                  @case (ComposerFragmentKind.MULTI_COLUMN) { <fa-icon [icon]="faTableColumns"/> }
                  @case (ComposerFragmentKind.DIVIDER) { <fa-icon [icon]="faGripLines"/> }
                  @case (ComposerFragmentKind.COMMITTEE_FILE) { <fa-icon [icon]="faFile"/> }
                }
              </span>
              <div class="fragment-meta">
                <div class="fragment-label">{{ fragmentLabel(fragment) }}</div>
                <div class="fragment-preview text-muted small">{{ fragmentPreview(fragment) }}</div>
              </div>
              @if (fragmentIsExpandable(fragment)) {
                <span class="fragment-chevron"
                      [title]="isFragmentExpanded(fragment.id) ? 'Collapse' : 'Expand'">
                  <fa-icon [icon]="isFragmentExpanded(fragment.id) ? faChevronDown : faChevronRight"/>
                </span>
              }
              @if (fragment.kind !== ComposerFragmentKind.TEMPLATE_CONTENT) {
                <button type="button" class="btn btn-sm btn-danger"
                        (click)="$event.stopPropagation(); removeFragment(parentPath.concat([i]))"
                        title="Remove section">
                  <fa-icon [icon]="faTrash"/>
                </button>
              }
            </div>
            <div class="fragment-divider-cell" (click)="$event.stopPropagation()">
              <app-section-divider-select [label]="fragment.kind === ComposerFragmentKind.DIVIDER ? 'Style' : 'Divider after'"
                                          [value]="fragment.dividerAfter"
                                          (valueChange)="onFragmentDividerChange(parentPath.concat([i]), $event)"/>
            </div>
            @if (isFragmentExpanded(fragment.id)) {
              <div class="fragment-row-body">
                @switch (fragment.kind) {
                  @case (ComposerFragmentKind.INTRO) {
                    <app-tiptap-markdown-editor #introEditor
                                                [value]="state.introMarkdown"
                                                (valueChange)="onIntroMarkdownChange($event)"
                                                (rawPaste)="onIntroRawPaste($event)"
                                                placeholder="Write your message here…"
                                                stickyToolbar
                                                [showMergeFields]="true"/>
                  }
                  @case (ComposerFragmentKind.SIGNOFF) {
                    <app-tiptap-markdown-editor [value]="state.signoffTextMarkdown"
                                                (valueChange)="state.signoffTextMarkdown = $event"
                                                placeholder="Sign off…"
                                                [showMergeFields]="true"/>
                  }
                  @case (ComposerFragmentKind.ARTICLE) {
                    @let block = findArticleBlock(fragment.id);
                    @if (block) {
                      <app-article-block-single-editor [block]="block"
                                                       [showRemove]="false"
                                                       (blockChange)="onSingleArticleBlockChange($event)"/>
                    } @else {
                      <div class="text-danger small">Article block not found.</div>
                    }
                  }
                  @case (ComposerFragmentKind.EVENTS) {
                    <div class="fragment-events-summary">
                      @if (selectedGroupEventCount() === 0) {
                        <div class="text-muted small">No events selected. Choose events on the <a href="javascript:void(0)" (click)="goToStep(3)">Events step</a>.</div>
                      } @else {
                        <ul class="list-unstyled mb-0 small">
                          @for (event of selectedGroupEventsList(); track event.id) {
                            <li>
                              <strong>{{ event.eventDate | displayDate }}</strong>
                              @if (event.eventTime) { <span> &bull; {{ event.eventTime }}</span> }
                              <span> &bull; {{ event.title }}</span>
                            </li>
                          }
                        </ul>
                        <div class="text-muted small mt-1">Edit the list on the <a href="javascript:void(0)" (click)="goToStep(3)">Events step</a>.</div>
                      }
                      <app-section-divider-select label="Divider between consecutive events"
                                                  [value]="state.betweenEventsDivider"
                                                  (valueChange)="onBetweenEventsDividerChange($event)"/>
                    </div>
                  }
                  @case (ComposerFragmentKind.COMMITTEE_FILE) {
                    <div class="fragment-committee-file">
                      @let files = committeeFilesFor(fragment);
                      @if (files.length > 0) {
                        <ul class="list-unstyled mb-2 small">
                          @for (file of files; track file.id) {
                            <li class="d-flex align-items-center justify-content-between gap-2 py-1">
                              <span>
                                <strong>{{ file.fileType }}</strong>
                                <span> - {{ committeeDisplayService.fileTitle(file) }}</span>
                                <a class="ms-2" [href]="committeeDisplayService.fileUrl(file, committeeFileLinkPath(file))" target="_blank">{{ committeeFileDownloadFilename(file) }}</a>
                              </span>
                              <button type="button" class="btn btn-sm btn-danger"
                                      [title]="'Remove ' + committeeDisplayService.fileTitle(file)"
                                      (click)="onCommitteeFileIdsChanged(fragment, (fragment.committeeFileIds ?? []).filter(id => id !== file.id))">
                                <fa-icon [icon]="faTrash"/>
                              </button>
                            </li>
                          }
                        </ul>
                      }
                      @let unresolved = unresolvedCommitteeFileIdsFor(fragment);
                      @if (unresolved.length > 0) {
                        <div class="text-danger small mb-2">
                          Couldn't find committee file{{ unresolved.length === 1 ? '' : 's' }}:
                          @for (missingId of unresolved; track missingId) { <code class="ms-1">{{ missingId }}</code> }
                        </div>
                      }
                      <div class="row g-2 align-items-end">
                        <div class="col-md-12">
                          <label class="form-label small mb-1">Filter by page URL <span class="text-muted">(optional - narrows the dropdown to files on that page)</span>:</label>
                          <app-site-link-input cssClass="form-control form-control-sm"
                                               placeholder="Pick a site page to filter committee files"
                                               [value]="committeeFileUrlInput"
                                               (valueChange)="onCommitteeFileUrlChanged($event)"/>
                        </div>
                      </div>
                      @if (committeeFileUrlError) {
                        <div class="text-danger small mt-1">{{ committeeFileUrlError }}</div>
                      }
                      <div class="row g-2 align-items-end mt-2">
                        <div class="col-md-12">
                          <label class="form-label small mb-1">Choose committee files:</label>
                          <app-committee-file-multi-select placeholder="Search committee files..."
                                                           [value]="fragment.committeeFileIds ?? []"
                                                           [allowedFileIds]="committeeFileUrlAllowedIds"
                                                           (valueChange)="onCommitteeFileIdsChanged(fragment, $event)"
                                                           (filesLoaded)="onPickerFilesLoaded($event)"/>
                        </div>
                      </div>
                      @if (files.length === 0 && unresolved.length === 0) {
                        <div class="text-muted small mt-2">Pick one or more committee files from the dropdown, optionally narrowing them by typing a page URL above.</div>
                      }
                    </div>
                  }
                  @case (ComposerFragmentKind.TEMPLATE_CONTENT) {
                    <div class="fragment-template-content">
                      @if (state.notificationConfig?.body) {
                        <div class="text-muted small mb-2">Read-only preview of this email's content. Edit it under Mail Settings &rarr; Email Configurations.</div>
                        <app-tiptap-markdown-editor [value]="state.notificationConfig.body"
                                                    [editable]="false"
                                                    [showMergeFields]="true"
                                                    [constrainToEmailWidth]="true"/>
                      } @else if (templateContentFetching) {
                        <div class="text-muted small"><fa-icon [icon]="faSpinner" animation="spin"/> Loading template content…</div>
                      } @else if (templateContentError) {
                        <div class="text-danger small">{{ templateContentError }}</div>
                      } @else if (templateContentHtml) {
                        <div class="text-muted small mb-2">Read-only preview of the template body.</div>
                        <iframe class="fragment-template-frame" [srcdoc]="templateContentHtml"></iframe>
                      } @else {
                        <div class="text-muted small">Choose a template on the Sender &amp; Template step to preview its content here.</div>
                      }
                    </div>
                  }
                  @case (ComposerFragmentKind.MULTI_COLUMN) {
                    <div class="composer-multi-column-row">
                      @for (column of fragment.columns ?? []; let columnIndex = $index; track columnIndex) {
                        <div class="composer-column"
                             [class.composer-column-hover]="isColumnDragHover(parentPath.concat([i, columnIndex]))">
                          <div class="composer-column-heading text-muted small">Column {{ columnIndex + 1 }}</div>
                          <ng-container *ngTemplateOutlet="fragmentListTemplate; context: { $implicit: column, parentPath: parentPath.concat([i, columnIndex]) }"/>
                          <div class="composer-column-tail"
                               (dragover)="onColumnDragOver(parentPath.concat([i, columnIndex]), $event)"
                               (drop)="onColumnDrop(parentPath.concat([i, columnIndex]))">
                            Drop section here
                          </div>
                          <div class="composer-column-add">
                            <button type="button" class="btn btn-sm btn-primary"
                                    (click)="addArticleFragment(parentPath.concat([i, columnIndex]))">
                              <fa-icon [icon]="faPlus"/> Add article to column
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  }
                }
              </div>
            }
          </div>
        }
        <div class="fragment-list-tail"
             (dragover)="onColumnDragOver(parentPath, $event)"
             (drop)="onColumnDrop(parentPath)"
             [class.fragment-list-tail-hover]="isColumnDragHover(parentPath)"></div>
      </div>
    </ng-template>

    <ng-template #eventsStep>
      <div class="email-composer-section">
        <h3>Events</h3>
        <ng-container *ngTemplateOutlet="eventsSection"/>
      </div>
    </ng-template>

    <ng-template #eventsSection>
      <div class="row mb-3">
        <div class="col-sm-12">
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="event-inclusion" id="event-inclusion-none"
                   [checked]="state.eventInclusion === EventInclusionMode.NONE"
                   (change)="setEventInclusionMode(EventInclusionMode.NONE)">
            <label class="form-check-label" for="event-inclusion-none">No events</label>
          </div>
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="event-inclusion" id="event-inclusion-auto"
                   [checked]="state.eventInclusion === EventInclusionMode.AUTO_INCLUDE"
                   (change)="setEventInclusionMode(EventInclusionMode.AUTO_INCLUDE)">
            <label class="form-check-label" for="event-inclusion-auto">Auto-include from date range</label>
          </div>
          @if (state.singleEvent) {
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="event-inclusion" id="event-inclusion-single"
                     [checked]="state.eventInclusion === EventInclusionMode.SINGLE_EVENT"
                     (change)="setEventInclusionMode(EventInclusionMode.SINGLE_EVENT)">
              <label class="form-check-label" for="event-inclusion-single">This event only ({{ state.singleEvent?.groupEvent?.title }})</label>
            </div>
          }
        </div>
      </div>
      @if (state.eventInclusion === EventInclusionMode.AUTO_INCLUDE && state.groupEventsFilter) {
        <ng-container *ngTemplateOutlet="autoIncludeUi"/>
      } @else if (state.eventInclusion === EventInclusionMode.SINGLE_EVENT && state.singleEvent) {
        <ng-container *ngTemplateOutlet="singleEventUi"/>
      }
    </ng-template>

    <ng-template #singleEventUi>
      <div class="row mb-3">
        <div class="col-sm-12">
          <p class="mb-2">Sending notification about <strong>{{ state.singleEvent?.groupEvent?.title }}</strong>. Switch to <em>Auto-include from date range</em> if you'd like to add more events.</p>
          @if (state.groupEventsFilter) {
            <label class="form-label mt-2"><strong>Include information:</strong></label>
            <div class="d-flex flex-wrap gap-3">
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="single-include-description"
                       [(ngModel)]="state.groupEventsFilter.includeDescription">
                <label class="form-check-label" for="single-include-description">Description</label>
              </div>
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="single-include-location"
                       [(ngModel)]="state.groupEventsFilter.includeLocation">
                <label class="form-check-label" for="single-include-location">Location</label>
              </div>
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="single-include-contact"
                       [(ngModel)]="state.groupEventsFilter.includeContact">
                <label class="form-check-label" for="single-include-contact">Contact</label>
              </div>
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="single-include-image"
                       [(ngModel)]="state.groupEventsFilter.includeImage">
                <label class="form-check-label" for="single-include-image">Image</label>
              </div>
            </div>
          }
        </div>
      </div>
    </ng-template>

    <ng-template #autoIncludeUi>
      <div class="row mb-3">
        <div class="col-sm-12">
          <strong class="me-3">Date range input:</strong>
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="date-input-mode" id="date-input-slider"
                   [checked]="dateInputMode === DateInputMode.Slider"
                   (change)="setDateInputMode(DateInputMode.Slider)">
            <label class="form-check-label" for="date-input-slider">Slider</label>
          </div>
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="date-input-mode" id="date-input-pickers"
                   [checked]="dateInputMode === DateInputMode.Pickers"
                   (change)="setDateInputMode(DateInputMode.Pickers)">
            <label class="form-check-label" for="date-input-pickers">Individual dates</label>
          </div>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-sm-4">
          <label for="date-range-preset">Quick range:</label>
          <ng-select id="date-range-preset"
                     [items]="dateRangePresetItems"
                     bindLabel="label"
                     [clearable]="false"
                     [searchable]="false"
                     [(ngModel)]="selectedDateRangePreset"
                     (ngModelChange)="onDateRangePresetChange($event)"/>
        </div>
        @if (dateInputMode === DateInputMode.Slider) {
          <div class="col-sm-8 d-flex align-items-end">
            <app-date-range-slider class="w-100"
              [minDate]="eventSliderMinDate"
              [maxDate]="eventSliderMaxDate"
              [range]="eventSliderRange()"
              (rangeChange)="onEventDateRangeChange($event)"/>
          </div>
        } @else {
          <div class="col-sm-4">
            <label for="from-date">Include events from:</label>
            <app-date-picker startOfDay id="from-date" [size]="'md round'"
                             (change)="onFromDateChange($event)"
                             [value]="state.groupEventsFilter!.fromDate"/>
          </div>
          <div class="col-sm-4">
            <label for="to-date">Include events to:</label>
            <app-date-picker startOfDay id="to-date" [size]="'md round'"
                             (change)="onToDateChange($event)"
                             [value]="state.groupEventsFilter!.toDate"/>
          </div>
        }
      </div>
      <div class="row mb-3">
        <div class="col-sm-12 d-flex flex-wrap flex-md-nowrap align-items-center">
          <strong class="me-2 text-nowrap">Include information:</strong>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="user-events-show-description"
                   [(ngModel)]="state.groupEventsFilter!.includeDescription"
                   (ngModelChange)="populateGroupEvents()">
            <label class="form-check-label" for="user-events-show-description">Description</label>
          </div>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="user-events-show-location"
                   [(ngModel)]="state.groupEventsFilter!.includeLocation"
                   (ngModelChange)="populateGroupEvents()">
            <label class="form-check-label" for="user-events-show-location">Location</label>
          </div>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="user-events-show-contact"
                   [(ngModel)]="state.groupEventsFilter!.includeContact"
                   (ngModelChange)="populateGroupEvents()">
            <label class="form-check-label" for="user-events-show-contact">Contact</label>
          </div>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="user-events-show-image"
                   [(ngModel)]="state.groupEventsFilter!.includeImage"
                   (ngModelChange)="populateGroupEvents()">
            <label class="form-check-label" for="user-events-show-image">Image</label>
          </div>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-sm-12 d-flex flex-wrap flex-md-nowrap align-items-center">
          <strong class="me-2 text-nowrap">Include event types:</strong>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="include-walks"
                   [(ngModel)]="state.groupEventsFilter!.includeWalks"
                   (ngModelChange)="populateGroupEvents()">
            <label class="form-check-label" for="include-walks">Walks</label>
          </div>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="include-social"
                   [(ngModel)]="state.groupEventsFilter!.includeSocialEvents"
                   (ngModelChange)="populateGroupEvents()">
            <label class="form-check-label" for="include-social">Social events</label>
          </div>
          <div class="form-check form-check-inline text-nowrap">
            <input type="checkbox" class="form-check-input" id="include-committee"
                   [(ngModel)]="state.groupEventsFilter!.includeCommitteeEvents"
                   (ngModelChange)="populateGroupEvents()">
            <label class="form-check-label" for="include-committee">Committee events</label>
          </div>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-sm-12">
          @if (state.groupEvents.length > 0) {
            <div class="form-check mb-2">
              <input class="form-check-input" type="checkbox" id="select-all"
                     [(ngModel)]="state.groupEventsFilter!.selectAll"
                     (click)="toggleSelectAllGroupEvents()">
              <label class="form-check-label" for="select-all">
                <strong>Select / deselect all</strong> -
                {{ selectedGroupEventCount() }} of
                {{ stringUtils.pluraliseWithCount(state.groupEvents.length, "event") }}
              </label>
            </div>
            <ul class="list-unstyled events-scroll">
              @for (event of state.groupEvents; let idx = $index; track event.id) {
                <li class="mb-2 event-row">
                  <div class="event-meta">
                    <div class="form-check">
                      <input type="checkbox" class="form-check-input"
                             [id]="'event-' + idx"
                             [(ngModel)]="event.selected">
                      <label class="form-check-label" [for]="'event-' + idx">
                        <strong>{{ event.eventDate | displayDate }}</strong>
                        @if (event.eventTime) { <span> &bull; {{ event.eventTime }}</span> }
                        &bull; {{ event?.eventType?.description }}
                        &bull;
                        <app-link [area]="event?.eventType?.area" [id]="event?.slug || event?.id" [text]="event?.title"></app-link>
                        @if (event.distance) { <span> &bull; {{ event.distance }}</span> }
                        @if (state.groupEventsFilter!.includeContact && event.contactName) {
                          <span> &bull; <a [href]="event.contactHref"
                                            [target]="event.contactHref?.startsWith('http') ? '_blank' : '_self'">{{ event.contactName || event.contactEmail }}</a></span>
                        }
                        @if (state.groupEventsFilter!.includeLocation && event.postcode) {
                          <span> &bull; <a [href]="googleMapsService.urlForPostcode(event.postcode)" target="_blank">{{ event.postcode }}</a></span>
                        }
                      </label>
                    </div>
                    @if (state.groupEventsFilter!.includeDescription && event.description) {
                      <div markdown [data]="event.description" class="ms-4 small text-muted"></div>
                    }
                  </div>
                  @if (state.groupEventsFilter!.includeImage && event.image) {
                    <div class="event-image">
                      <img [src]="urlService.imageSource(event.image, true)" [alt]="event.title || ''"/>
                      @if ((event.media?.length ?? 0) > 1) {
                        <div class="event-image-controls">
                          <button type="button" class="btn btn-primary"
                                  (click)="cycleEventMedia(event, -1)">
                            <fa-icon [icon]="faArrowLeft"/>
                          </button>
                          <span class="small text-muted">{{ (event.selectedMediaIndex ?? 0) + 1 }} of {{ event.media?.length }}</span>
                          <button type="button" class="btn btn-primary"
                                  (click)="cycleEventMedia(event, 1)">
                            <fa-icon [icon]="faArrowRight"/>
                          </button>
                        </div>
                      }
                    </div>
                  }
                </li>
              }
            </ul>
          } @else {
            <div class="text-muted">No events found in the current date range.</div>
          }
        </div>
      </div>
    </ng-template>

    <ng-template #reviewStep>
      <div class="email-composer-section">
        <h3>Preview &amp; review</h3>
        <ul class="mb-3">
          <li>Sending mode: <strong>{{ sendingChannelLabel() }}</strong></li>
          <li>Recipients: <strong>{{ recipientCountSummary() }}</strong></li>
          @if (state.recipientMode === RecipientMode.SELECTED_MEMBERS) {
            <li>Estimated send time: <strong>{{ estimatedSendTime() }}</strong></li>
          }
        </ul>
        @if (campaignQueueNotice(); as notice) {
          <div class="email-composer-validation-summary">
            <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>{{ notice.title }}</h5>
            <ul class="list-arrow">
              <li>{{ notice.message }}</li>
            </ul>
          </div>
        }
        <div class="d-flex flex-wrap align-items-center mb-3" style="gap: 0.5rem;">
          <button type="button" class="btn btn-primary" (click)="refreshPreview()">Refresh preview</button>
          <div class="btn-group" role="group" aria-label="Step through recipients">
            <button type="button" class="btn btn-primary"
                    [disabled]="!canStepPreview(PreviewStepDirection.First)"
                    (click)="stepPreview(PreviewStepDirection.First)" title="First recipient">
              <fa-icon [icon]="faAngleDoubleLeft"/>
            </button>
            <button type="button" class="btn btn-primary"
                    [disabled]="!canStepPreview(PreviewStepDirection.Prev)"
                    (click)="stepPreview(PreviewStepDirection.Prev)" title="Previous recipient">
              <fa-icon [icon]="faAngleLeft"/>
            </button>
            <button type="button" class="btn btn-primary"
                    [disabled]="!canStepPreview(PreviewStepDirection.Next)"
                    (click)="stepPreview(PreviewStepDirection.Next)" title="Next recipient">
              <fa-icon [icon]="faAngleRight"/>
            </button>
            <button type="button" class="btn btn-primary"
                    [disabled]="!canStepPreview(PreviewStepDirection.Last)"
                    (click)="stepPreview(PreviewStepDirection.Last)" title="Last recipient">
              <fa-icon [icon]="faAngleDoubleRight"/>
            </button>
          </div>
          <span class="text-muted small">{{ previewRecipientLabel() }}</span>
        </div>
        <div class="row">
          <div class="col-sm-12">
            <app-email-preview #emailPreview/>
          </div>
        </div>
      </div>
    </ng-template>

    <ng-template #sendStep>
      <div class="email-composer-section">
        <h3>Send</h3>
        @if (campaignQueueNotice(); as notice) {
          <div class="email-composer-validation-summary">
            <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>{{ notice.title }}</h5>
            <ul class="list-arrow">
              <li>{{ notice.message }}</li>
            </ul>
          </div>
        }
        @if (unbrandedListSendBlocked() || showUnbrandedListSendWarning() || subjectStartsWithCopyOf() || subjectUnchangedFromDefault()) {
          <div class="email-composer-validation-summary">
            @if (unbrandedListSendBlocked()) {
              <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>Unbranded sends to more than {{ UNBRANDED_HARD_CAP_RECIPIENTS }} recipients are blocked:</h5>
              <ul class="list-arrow">
                <li>This send is for {{ totalRecipientCount() }} recipients - at this volume PECR and GDPR require the unsubscribe link and sender identity that only the Branded format includes. Unbranded omits both.</li>
                <li>Switch to Branded mode to continue, or reduce the recipient count.</li>
              </ul>
              <button type="button" class="btn btn-primary btn-sm mt-2" (click)="switchToBrandedFromWarning()">
                <fa-icon [icon]="faArrowRotateLeft"/> Switch to Branded
              </button>
            } @else if (showUnbrandedListSendWarning()) {
              <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>This looks like a broadcast rather than a one-to-one reply:</h5>
              <ul class="list-arrow">
                <li>Branded format includes the unsubscribe link and sender identity that PECR and GDPR require for marketing-style sends to a list. Unbranded omits both, so it is best kept for replies and one-to-few correspondence.</li>
                @for (reason of unbrandedListSendWarningReasons(); track reason) {
                  <li>{{ reason }}</li>
                }
              </ul>
              <div class="d-flex flex-wrap gap-2 mt-2">
                <button type="button" class="btn btn-primary btn-sm" (click)="switchToBrandedFromWarning()">
                  <fa-icon [icon]="faArrowRotateLeft"/> Switch to Branded
                </button>
                <button type="button" class="btn btn-primary btn-sm" (click)="dismissUnbrandedListSendWarning()">
                  <fa-icon [icon]="faXmark"/> Dismiss
                </button>
              </div>
            }
            @if (subjectStartsWithCopyOf()) {
              <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>Subject still says "Copy of …":</h5>
              <ul class="list-arrow">
                <li>Update the subject line on the <a href="javascript:void(0)" (click)="goToCompose()">Compose step</a> before sending so recipients don't see "Copy of …".</li>
              </ul>
              <button type="button" class="btn btn-primary btn-sm mt-2" (click)="goToCompose()">
                <fa-icon [icon]="faArrowLeft"/> Go and fix
              </button>
            }
            @if (subjectUnchangedFromDefault()) {
              <h5><fa-icon [icon]="faTriangleExclamation" class="me-2"/>Subject still has the default title:</h5>
              <ul class="list-arrow">
                <li>The subject is still "{{ state.subject }}", the default for this email type, and hasn't been personalised. Edit it on the <a href="javascript:void(0)" (click)="goToCompose()">Compose step</a> if you meant to change it - you can still send as-is.</li>
              </ul>
              <button type="button" class="btn btn-primary btn-sm mt-2" (click)="goToCompose()">
                <fa-icon [icon]="faArrowLeft"/> Go and edit
              </button>
            }
          </div>
        }
        @if (sendInProgress) {
          <div class="email-composer-validation-summary">
            <h5><fa-icon [icon]="faSpinner" animation="spin" class="me-2"></fa-icon>Sending: in progress…</h5>
          </div>
        }
        @if (batchProgress) {
          <div class="row">
            <div class="col-sm-12">
              <div class="progress mb-2" style="height: 24px;">
                <div class="progress-bar"
                     role="progressbar"
                     [style.width.%]="batchProgressPercent()"
                     [ngClass]="batchProgressBarClass()">
                  {{ batchProgress.sentCount }} / {{ batchProgress.totalRecipients }}
                </div>
              </div>
              <div>
                Status: <strong>{{ batchProgress.status }}</strong>
                @if (batchProgress.failedCount > 0) {
                  <span class="ms-2 text-danger">
                    <fa-icon [icon]="faTriangleExclamation"/>
                    {{ batchProgress.failedCount }} failed
                  </span>
                }
                @if (batchProgress.skippedCount > 0) {
                  <span class="ms-2 text-warning">
                    <fa-icon [icon]="faTriangleExclamation"/>
                    {{ batchProgress.skippedCount }} skipped (unsubscribed or blocked)
                  </span>
                }
                @if (batchSendComplete()) {
                  <span class="ms-2 text-success">
                    <fa-icon [icon]="faCheckCircle"/>
                    Done
                  </span>
                }
              </div>
              @if (batchProgress.entries?.length > 0 && (batchProgress.failedCount > 0 || batchProgress.skippedCount > 0 || batchSendComplete())) {
                <details class="mt-2">
                  <summary>Per-recipient detail</summary>
                  <table class="table table-sm">
                    <thead>
                      <tr><th>Member</th><th>Email</th><th>Status</th><th>Notes</th></tr>
                    </thead>
                    <tbody>
                      @for (entry of batchProgress.entries; track entry.memberId) {
                        <tr>
                          <td>{{ entry.fullName }}</td>
                          <td>{{ entry.email || "no email address" }}</td>
                          <td>{{ entry.notEmailable ? "not emailable" : entry.status }}</td>
                          <td>{{ entry.errorMessage && entry.note ? (entry.errorMessage + " — " + entry.note) : (entry.note || entry.errorMessage || "") }}</td>
                        </tr>
                      }
                      @for (recipient of state.ccRecipients; track recipient.email) {
                        <tr>
                          <td>{{ recipient.name || "" }}</td>
                          <td>{{ recipient.email }}</td>
                          <td>cc</td>
                          <td>copied on every send above</td>
                        </tr>
                      }
                      @for (recipient of state.bccRecipients; track recipient.email) {
                        <tr>
                          <td>{{ recipient.name || "" }}</td>
                          <td>{{ recipient.email }}</td>
                          <td>bcc</td>
                          <td>blind copied on every send above</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </details>
              }
            </div>
          </div>
        }
      </div>
    </ng-template>
  `
})
export class EmailComposer implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("EmailComposer", NgxLoggerLevel.ERROR);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private notifierService = inject(NotifierService);
  protected mailMessagingService = inject(MailMessagingService);
  private mailService = inject(MailService);
  private mailListUpdaterService = inject(MailListUpdaterService);
  private listSubscriberService = inject(ListSubscriberService);
  private memberService = inject(MemberService);
  private memberBulkLoadAuditService = inject(MemberBulkLoadAuditService);
  private memberLoginService = inject(MemberLoginService);
  private changeDetector = inject(ChangeDetectorRef);
  private systemConfigService = inject(SystemConfigService);
  protected stringUtils = inject(StringUtilsService);
  protected dateUtils = inject(DateUtilsService);
  private rendering = inject(EmailComposerRenderingService);
  private sendService = inject(EmailComposerSendService);
  private inboxReplyHandoff = inject(InboxReplyHandoffService);
  private externalRecipientService = inject(ExternalRecipientService);
  private committeeQueryService = inject(CommitteeQueryService);
  private committeeFileService = inject(CommitteeFileService);
  protected committeeDisplayService = inject(CommitteeDisplayService);
  private mediaQueryService = inject(MediaQueryService);
  private pageService = inject(PageService);
  private pageContentService = inject(PageContentService);
  private walksAndEventsService = inject(WalksAndEventsService);
  protected googleMapsService = inject(GoogleMapsService);
  protected urlService = inject(UrlService);
  private compositionsService = inject(EmailCompositionsService);
  private scheduledTaskService = inject(ScheduledTaskService);

  @ViewChild("emailPreview") emailPreview!: EmailPreviewComponent;
  @ViewChild("eventsContent") eventsContent!: ElementRef<HTMLDivElement>;
  @ViewChildren("committeeFileBlock") committeeFileBlocks!: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChild(Stepper) stepperRef!: Stepper;
  @ViewChild(NotificationDirective) notificationDirective!: NotificationDirective;

  protected state: EmailComposerState = defaultEmailComposerState();
  protected stepperActiveTab: EmailComposerStepKey = EmailComposerStepKey.TEMPLATE;
  protected previewRecipientIndex = 0;
  private autoPreviewPending = false;
  protected stepperSteps = EMAIL_COMPOSER_STEPS;
  protected addresseeOptions = ADDRESSEE_OPTIONS;
  protected mailMessagingConfig: MailMessagingConfig | null = null;
  protected systemConfig: SystemConfig | null = null;
  protected committeeReferenceData: CommitteeReferenceData | null = null;
  protected committeeFiles: Map<string, CommitteeFile> = new Map();
  protected allCommitteeFiles: CommitteeFile[] = [];
  protected committeeFileUrlInput = "";
  protected committeeFileUrlError: string | null = null;
  protected committeeFileUrlAllowedIds: string[] | null = null;
  protected members: Member[] = [];
  protected allMembers: Member[] = [];
  protected memberBulkLoadDateMap: MemberBulkLoadDateMap | null = null;
  protected senderExists = false;
  protected forcedConfigId: string | null = null;
  protected forcedConfigSlug: string | null = null;
  protected forcedMemberId: string | null = null;
  protected currentDraftId: string | null = null;
  protected currentComposition: EmailComposition | null = null;
  protected drafts: EmailCompositionSummary[] = [];
  protected sentEmails: EmailCompositionSummary[] = [];
  protected savedExternalRecipients: ExternalRecipient[] = [];
  protected loggedInMemberRecord: Member | null = null;
  protected newExternalSaveForReuse = true;
  protected replyCcSuggestion: ComposerExternalRecipient[] = [];
  protected draftsPanelOpen = false;
  protected sentEmailsPanelOpen = false;
  protected composeShared = false;
  protected lastSavedAt: number | null = null;
  protected sendInProgress = false;
  protected campaignSendComplete = false;
  private automaticCampaignReleaseTaskEnabled: boolean | null = null;
  protected unbrandedListSendWarningDismissed = false;
  protected readonly UNBRANDED_HARD_CAP_RECIPIENTS = UNBRANDED_HARD_CAP_RECIPIENTS;
  protected readonly UNBRANDED_LIST_SEND_WARNING_THRESHOLD = UNBRANDED_LIST_SEND_WARNING_THRESHOLD;
  protected batchProgress: BatchSendProgress | null = null;
  protected batchSendJobId: string | null = null;
  protected postSendActionWarningDismissed = false;
  protected notifyTarget: AlertTarget = {};
  private notify!: AlertInstance;
  private subscriptions: Subscription[] = [];
  private pollSubscription: Subscription | null = null;

  protected readonly EmailComposerStepKey = EmailComposerStepKey;
  protected readonly RecipientMode = RecipientMode;
  protected readonly EventInclusionMode = EventInclusionMode;
  protected readonly ComposerFragmentKind = ComposerFragmentKind;
  protected readonly DateInputMode = DateInputMode;
  protected readonly DragHoverPosition = DragHoverPosition;
  protected readonly PreviewStepDirection = PreviewStepDirection;
  protected readonly BrandingMode = BrandingMode;
  protected readonly brandingModeOptions = BRANDING_MODE_OPTIONS;
  protected readonly EM_DASH_WITH_SPACES = EM_DASH_WITH_SPACES;
  protected readonly faSpinner = faSpinner;
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faArrowRight = faArrowRight;
  protected readonly faArrowRotateLeft = faArrowRotateLeft;
  protected readonly faAngleDoubleLeft = faAngleDoubleLeft;
  protected readonly faAngleLeft = faAngleLeft;
  protected readonly faAngleRight = faAngleRight;
  protected readonly faAngleDoubleRight = faAngleDoubleRight;
  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faXmark = faXmark;
  protected readonly faExpand = faExpand;
  protected readonly faCompress = faCompress;
  protected readonly faFloppyDisk = faFloppyDisk;
  protected readonly faFolderOpen = faFolderOpen;
  protected readonly faFile = faFile;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faGripVertical = faGripVertical;
  protected readonly faAlignLeft = faAlignLeft;
  protected readonly faAddressCard = faAddressCard;
  protected readonly faSignature = faSignature;
  protected readonly faTableColumns = faTableColumns;
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronRight = faChevronRight;
  public inboxReplyContext: InboxReplyOutboundContext | null = null;
  private turndownService = new TurndownService({headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced"});
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly faPlus = faPlus;
  protected readonly faTrash = faTrash;
  protected readonly faGripLines = faGripLines;

  async ngOnInit(): Promise<void> {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    void this.loadSavedExternalRecipients();
    void this.loadLoggedInMemberRecord();
    void this.loadCampaignReleaseTaskState();
    this.subscriptions.push(this.route.queryParamMap.subscribe((paramMap: ParamMap) => {
      void this.applyContextFromRoute(paramMap, this.route.snapshot.paramMap);
      this.applyUrlStateToComposer(paramMap);
      void this.applyCompositionFromRoute(paramMap);
    }));
    this.subscriptions.push(this.mailMessagingService.events().subscribe(config => {
      this.mailMessagingConfig = config;
      this.committeeReferenceData = config.committeeReferenceData as CommitteeReferenceData;
      if (this.forcedConfigSlug) {
        this.forcedConfigId = this.resolveConfigIdFromSlug(this.forcedConfigSlug);
      }
      this.state.notificationConfigListing = {
        mailMessagingConfig: config,
        includeWorkflowRelatedConfigs: false,
        forceIncludeConfigIds: this.forcedConfigId ? [this.forcedConfigId] : []
      };
      this.autoSelectNotificationConfig();
      this.applyDefaultListIfNeeded();
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.systemConfig = systemConfig;
    }));
    this.allMembers = await this.memberService.privilegedFields();
    this.members = this.allMembers.filter(this.memberService.filterFor.GROUP_MEMBERS);
    try {
      this.memberBulkLoadDateMap = await this.memberBulkLoadAuditService.createMemberBulkLoadDateMap();
    } catch (error) {
      this.logger.warn("could not load memberBulkLoadDateMap:", error);
      this.memberBulkLoadDateMap = null;
    }
    await this.refreshDrafts();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.pollSubscription?.unsubscribe();
  }

  private async applyContextFromRoute(queryParams: ParamMap, pathParams: ParamMap): Promise<void> {
    const slug = queryParams.get(StoredValue.CONFIG_ID);
    this.forcedConfigSlug = slug;
    this.forcedConfigId = this.resolveConfigIdFromSlug(slug);
    const memberParam = queryParams.get(StoredValue.MEMBER);
    if (memberParam) {
      this.forcedMemberId = memberParam;
    }
    const sourcePage = queryParams.get(StoredValue.SOURCE_PAGE);
    const committeeFile = queryParams.get(StoredValue.COMMITTEE_FILE);
    const eventQuery = queryParams.get(StoredValue.EVENT);
    const eventPath = pathParams.get("committee-event-id");
    if (eventQuery && !committeeFile && !sourcePage) {
      this.state.context = { source: EmailComposerContextSource.GROUP_EVENT, groupEventId: eventQuery };
      this.state.eventInclusion = EventInclusionMode.SINGLE_EVENT;
      this.ensureGroupEventsFilter();
      await this.loadSingleEvent(eventQuery);
    } else if (committeeFile || sourcePage || eventPath) {
      this.state.context = {
        source: EmailComposerContextSource.COMMITTEE,
        committeeFileSlug: committeeFile ?? undefined,
        sourcePagePath: sourcePage ?? undefined,
        groupEventId: eventPath ?? undefined
      };
      if (committeeFile) {
        this.state.eventInclusion = EventInclusionMode.NONE;
        await this.loadAllCommitteeFiles();
        const matched = this.allCommitteeFiles.find(file => this.committeeDisplayService.committeeFileSlug(file) === committeeFile);
        if (matched) {
          this.ensureCommitteeFileFragmentForIds([matched.id]);
          await this.resolveCommitteeFiles(this.allFragmentCommitteeFileIds());
        } else {
          this.logger.warn("applyContextFromRoute:no committee file matched slug:", committeeFile);
        }
      } else {
        this.state.eventInclusion = EventInclusionMode.AUTO_INCLUDE;
        this.ensureGroupEventsFilter();
        await this.populateGroupEvents();
      }
    } else {
      this.state.context = { source: EmailComposerContextSource.ADMIN };
      this.state.eventInclusion = EventInclusionMode.NONE;
    }
  }

  private routeCompositionKey: string | null = null;

  private async applyCompositionFromRoute(queryParams: ParamMap): Promise<void> {
    const draftId = queryParams.get(StoredValue.DRAFT_ID);
    const copyOfId = queryParams.get(StoredValue.COPY_OF);
    const key = draftId ? `draft:${draftId}` : copyOfId ? `copy-of:${copyOfId}` : null;
    if (key === this.routeCompositionKey) {
      return;
    }
    this.routeCompositionKey = key;
    if (draftId) {
      await this.loadDraft(draftId);
    } else if (copyOfId) {
      await this.useAsTemplate(copyOfId);
    }
  }

  private ensureGroupEventsFilter(): void {
    if (this.state.groupEventsFilter) return;
    const today = this.dateUtils.dateTimeNowNoTime();
    this.state.groupEventsFilter = {
      search: null,
      selectAll: true,
      fromDate: this.dateUtils.asDateValue(today.toMillis()),
      toDate: this.dateUtils.asDateValue(today.plus({ weeks: 2 }).toMillis()),
      includeImage: true,
      includeContact: true,
      includeDescription: true,
      includeLocation: true,
      includeWalks: true,
      includeSocialEvents: true,
      includeCommitteeEvents: true
    };
    this.recomputeSliderBoundsFromCurrentRange();
    this.selectedDateRangePreset = this.matchPresetToCurrentRange();
  }

  private async loadSingleEvent(eventId: string): Promise<void> {
    const event = await this.queryEventByIdSafely(eventId);
    this.state.singleEvent = event;
    if (event && !this.state.subject) {
      this.state.subject = event.groupEvent?.title ?? this.state.subject;
    }
    this.state.groupEvents = event ? [this.eventToSummary(event)] : [];
  }

  private async queryEventByIdSafely(eventId: string): Promise<ExtendedGroupEvent | null> {
    try {
      return await this.walksAndEventsService.queryById(eventId);
    } catch (error) {
      this.logger.error("queryEventByIdSafely failed", error);
      return null;
    }
  }

  private eventToSummary(event: ExtendedGroupEvent): GroupEventSummary {
    return {
      id: event.id || event?.groupEvent?.id,
      ramblersEventType: event?.groupEvent?.item_type || RamblersEventType.GROUP_WALK,
      slug: this.stringUtils.lastItemFrom(event?.groupEvent?.url || this.stringUtils.kebabCase(event?.groupEvent?.title)),
      selected: true,
      eventType: this.committeeDisplayService.groupEventType(event),
      eventDate: event?.groupEvent?.start_date_time
        ? this.dateUtils.asDateTime(event.groupEvent.start_date_time).toMillis()
        : null,
      eventTime: event?.groupEvent?.start_date_time
        ? this.dateUtils.asString(event.groupEvent.start_date_time, undefined, this.dateUtils.formats.displayTime)
        : null,
      location: (event?.groupEvent?.start_location || event?.groupEvent?.location)?.description,
      postcode: (event?.groupEvent?.start_location || event?.groupEvent?.location)?.postcode,
      title: event?.groupEvent?.title || "Awaiting " + this.stringUtils.asTitle(event?.groupEvent?.item_type ?? "event") + " details",
      description: event?.groupEvent?.description,
      contactName: event?.fields?.contactDetails?.displayName,
      contactPhone: event?.fields?.contactDetails?.phone,
      contactEmail: event?.fields?.contactDetails?.email,
      image: this.mediaQueryService.imageUrlFrom(event?.groupEvent),
      media: event?.groupEvent?.media ?? [],
      selectedMediaIndex: 0
    } as GroupEventSummary;
  }

  private async loadAllCommitteeFiles(): Promise<void> {
    try {
      this.allCommitteeFiles = await this.committeeFileService.all();
    } catch (error) {
      this.logger.error("loadAllCommitteeFiles failed", error);
      this.allCommitteeFiles = [];
    }
  }

  protected onPickerFilesLoaded(files: CommitteeFile[]): void {
    this.allCommitteeFiles = files ?? [];
    void this.resolveCommitteeFiles(this.allFragmentCommitteeFileIds());
  }

  private async resolveCommitteeFiles(ids: string[]): Promise<void> {
    this.committeeFiles = new Map();
    if (!ids?.length || !this.allCommitteeFiles?.length) return;
    const wanted = new Set(ids);
    for (const file of this.allCommitteeFiles) {
      if (wanted.has(file.id)) {
        this.committeeFiles.set(file.id, file);
      }
    }
    const missing = ids.filter(id => !this.committeeFiles.has(id));
    if (missing.length > 0) {
      this.logger.warn("resolveCommitteeFiles:no files found for ids:", missing);
    }
    await this.resolveCommitteeFilePagePaths(ids);
  }

  private committeeFilePagePathById = new Map<string, string>();

  private async resolveCommitteeFilePagePaths(ids: string[]): Promise<void> {
    const unresolved = ids.filter(id => !this.committeeFilePagePathById.has(id));
    if (unresolved.length === 0) {
      return;
    }
    try {
      const pages: PageContent[] = await this.pageContentService.all({
        criteria: {"rows.committeeDocuments.fileIds": {$in: unresolved}}
      });
      pages.forEach(page => (page.rows ?? []).forEach(row => (row.committeeDocuments?.fileIds ?? []).forEach(fileId => {
        if (unresolved.includes(fileId) && !this.committeeFilePagePathById.has(fileId)) {
          this.committeeFilePagePathById.set(fileId, page.path);
        }
      })));
    } catch (error) {
      this.logger.warn("resolveCommitteeFilePagePaths failed for ids:", unresolved, error);
    }
  }

  protected committeeFileLinkPath(file: CommitteeFile): string {
    return this.state.context?.sourcePagePath || this.committeeFilePagePathById.get(file.id) || "";
  }

  private async resolveCommitteeFileLinksForSend(): Promise<void> {
    const ids = this.allFragmentCommitteeFileIds();
    if (ids.length > 0) {
      if (this.allCommitteeFiles.length === 0) {
        await this.loadAllCommitteeFiles();
      }
      await this.resolveCommitteeFiles(ids);
      this.changeDetector.detectChanges();
    }
    const unresolved = ids
      .map(id => this.committeeFiles.get(id))
      .filter((file): file is CommitteeFile => !!file)
      .filter(file => this.committeeDisplayService.isComposedDocument(file) && !this.committeeFileLinkPath(file));
    if (unresolved.length > 0) {
      const titles = unresolved.map(file => this.committeeDisplayService.fileTitle(file)).join(", ");
      const isPlural = unresolved.length > 1;
      throw new Error(`This email links to a committee ${isPlural ? "documents" : "document"} (${titles}) that ${isPlural ? "aren't" : "isn't"} published on any committee page yet, so there's no web address for the email to point to. Add ${isPlural ? "them" : "it"} to a committee documents page, or remove ${isPlural ? "them" : "it"} from the email.`);
    }
  }

  private allFragmentCommitteeFileIds(): string[] {
    const collect = (list: ComposerFragment[]): string[] => list.flatMap(fragment => {
      if (fragment.kind === ComposerFragmentKind.COMMITTEE_FILE) return fragment.committeeFileIds ?? [];
      if (fragment.kind === ComposerFragmentKind.MULTI_COLUMN) return (fragment.columns ?? []).flatMap(column => collect(column));
      return [];
    });
    return Array.from(new Set(collect(this.state.fragmentOrder ?? [])));
  }

  protected hasCommitteeFileFragment(): boolean {
    return this.hasFragmentKindAtTopLevel(ComposerFragmentKind.COMMITTEE_FILE);
  }

  protected ensureCommitteeFileFragmentForIds(ids: string[]): void {
    this.ensureFragmentOrder();
    const list = this.state.fragmentOrder ?? [];
    const existing = list.find(f => f.kind === ComposerFragmentKind.COMMITTEE_FILE);
    if (existing) {
      const merged = Array.from(new Set([...(existing.committeeFileIds ?? []), ...ids]));
      existing.committeeFileIds = merged;
      this.state.fragmentOrder = [...list];
      return;
    }
    const introIdx = list.findIndex(f => f.kind === ComposerFragmentKind.INTRO);
    const insertAt = introIdx >= 0 ? introIdx + 1 : 0;
    const newFragment: ComposerFragment = {
      kind: ComposerFragmentKind.COMMITTEE_FILE,
      id: this.stringUtils.kebabCase(`committee-file-${this.dateUtils.dateTimeNow().toMillis()}`),
      dividerAfter: SectionDividerStyle.THIN_YELLOW,
      committeeFileIds: [...ids]
    };
    this.state.fragmentOrder = [...list.slice(0, insertAt), newFragment, ...list.slice(insertAt)];
  }

  protected addCommitteeFileFragment(): void {
    this.ensureFragmentOrder();
    const newFragment: ComposerFragment = {
      kind: ComposerFragmentKind.COMMITTEE_FILE,
      id: this.stringUtils.kebabCase(`committee-file-${this.dateUtils.dateTimeNow().toMillis()}`),
      dividerAfter: SectionDividerStyle.THIN_YELLOW,
      committeeFileIds: []
    };
    this.insertAboveSignoffAtTopLevel(newFragment);
    this.expandedFragmentIds.add(newFragment.id);
  }

  protected async onAddCommitteeFileFragmentClicked(): Promise<void> {
    if (this.allCommitteeFiles.length === 0) {
      await this.loadAllCommitteeFiles();
    }
    this.addCommitteeFileFragment();
  }

  protected committeeFilesFor(fragment: ComposerFragment): CommitteeFile[] {
    const ids = fragment.committeeFileIds ?? [];
    return ids
      .map(id => this.committeeFiles.get(id))
      .filter((file): file is CommitteeFile => !!file);
  }

  protected unresolvedCommitteeFileIdsFor(fragment: ComposerFragment): string[] {
    return (fragment.committeeFileIds ?? []).filter(id => !this.committeeFiles.has(id));
  }

  protected committeeFileNotificationItemFor(file: CommitteeFile): NotificationItem {
    const fileType = (file.fileType ?? "").trim();
    const title = this.committeeDisplayService.fileTitle(file);
    const subject = fileType ? `${fileType} - ${title}` : title;
    return { callToAction: null, image: null, subject, text: "" };
  }

  protected committeeFileDownloadLabel(file: CommitteeFile): string {
    const fileType = (file.fileType ?? "").trim();
    const action = this.committeeDisplayService.isComposedDocument(file) ? "View" : "Download";
    return fileType ? `${action} ${fileType}` : action;
  }

  protected committeeFileDownloadFilename(file: CommitteeFile): string {
    return file.fileNameData?.originalFileName || file.fileNameData?.awsFileName || file.document?.title || "";
  }

  protected onCommitteeFileIdsChanged(fragment: ComposerFragment, ids: string[]): void {
    fragment.committeeFileIds = isArray(ids) ? Array.from(new Set(ids)) : [];
    this.state.fragmentOrder = [...(this.state.fragmentOrder ?? [])];
    void this.resolveCommitteeFiles(this.allFragmentCommitteeFileIds());
  }

  protected async onCommitteeFileUrlChanged(value: string): Promise<void> {
    this.committeeFileUrlInput = value ?? "";
    this.committeeFileUrlError = null;
    const path = this.normaliseSiteLinkPath(this.committeeFileUrlInput);
    if (!path) {
      this.committeeFileUrlAllowedIds = null;
      return;
    }
    try {
      const page = await this.pageContentService.findByPath(path);
      const ids = this.collectCommitteeFileIdsFromPage(page);
      if (ids.length === 0) {
        this.committeeFileUrlAllowedIds = [];
        this.committeeFileUrlError = `${path} doesn't list any committee files`;
        return;
      }
      this.committeeFileUrlAllowedIds = ids;
    } catch (error) {
      this.logger.error("onCommitteeFileUrlChanged failed", error);
      this.committeeFileUrlAllowedIds = null;
      this.committeeFileUrlError = `Couldn't load page at ${path}`;
    }
  }

  private normaliseSiteLinkPath(value: string): string | null {
    const trimmed = (value ?? "").trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed) || trimmed.includes("://")) {
      try {
        const url = new URL(trimmed);
        return url.pathname.replace(/^\/+/, "");
      } catch {
        return null;
      }
    }
    return trimmed.replace(/^\/+/, "");
  }

  private collectCommitteeFileIdsFromPage(page: PageContent | null | undefined): string[] {
    if (!page?.rows) return [];
    const ids = new Set<string>();
    for (const row of page.rows) {
      const fileIds = row?.committeeDocuments?.fileIds;
      if (fileIds?.length) {
        fileIds.forEach(id => ids.add(id));
      }
    }
    return Array.from(ids);
  }

  protected absoluteSourcePageUrl(): string {
    const path = this.state.context?.sourcePagePath;
    if (!path) return "";
    return this.urlService.baseUrl() + "/" + path;
  }

  protected sourcePageTitleOrFallback(): string {
    const explicit = this.state.context?.sourcePageTitle;
    if (explicit) return explicit;
    const path = this.state.context?.sourcePagePath;
    if (!path) return "";
    return this.pageService.titleFromPath(path);
  }

  async populateGroupEvents(): Promise<void> {
    if (this.state.eventInclusion !== EventInclusionMode.AUTO_INCLUDE) return;
    if (!this.state.groupEventsFilter) {
      this.ensureGroupEventsFilter();
    }
    try {
      const events = await this.committeeQueryService.groupEvents(this.state.groupEventsFilter!);
      const priorById = new Map(this.state.groupEvents.map(item => [item.id, item]));
      this.state.groupEvents = events.map(event => this.mergePriorSelection(event, priorById.get(event.id)));
    } catch (error) {
      this.logger.error("populateGroupEvents failed", error);
    }
  }

  setEventInclusionMode(mode: EventInclusionMode): void {
    this.state.eventInclusion = mode;
    if (mode === EventInclusionMode.AUTO_INCLUDE) {
      this.resetGroupEventsFilterToDefaultRange();
      void this.populateGroupEvents();
    } else if (mode === EventInclusionMode.SINGLE_EVENT && this.state.singleEvent) {
      this.state.groupEvents = [this.eventToSummary(this.state.singleEvent)];
    }
    this.syncStateToUrl({ [StoredValue.EVENT_INCLUSION]: mode });
  }

  private resetGroupEventsFilterToDefaultRange(): void {
    const today = this.dateUtils.dateTimeNowNoTime();
    this.state.groupEventsFilter = {
      search: null,
      selectAll: true,
      fromDate: this.dateUtils.asDateValue(today.toMillis()),
      toDate: this.dateUtils.asDateValue(today.plus({ weeks: 2 }).toMillis()),
      includeImage: this.state.groupEventsFilter?.includeImage ?? true,
      includeContact: this.state.groupEventsFilter?.includeContact ?? true,
      includeDescription: this.state.groupEventsFilter?.includeDescription ?? true,
      includeLocation: this.state.groupEventsFilter?.includeLocation ?? true,
      includeWalks: this.state.groupEventsFilter?.includeWalks ?? true,
      includeSocialEvents: this.state.groupEventsFilter?.includeSocialEvents ?? true,
      includeCommitteeEvents: this.state.groupEventsFilter?.includeCommitteeEvents ?? true
    };
    this.recomputeSliderBoundsFromCurrentRange();
    this.selectedDateRangePreset = this.matchPresetToCurrentRange();
  }

  onFromDateChange(dateValue: DateValue): void {
    if (!this.state.groupEventsFilter) return;
    this.state.groupEventsFilter.fromDate = dateValue;
    this.selectedDateRangePreset = this.matchPresetToCurrentRange();
    this.syncStateToUrl({ [StoredValue.DATE_FROM]: dateValue?.value?.toString() ?? null });
    void this.populateGroupEvents();
  }

  onToDateChange(dateValue: DateValue): void {
    if (!this.state.groupEventsFilter) return;
    this.state.groupEventsFilter.toDate = dateValue;
    this.selectedDateRangePreset = this.matchPresetToCurrentRange();
    this.syncStateToUrl({ [StoredValue.DATE_TO]: dateValue?.value?.toString() ?? null });
    void this.populateGroupEvents();
  }

  protected dateInputMode: DateInputMode = DateInputMode.Slider;
  protected eventSliderMinDate: DateTime = this.dateUtils.dateTimeNow().startOf("day").minus({ months: 3 });
  protected eventSliderMaxDate: DateTime = this.dateUtils.dateTimeNow().startOf("day").plus({ years: 2 });

  protected setDateInputMode(mode: DateInputMode): void {
    this.dateInputMode = mode;
    if (mode === DateInputMode.Slider) {
      this.recomputeSliderBoundsFromCurrentRange();
    }
  }

  protected eventSliderRange(): DateRange | null {
    const filter = this.state.groupEventsFilter;
    if (!filter?.fromDate?.value || !filter?.toDate?.value) return null;
    return { from: filter.fromDate.value, to: filter.toDate.value };
  }

  onEventDateRangeChange(range: DateRange): void {
    if (!this.state.groupEventsFilter) return;
    this.state.groupEventsFilter.fromDate = this.dateUtils.asDateValue(range.from);
    this.state.groupEventsFilter.toDate = this.dateUtils.asDateValue(range.to);
    this.selectedDateRangePreset = this.matchPresetToCurrentRange();
    this.syncStateToUrl({
      [StoredValue.DATE_FROM]: range.from.toString(),
      [StoredValue.DATE_TO]: range.to.toString()
    });
    void this.populateGroupEvents();
  }

  private rescaleSliderToRange(fromMillis: number, toMillis: number): void {
    const span = Math.max(toMillis - fromMillis, 24 * 60 * 60 * 1000);
    const padding = Math.max(span * 0.25, 24 * 60 * 60 * 1000);
    this.eventSliderMinDate = this.dateUtils.asDateTime(fromMillis - padding).startOf("day");
    this.eventSliderMaxDate = this.dateUtils.asDateTime(toMillis + padding).startOf("day");
  }

  private recomputeSliderBoundsFromCurrentRange(): void {
    const filter = this.state.groupEventsFilter;
    if (!filter?.fromDate?.value || !filter?.toDate?.value) return;
    this.rescaleSliderToRange(filter.fromDate.value, filter.toDate.value);
  }

  protected dateRangePresetOptions: AdvancedSearchPreset[] = [
    createFuturePreset("Next 7 days", { days: 7 }),
    createFuturePreset("Next 14 days", { days: 14 }),
    createFuturePreset("Next 30 days", { days: 30 }),
    createFuturePreset("Next 3 months", { months: 3 }),
    createFuturePreset("Next 6 months", { months: 6 }),
    createPastPreset("Past 30 days", { days: 30 }),
    createPastPreset("Past 3 months", { months: 3 }),
    createAllTimePreset(
      "All upcoming",
      this.dateUtils.dateTimeNow().startOf("day"),
      this.dateUtils.dateTimeNow().plus({ years: 2 }).endOf("day")
    )
  ];

  protected customDateRangePreset: AdvancedSearchPreset = {
    label: "Custom",
    range: () => ({
      from: this.state.groupEventsFilter?.fromDate?.value ?? this.dateUtils.dateTimeNow().startOf("day").toMillis(),
      to: this.state.groupEventsFilter?.toDate?.value ?? this.dateUtils.dateTimeNow().startOf("day").toMillis()
    })
  };

  protected dateRangePresetItems: AdvancedSearchPreset[] = [...this.dateRangePresetOptions, this.customDateRangePreset];

  protected selectedDateRangePreset: AdvancedSearchPreset | null = null;

  onDateRangePresetChange(preset: AdvancedSearchPreset | null): void {
    if (!preset || !this.state.groupEventsFilter) return;
    if (preset === this.customDateRangePreset) return;
    const range = preset.range();
    this.state.groupEventsFilter.fromDate = this.dateUtils.asDateValue(range.from);
    this.state.groupEventsFilter.toDate = this.dateUtils.asDateValue(range.to);
    this.rescaleSliderToRange(range.from, range.to);
    this.syncStateToUrl({
      [StoredValue.DATE_RANGE_PRESET]: this.stringUtils.kebabCase(preset.label),
      [StoredValue.DATE_FROM]: range.from.toString(),
      [StoredValue.DATE_TO]: range.to.toString()
    });
    void this.populateGroupEvents();
  }

  private matchPresetToCurrentRange(): AdvancedSearchPreset | null {
    if (!this.state.groupEventsFilter) return null;
    const fromMillis = this.state.groupEventsFilter.fromDate?.value;
    const toMillis = this.state.groupEventsFilter.toDate?.value;
    if (!fromMillis || !toMillis) return null;
    const tolerance = 24 * 60 * 60 * 1000;
    const exactMatch = this.dateRangePresetOptions.find(preset => {
      const range = preset.range();
      return Math.abs(range.from - fromMillis) <= tolerance && Math.abs(range.to - toMillis) <= tolerance;
    });
    return exactMatch ?? this.customDateRangePreset;
  }

  toggleSelectAllGroupEvents(): void {
    if (!this.state.groupEventsFilter) return;
    this.state.groupEventsFilter.selectAll = !this.state.groupEventsFilter.selectAll;
    this.state.groupEvents.forEach(event => event.selected = this.state.groupEventsFilter!.selectAll);
  }

  selectedGroupEventCount(): number {
    return this.state.groupEvents.filter(event => event.selected).length;
  }

  selectedGroupEventsList(): GroupEventSummary[] {
    return this.state.groupEvents.filter(event => event.selected);
  }

  protected async copyComposerStateAsJson(): Promise<void> {
    try {
      const sanitised = this.compositionsService.serialiseStateForStorage(this.state);
      const text = JSON.stringify(sanitised, null, 2);
      await navigator.clipboard.writeText(text);
      this.notify.success({ title: "Copied", message: "Composer state copied to clipboard as JSON" });
    } catch (error) {
      this.logger.error("copyComposerStateAsJson failed:", error);
      this.notify.error({ title: "Copy failed", message: "Could not copy composer state. See console for details." });
    }
  }

  cycleEventMedia(event: GroupEventSummary, direction: 1 | -1): void {
    const media = event.media ?? [];
    if (media.length === 0) return;
    const currentIndex = event.selectedMediaIndex ?? 0;
    const nextIndex = (currentIndex + direction + media.length) % media.length;
    this.applyMediaSelection(event, nextIndex);
  }

  private mediaUrlAtIndex(event: GroupEventSummary, index: number): string | undefined {
    const item = event.media?.[index];
    return item?.styles?.find(style => style.style === "medium")?.url ?? item?.styles?.[0]?.url;
  }

  private clampMediaIndex(event: GroupEventSummary, index: number | undefined): number {
    const count = event.media?.length ?? 0;
    if (count === 0 || !isNumber(index)) return 0;
    return Math.min(Math.max(index, 0), count - 1);
  }

  private applyMediaSelection(event: GroupEventSummary, index: number): void {
    event.selectedMediaIndex = index;
    const url = this.mediaUrlAtIndex(event, index);
    if (url) {
      event.image = url;
    }
  }

  private mergePriorSelection(event: GroupEventSummary, prior?: GroupEventSummary): GroupEventSummary {
    const merged: GroupEventSummary = { ...event, selected: prior?.selected ?? this.state.groupEventsFilter!.selectAll };
    this.applyMediaSelection(merged, this.clampMediaIndex(merged, prior?.selectedMediaIndex));
    return merged;
  }

  synthesisedNotificationForCommittee(): Notification | null {
    if (!this.state.notificationConfig || !this.state.groupEventsFilter) return null;
    return {
      cancelled: false,
      content: {
        notificationConfig: this.state.notificationConfig,
        text: { value: "", include: false },
        signoffText: { value: "", include: false },
        title: { value: this.state.subject ?? "", include: false },
        addresseeType: this.addresseePlaceholder(),
        listId: this.state.selectedListId ?? undefined,
        selectedMemberIds: this.state.selectedMemberIds,
        signoffAs: { value: "", include: false },
        includeDownloadInformation: false
      },
      groupEvents: this.state.groupEvents,
      groupEventsFilter: this.state.groupEventsFilter
    };
  }

  private renderedEventsHtml(): string {
    if (this.eventsStepOmitted() || this.state.eventInclusion === EventInclusionMode.NONE) return "";
    return this.eventsContent?.nativeElement?.innerHTML ?? "";
  }

  private renderedCommitteeFileHtmlForFragment(fragment: ComposerFragment): string {
    const blocks = this.committeeFileBlocks?.toArray() ?? [];
    const ref = blocks.find(el => el.nativeElement?.dataset?.fragmentId === fragment.id);
    return ref?.nativeElement?.innerHTML ?? "";
  }

  private applyDefaultListIfNeeded(): void {
    if (this.state.recipientMode !== RecipientMode.ENTIRE_LIST) return;
    if (this.state.selectedListId !== null) return;
    const lists = this.nonEmptyLists();
    if (lists.length > 0) {
      this.state.selectedListId = lists[0].id;
    }
  }

  protected availableLists(): ListInfo[] {
    return this.mailMessagingConfig?.brevo?.lists?.lists ?? [];
  }

  protected nonEmptyLists(): ListInfo[] {
    return this.availableLists().filter(list => this.subscribedMemberCount(list) > 0);
  }

  protected narrowMembersExpanded: boolean = false;
  protected recipientsPanelExpanded: boolean = true;

  protected externalRecipientsSummaryLabel(): string {
    const describe = (label: string, list: ComposerExternalRecipient[]): string | null => {
      if (list.length === 0) {
        return null;
      }
      const names = list.map(recipient => recipient.name || recipient.email);
      const shown = names.slice(0, 3).join(", ");
      const remainder = names.length > 3 ? ` +${names.length - 3} more` : "";
      return `${label}: ${shown}${remainder}`;
    };
    const parts = [
      describe("To", this.state.externalRecipients ?? []),
      describe("Cc", this.state.ccRecipients ?? []),
      describe("Bcc", this.state.bccRecipients ?? [])
    ].filter((part): part is string => part !== null);
    return parts.length > 0 ? parts.join(" · ") : "No recipients chosen yet - expand to add.";
  }

  protected listSubscriberCount(list: ListInfo): string {
    return this.listSubscriberService.subscriberCountLabel(this.members, list.id);
  }

  protected listNameAndCount(list: ListInfo): string {
    return `${list.name} - ${this.listSubscriberCount(list)}`;
  }

  protected subscribedMemberCount(list: ListInfo): number {
    return this.listSubscriberService.subscriberCount(this.members, list.id);
  }

  setNarrowListId(listId: number | null): void {
    this.state.narrowListId = listId;
    this.recomputeCandidateMembers();
    this.state.selectedMemberIds = this.state.selectedMemberIds.filter(id => this.cachedCandidateMembers.some(member => member.id === id));
    this.syncStateToUrl({ [StoredValue.LIST_ID]: listId?.toString() ?? null });
  }

  private cachedCandidateMembers: Member[] = [];
  private cachedUnsubscribedDates: Record<string, number> = {};
  private cachedNarrowListId: number | null | undefined = undefined;
  private cachedMembersRef: Member[] = [];
  private cachedReferenceListId: number | null | undefined = undefined;
  private cachedRemovesRecipients: boolean | undefined = undefined;

  private unsubscribeReferenceListId(): number | null {
    const narrowListId = this.state.narrowListId;
    if (isNumber(narrowListId)) {
      return narrowListId;
    }
    const defaultListId = this.state.notificationConfig?.defaultListId;
    return isNumber(defaultListId) ? defaultListId : null;
  }

  private recomputeCandidateMembers(): void {
    const narrowListId = this.state.narrowListId;
    const referenceListId = this.unsubscribeReferenceListId();
    const removesRecipients = this.workflowRemovesRecipients();
    const basePool = removesRecipients ? this.allMembers : this.members;
    if (narrowListId === null) {
      this.cachedCandidateMembers = basePool;
    } else {
      this.cachedCandidateMembers = basePool.filter(member =>
        this.mailListUpdaterService.memberSubscribed(member, narrowListId));
    }
    this.cachedUnsubscribedDates = this.cachedCandidateMembers.reduce((dates, member) => {
      const unsubscribedAt = isNumber(referenceListId)
        ? this.mailListUpdaterService.listUnsubscribedAt(member, referenceListId)
        : this.mailListUpdaterService.fullyUnsubscribedAt(member);
      if (isNumber(unsubscribedAt) && member.id) {
        dates[member.id] = unsubscribedAt;
      }
      return dates;
    }, {} as Record<string, number>);
    this.cachedNarrowListId = narrowListId;
    this.cachedMembersRef = this.members;
    this.cachedReferenceListId = referenceListId;
    this.cachedRemovesRecipients = removesRecipients;
  }

  candidateMembers(): Member[] {
    if (this.candidateCacheStale()) {
      this.recomputeCandidateMembers();
    }
    return this.cachedCandidateMembers;
  }

  unsubscribedMemberDates(): Record<string, number> {
    if (this.candidateCacheStale()) {
      this.recomputeCandidateMembers();
    }
    return this.cachedUnsubscribedDates;
  }

  private candidateCacheStale(): boolean {
    return this.cachedNarrowListId !== this.state.narrowListId
      || this.cachedMembersRef !== this.members
      || this.cachedReferenceListId !== this.unsubscribeReferenceListId()
      || this.cachedRemovesRecipients !== this.workflowRemovesRecipients();
  }

  setRecipientMode(mode: RecipientMode): void {
    if (mode === RecipientMode.ENTIRE_LIST && this.state.brandingMode === BrandingMode.UNBRANDED) return;
    this.state.recipientMode = mode;
    this.state.sendingChannel = mode === RecipientMode.ENTIRE_LIST ? SendingChannel.CAMPAIGN : SendingChannel.TRANSACTIONAL_BATCH;
    this.applyDefaultListIfNeeded();
    this.syncStateToUrl({ [StoredValue.EMAIL_TYPE]: kebabCase(mode) });
  }

  protected pendingForwardedHeaderLines: string[] = [];
  private introEditorRef?: TiptapMarkdownEditor;
  private pendingIntroFocus = false;

  @ViewChild("introEditor") set introEditor(editor: TiptapMarkdownEditor | undefined) {
    this.introEditorRef = editor;
    if (editor && this.pendingIntroFocus) {
      this.pendingIntroFocus = false;
      queueMicrotask(() => editor.focusAtStart());
    }
  }

  get introEditor(): TiptapMarkdownEditor | undefined {
    return this.introEditorRef;
  }

  protected onIntroRawPaste(event: { text: string; consume: () => void }): void {
    if (this.state.brandingMode !== BrandingMode.UNBRANDED) return;
    const titled = this.extractLeadingTitle(event.text);
    if (titled) {
      event.consume();
      this.state.subject = titled.title;
      this.state.introMarkdown = titled.body;
      this.state.addresseeType = AddresseeType.NONE;
      this.pendingForwardedHeaderLines = [];
      queueMicrotask(() => this.introEditor?.focusAtStart());
      return;
    }
    const parsed = this.parseEmailHeadersFromMarkdown(event.text);
    if (parsed) {
      event.consume();
      const incomingAddresses = [...parsed.to, ...parsed.cc];
      const existing = new Set(this.state.externalRecipients.map(item => item.email.toLowerCase()));
      const additions = incomingAddresses
        .filter(addr => !existing.has(addr.email.toLowerCase()))
        .map(addr => ({
          email: addr.email,
          name: addr.name || this.nameFromEmail(addr.email) || undefined,
          saveForReuse: true
        }));
      if (additions.length > 0) {
        this.state.externalRecipients = [...this.state.externalRecipients, ...additions];
      }
      const existingIntro = this.state.introMarkdown ?? "";
      const hasExistingIntro = existingIntro.trim().length > 0;
      if (parsed.subject && !this.state.subject?.trim()) this.state.subject = parsed.subject;
      if (!hasExistingIntro) this.state.addresseeType = AddresseeType.NONE;
      this.state.introMarkdown = existingIntro + this.buildForwardedIntroMarkdown(parsed.forwardedHeaderLines, parsed.body);
      this.pendingForwardedHeaderLines = parsed.forwardedHeaderLines;
      queueMicrotask(() => hasExistingIntro ? this.introEditor?.focusAtEnd() : this.introEditor?.focusAtStart());
    }
    this.autoResolveTrackingUrls().catch(error => this.logger.warn("auto-resolve tracking urls failed", error));
  }

  private buildForwardedIntroMarkdown(headerLines: string[], body: string): string {
    const headerBlock = headerLines.join("  \n");
    const trimmedBody = body?.trim() ?? "";
    return `\n\n---\n\n${headerBlock}\n\n---\n\n${trimmedBody}`;
  }

  protected dismissForwardedHeaderOffer(): void {
    this.pendingForwardedHeaderLines = [];
  }

  private extractLeadingTitle(content: string): { title: string; body: string } | null {
    const lines = content.split(/\r?\n/);
    const firstNonBlankIdx = lines.findIndex(line => line.trim() !== "");
    if (firstNonBlankIdx === -1) return null;
    const match = lines[firstNonBlankIdx].trim().match(/^#{1,2}\s+(.+?)\s*#*\s*$/);
    if (!match) return null;
    const body = lines.slice(firstNonBlankIdx + 1).join("\n").replace(/^\n+/, "");
    return { title: match[1].trim(), body };
  }

  protected onIntroMarkdownChange(value: string): void {
    this.state.introMarkdown = value ?? "";
    if (this.state.addresseeType === AddresseeType.NONE) return;
    const firstLine = (value ?? "")
      .replace(/^[\s>*_`#-]+/, "")
      .split(/\r?\n/)[0]
      ?.trim() ?? "";
    if (/^(hi|hello|hey|dear|good (morning|afternoon|evening))\b/i.test(firstLine)) {
      this.state.addresseeType = AddresseeType.NONE;
    }
  }

  private parseEmailHeadersFromMarkdown(content: string): { to: { name: string; email: string }[]; cc: { name: string; email: string }[]; subject: string | null; body: string; forwardedHeaderLines: string[] } | null {
    const lines = content.split(/\r?\n/);
    const HEADER_REGEX = /^(To|From|Cc|Bcc|Subject|Date|Sent|Reply-To):\s*(.+)$/i;
    const firstHeaderIdx = lines.findIndex(line => {
      const stripped = this.stripMarkdownDecorations(line);
      return stripped !== "" && HEADER_REGEX.test(stripped);
    });
    if (firstHeaderIdx === -1) return null;
    const parsed = this.collectHeaderLines(lines, firstHeaderIdx, HEADER_REGEX, {}, -1);
    const { headers, bodyStartLine } = parsed;
    if (keys(headers).length === 0 || (!headers.to && !headers.subject && !headers.from)) return null;
    const body = bodyStartLine >= 0 ? lines.slice(bodyStartLine).join("\n").replace(/^\n+/, "") : "";
    const headerEndIdx = bodyStartLine >= 0 ? bodyStartLine : lines.length;
    const forwardedHeaderLines = lines.slice(firstHeaderIdx, headerEndIdx)
      .map(line => this.stripMarkdownDecorations(line))
      .filter(line => line !== "");
    const toList = this.parseEmailAddressList(headers.to ?? "");
    const fromList = this.parseEmailAddressList(headers.from ?? "");
    const seenEmails = new Set<string>();
    const combinedRecipients = [...toList, ...fromList].filter(item => {
      const key = item.email.toLowerCase();
      if (seenEmails.has(key)) return false;
      seenEmails.add(key);
      return true;
    });
    return {
      to: combinedRecipients,
      cc: this.parseEmailAddressList(headers.cc ?? ""),
      subject: headers.subject ?? null,
      body,
      forwardedHeaderLines
    };
  }

  private collectHeaderLines(lines: string[], index: number, headerRegex: RegExp, headers: Record<string, string>, bodyStartLine: number): { headers: Record<string, string>; bodyStartLine: number } {
    if (index >= lines.length) return { headers, bodyStartLine };
    const stripped = this.stripMarkdownDecorations(lines[index]);
    if (stripped === "") {
      const nextNonBlank = this.findNextNonBlankLine(lines, index + 1);
      if (nextNonBlank === -1) return { headers, bodyStartLine: lines.length };
      if (headerRegex.test(this.stripMarkdownDecorations(lines[nextNonBlank]))) {
        return this.collectHeaderLines(lines, index + 1, headerRegex, headers, bodyStartLine);
      }
      return { headers, bodyStartLine: nextNonBlank };
    }
    const headerMatch = stripped.match(headerRegex);
    if (headerMatch) {
      const key = headerMatch[1].toLowerCase();
      const merged = { ...headers, [key]: headers[key] ? `${headers[key]}, ${headerMatch[2].trim()}` : headerMatch[2].trim() };
      return this.collectHeaderLines(lines, index + 1, headerRegex, merged, bodyStartLine);
    }
    return { headers, bodyStartLine: index };
  }

  private findNextNonBlankLine(lines: string[], from: number): number {
    const offset = lines.slice(from).findIndex(line => this.stripMarkdownDecorations(line) !== "");
    return offset === -1 ? -1 : from + offset;
  }

  private stripMarkdownDecorations(line: string): string {
    return line
      .replace(/^[\s>*_`#-]+/, "")
      .replace(/[*_`]+$/g, "")
      .trim();
  }

  private parseEmailAddressList(input: string): { name: string; email: string }[] {
    if (!input) return [];
    const normalised = input.replace(/\[([^\]]+)\]\(mailto:([^)]+)\)/gi, (_match, text: string, email: string) => {
      const cleanedText = text.trim();
      const cleanedEmail = email.trim();
      return cleanedText.toLowerCase() === cleanedEmail.toLowerCase() ? `<${cleanedEmail}>` : `${cleanedText} <${cleanedEmail}>`;
    });
    return normalised
      .split(/[,;]/)
      .map(part => this.parseEmailAddress(part))
      .filter((item): item is { name: string; email: string } => !!item);
  }

  private parseEmailAddress(input: string): { name: string; email: string } | null {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const bracket = trimmed.match(/^(.*?)<\s*([^>\s]+@[^>\s]+)\s*>\s*$/);
    if (bracket) {
      const name = bracket[1].replace(/[*_`"']/g, "").trim();
      return { name, email: bracket[2].trim() };
    }
    const inlineEmail = trimmed.match(/([^\s<>"',]+@[^\s<>"',]+)/);
    if (inlineEmail) {
      const email = inlineEmail[1].replace(/^[<\[]+|[>\]]+$/g, "");
      const name = trimmed.replace(inlineEmail[0], "").replace(/[*_`"'<>\[\]()]/g, "").trim();
      return { name, email };
    }
    return null;
  }

  private autoSelectNotificationConfig(): void {
    if (!this.state.notificationConfigListing || this.state.brandingMode === BrandingMode.UNBRANDED) {
      return;
    }
    const candidates = this.mailMessagingService.notificationConfigs(this.state.notificationConfigListing);
    if (this.forcedConfigId) {
      const forced = candidates.find(candidate => candidate.id === this.forcedConfigId);
      if (forced) {
        this.onEmailConfigChanged(forced);
      }
    }
    if (!this.state.notificationConfig && candidates.length > 0) {
      this.onEmailConfigChanged(candidates[0]);
    }
  }

  setBrandingMode(mode: BrandingMode): void {
    const previousMode = this.state.brandingMode;
    this.state.brandingMode = mode;
    if (previousMode !== mode) {
      this.unbrandedListSendWarningDismissed = false;
    }
    if (mode === BrandingMode.UNBRANDED) {
      this.recipientsPanelExpanded = true;
      if (this.state.recipientMode !== RecipientMode.SELECTED_MEMBERS) {
        this.setRecipientMode(RecipientMode.SELECTED_MEMBERS);
      }
      if (this.stepperActiveTab === EmailComposerStepKey.EVENTS) {
        this.goToStepKey(EmailComposerStepKey.COMPOSE);
      }
      this.state.signoffRoles = [];
      if (previousMode !== BrandingMode.UNBRANDED) {
        this.state.fragmentOrder = buildDefaultFragmentOrder(this.state, { unbranded: true });
        this.expandedFragmentIds.add("intro");
        this.state.selectedMemberIds = [];
        this.state.preFilterKey = null;
        this.state.narrowListId = null;
        this.state.notificationConfig = null;
        this.state.bannerId = null;
        this.forcedConfigId = null;
        this.forcedConfigSlug = null;
      }
    } else {
      if (this.state.externalRecipients?.length) {
        this.state.externalRecipients = [];
      }
      this.autoSelectNotificationConfig();
    }
    const urlUpdates: Record<string, string | null> = { [StoredValue.BRANDING]: mode };
    if (mode === BrandingMode.UNBRANDED) {
      urlUpdates[StoredValue.CONFIG_ID] = null;
    }
    this.syncStateToUrl(urlUpdates);
  }

  private async loadSavedExternalRecipients(): Promise<void> {
    try {
      this.savedExternalRecipients = await this.externalRecipientService.list();
    } catch (error) {
      this.logger.error("loadSavedExternalRecipients failed:", error);
      this.savedExternalRecipients = [];
    }
  }

  private async loadLoggedInMemberRecord(): Promise<void> {
    try {
      const memberId = this.memberLoginService.loggedInMember()?.memberId;
      if (memberId) {
        this.loggedInMemberRecord = await this.memberService.getById(memberId);
      }
    } catch (error) {
      this.logger.error("loadLoggedInMemberRecord failed:", error);
      this.loggedInMemberRecord = null;
    }
  }

  protected unbrandedRoleOptions(): CommitteeMember[] {
    return (this.committeeReferenceData?.loggedOnRoles() ?? []).filter(role => !!role.email);
  }

  protected resolvedUnbrandedRole(): CommitteeMember | undefined {
    const options = this.unbrandedRoleOptions();
    if (options.length === 0) return undefined;
    const chosen = options.find(role => role.type === this.state.unbrandedSenderRoleType);
    return chosen ?? options[0];
  }

  protected onUnbrandedSenderRoleChange(roleType: string): void {
    this.state.unbrandedSenderRoleType = roleType || null;
  }

  protected unbrandedSenderInfo(): { name: string; email: string; description: string } {
    const role = this.resolvedUnbrandedRole();
    if (role?.email) {
      return { name: role.fullName ?? "", email: role.email, description: role.description ?? "" };
    }
    return { name: "", email: "", description: "" };
  }

  protected nameFromEmail(email: string): string {
    const localPart = email.split("@")[0] ?? "";
    if (!localPart) return "";
    const stripped = localPart.replace(/\d+$/, "");
    const tokens = stripped.split(/[._\-+]+/).filter(token => token.length > 0);
    return tokens
      .map(token => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
      .join(" ");
  }

  protected readonly RecipientField = RecipientField;

  protected replyCcSuggestionLabel(): string {
    return this.replyCcSuggestion.map(recipient => recipient.name || recipient.email).join(", ");
  }

  protected applyReplyCcSuggestion(): void {
    const merged = this.replyCcSuggestion.reduce<ComposerExternalRecipient[]>((recipients, suggestion) =>
      recipients.some(existing => existing.email.toLowerCase() === suggestion.email.toLowerCase())
        ? recipients
        : [...recipients, suggestion], this.state.ccRecipients);
    this.state.ccRecipients = merged;
    this.replyCcSuggestion = [];
  }

  selectList(list: ListInfo): void {
    this.state.selectedListId = list.id;
    this.syncStateToUrl({ [StoredValue.LIST_ID]: list.id?.toString() });
  }

  private applyUrlStateToComposer(queryParams: ParamMap): void {
    const branding = queryParams.get(StoredValue.BRANDING);
    if (branding === BrandingMode.UNBRANDED && this.state.brandingMode !== BrandingMode.UNBRANDED) {
      this.setBrandingMode(BrandingMode.UNBRANDED);
    } else if (branding === BrandingMode.BRANDED && this.state.brandingMode !== BrandingMode.BRANDED) {
      this.setBrandingMode(BrandingMode.BRANDED);
    }
    const emailType = queryParams.get(StoredValue.EMAIL_TYPE);
    const allowEntireList = this.state.brandingMode !== BrandingMode.UNBRANDED;
    if (emailType === kebabCase(RecipientMode.ENTIRE_LIST) && allowEntireList && this.state.recipientMode !== RecipientMode.ENTIRE_LIST) {
      this.state.recipientMode = RecipientMode.ENTIRE_LIST;
      this.state.sendingChannel = SendingChannel.CAMPAIGN;
    } else if (emailType === kebabCase(RecipientMode.SELECTED_MEMBERS) && this.state.recipientMode !== RecipientMode.SELECTED_MEMBERS) {
      this.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
      this.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
    }
    const listId = queryParams.get(StoredValue.LIST_ID);
    if (listId) {
      const numeric = Number(listId);
      if (!Number.isNaN(numeric)) {
        if (this.state.recipientMode === RecipientMode.ENTIRE_LIST) {
          this.state.selectedListId = numeric;
        } else {
          this.state.narrowListId = numeric;
        }
      }
    }
    const tab = queryParams.get(StoredValue.TAB);
    if (tab) {
      const matchingStep = EMAIL_COMPOSER_STEPS.find(step => step.key === tab);
      if (matchingStep && matchingStep.key !== this.stepperActiveTab) {
        this.stepperActiveTab = matchingStep.key;
        queueMicrotask(() => this.stepperRef?.value?.set(matchingStep.key as unknown as number));
      }
      if (matchingStep?.key === EmailComposerStepKey.REVIEW) {
        this.autoPreviewPending = true;
        this.maybeAutoRefreshPreview();
      }
    }
    const preFilter = queryParams.get(StoredValue.PRE_FILTER);
    if (preFilter && values(MemberSelection).includes(preFilter as MemberSelection)) {
      this.state.preFilterKey = preFilter as MemberSelection;
    }
    const eventInclusion = queryParams.get(StoredValue.EVENT_INCLUSION);
    if (eventInclusion && values(EventInclusionMode).includes(eventInclusion as EventInclusionMode)) {
      this.state.eventInclusion = eventInclusion as EventInclusionMode;
      if (this.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE) {
        this.ensureGroupEventsFilter();
      }
    }
    const divider = queryParams.get(StoredValue.DIVIDER);
    if (divider && values(SectionDividerStyle).includes(divider as SectionDividerStyle)) {
      const style = divider as SectionDividerStyle;
      this.state.introDividerAfter = style;
      this.state.eventsDividerAfter = style;
      this.state.signoffDividerAfter = style;
    }
    const dateFromMillis = queryParams.get(StoredValue.DATE_FROM);
    const dateToMillis = queryParams.get(StoredValue.DATE_TO);
    if (this.state.groupEventsFilter && dateFromMillis) {
      const fromMillis = Number(dateFromMillis);
      if (!Number.isNaN(fromMillis)) {
        this.state.groupEventsFilter.fromDate = this.dateUtils.asDateValue(fromMillis);
      }
    }
    if (this.state.groupEventsFilter && dateToMillis) {
      const toMillis = Number(dateToMillis);
      if (!Number.isNaN(toMillis)) {
        this.state.groupEventsFilter.toDate = this.dateUtils.asDateValue(toMillis);
      }
    }
    if (this.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE && this.state.groupEventsFilter) {
      this.selectedDateRangePreset = this.matchPresetToCurrentRange();
      void this.populateGroupEvents();
    }
    this.applyForcedMemberSelection();
    this.applyInboxReplyHandoffIfAny();
  }

  private applyInboxReplyHandoffIfAny(): void {
    const reply = this.inboxReplyHandoff.consume();
    if (!reply) {
      return;
    }
    if (this.state.brandingMode !== BrandingMode.UNBRANDED) {
      this.setBrandingMode(BrandingMode.UNBRANDED);
    }
    this.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
    this.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
    this.state.addresseeType = AddresseeType.NONE;
    const recipient = {email: reply.to.email, name: reply.to.name ?? undefined, saveForReuse: false};
    const alreadyPresent = this.state.externalRecipients.some(existing => existing.email.toLowerCase() === reply.to.email.toLowerCase());
    if (!alreadyPresent) {
      this.state.externalRecipients = [recipient, ...this.state.externalRecipients];
    }
    const replyCc = (reply.cc ?? []).map(address => ({email: address.email, name: address.name ?? undefined, saveForReuse: false}));
    if (reply.replyAll) {
      const existingCc = new Set(this.state.ccRecipients.map(existing => existing.email.toLowerCase()));
      this.state.ccRecipients = [...this.state.ccRecipients, ...replyCc.filter(address => !existingCc.has(address.email.toLowerCase()))];
      this.replyCcSuggestion = [];
    } else {
      this.replyCcSuggestion = replyCc;
    }
    this.state.subject = reply.subject;
    if (reply.senderRoleType) {
      this.state.unbrandedSenderRoleType = reply.senderRoleType;
    }
    const placeholder = "\n\n";
    const existingBody = this.state.introMarkdown ?? "";
    const quotedMarkdown = this.htmlToReplyMarkdown(reply.quotedHtml);
    const alreadyHasQuote = !!this.inboxReplyContext && this.inboxReplyContext.inboxMessageId === reply.inboxMessageId;
    if (!alreadyHasQuote) {
      this.state.introMarkdown = existingBody.length > 0 ? existingBody : placeholder + quotedMarkdown;
    }
    this.inboxReplyContext = {
      threadId: reply.threadId,
      aliasId: reply.aliasId,
      mailboxConnectionId: reply.mailboxConnectionId,
      inboxMessageId: reply.inboxMessageId,
      inReplyTo: reply.inReplyTo,
      references: reply.references
    };
    this.logger.info("Inbox reply handoff applied:", this.inboxReplyContext);
    if (this.introEditorRef) {
      queueMicrotask(() => this.introEditorRef?.focusAtStart());
    } else {
      this.pendingIntroFocus = true;
    }
  }

  private htmlToReplyMarkdown(html: string | null | undefined): string {
    if (!html) return "";
    try {
      return this.turndownService.turndown(this.htmlContentForReplyMarkdown(html));
    } catch (error) {
      this.logger.warn("turndown failed for reply quotedHtml; falling back to raw text", error);
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      this.removeReplyMarkdownNonContent(tmp);
      return (tmp.textContent ?? "").split(/\r?\n/).map(line => `> ${line}`).join("\n");
    }
  }

  private htmlContentForReplyMarkdown(html: string): string {
    const container = document.createElement("div");
    container.innerHTML = html;
    this.removeReplyMarkdownNonContent(container);
    return container.innerHTML;
  }

  private removeReplyMarkdownNonContent(container: HTMLElement): void {
    container.querySelectorAll("style, script, title, meta, link, head").forEach(element => element.remove());
  }

  private syncStateToUrl(extra: Record<string, string | null | undefined>): void {
    this.router.navigate([], {
      queryParams: extra,
      queryParamsHandling: "merge",
      replaceUrl: true
    });
  }

  onSelectedMemberIdsChange(ids: string[]): void {
    this.state.selectedMemberIds = ids;
  }

  protected priorSendExclusions: PriorSendExclusion[] = [];
  protected includeAlreadySent: boolean = false;
  protected priorSendDetailsExpanded: boolean = false;

  onPriorSendExclusionsChange(exclusions: PriorSendExclusion[]): void {
    this.priorSendExclusions = exclusions ?? [];
    if (this.priorSendExclusions.length === 0) {
      this.priorSendDetailsExpanded = false;
      this.includeAlreadySent = false;
    }
  }

  toggleIncludeAlreadySent(): void {
    this.includeAlreadySent = !this.includeAlreadySent;
  }

  togglePriorSendDetails(): void {
    this.priorSendDetailsExpanded = !this.priorSendDetailsExpanded;
  }

  priorSendDateRangeLabel(): string {
    if (this.priorSendExclusions.length === 0) return "";
    const sortedDates = this.priorSendExclusions.map(entry => entry.sentAt).sort((a, b) => a - b);
    const earliest = this.dateUtils.displayDate(sortedDates[0]);
    const latest = this.dateUtils.displayDate(sortedDates[sortedDates.length - 1]);
    return earliest === latest ? ` on ${earliest}` : ` between ${earliest} and ${latest}`;
  }

  priorSendDateLabel(sentAt: number): string {
    return this.dateUtils.displayDate(sentAt);
  }

  onEventsDividerChange(style: SectionDividerStyle): void {
    this.state.eventsDividerAfter = style;
  }

  onBetweenEventsDividerChange(style: SectionDividerStyle): void {
    this.state.betweenEventsDivider = style;
  }

  protected expandedFragmentIds: Set<string> = new Set();
  protected draggedFragmentPath: number[] | null = null;
  protected dragHoverPath: number[] | null = null;
  protected dragHoverPosition: DragHoverPosition | null = null;
  protected dragHoverColumnPath: number[] | null = null;
  protected templateContentHtml: string | null = null;
  protected templateContentFetching = false;
  protected templateContentError: string | null = null;
  private lastTemplateContentTemplateName: string | null = null;

  protected toggleFragmentExpanded(fragmentId: string): void {
    if (this.expandedFragmentIds.has(fragmentId)) {
      this.expandedFragmentIds.delete(fragmentId);
    } else {
      this.expandedFragmentIds.add(fragmentId);
    }
  }

  protected isFragmentExpanded(fragmentId: string): boolean {
    return this.expandedFragmentIds.has(fragmentId);
  }

  protected fragmentLabel(fragment: ComposerFragment): string {
    switch (fragment.kind) {
      case ComposerFragmentKind.INTRO: return "Body / intro";
      case ComposerFragmentKind.ARTICLE: return "Article block";
      case ComposerFragmentKind.EVENTS: return "Events list";
      case ComposerFragmentKind.SIGNOFF: return "Signoff";
      case ComposerFragmentKind.TEMPLATE_CONTENT: return "Template content";
      case ComposerFragmentKind.MULTI_COLUMN: return `${(fragment.columns ?? []).length}-column row`;
      case ComposerFragmentKind.DIVIDER: return "Divider";
      case ComposerFragmentKind.COMMITTEE_FILE: {
        const count = (fragment.committeeFileIds ?? []).length;
        return count > 1 ? `Committee files (${count})` : "Committee file";
      }
      default: return fragment.kind;
    }
  }

  protected fragmentPreview(fragment: ComposerFragment): string {
    const truncate = (input: string, max: number): string => {
      const decoded = this.toPlainTextPreview(input ?? "");
      const stripped = decoded.replace(/\s+/g, " ").trim();
      if (stripped.length <= max) return stripped;
      return `${stripped.slice(0, max).trim()}…`;
    };
    switch (fragment.kind) {
      case ComposerFragmentKind.INTRO: return truncate(this.state.introMarkdown, 80) || "(empty)";
      case ComposerFragmentKind.SIGNOFF: return truncate(this.state.signoffTextMarkdown, 80) || "(empty)";
      case ComposerFragmentKind.EVENTS: return this.eventsPreviewSummary();
      case ComposerFragmentKind.TEMPLATE_CONTENT: return "Template provides this content";
      case ComposerFragmentKind.ARTICLE: {
        const block = this.findArticleBlock(fragment.id);
        if (!block) return "(missing block)";
        const title = (block.title ?? "").trim();
        if (title) return truncate(title, 80);
        return truncate(block.markdown, 80) || "(empty)";
      }
      case ComposerFragmentKind.MULTI_COLUMN: return `${(fragment.columns ?? []).length} columns side by side`;
      case ComposerFragmentKind.DIVIDER: return SECTION_DIVIDER_OPTIONS.find(opt => opt.key === fragment.dividerAfter)?.label ?? "None";
      case ComposerFragmentKind.COMMITTEE_FILE: {
        const ids = fragment.committeeFileIds ?? [];
        if (ids.length === 0) return "(no files chosen)";
        const files = this.committeeFilesFor(fragment);
        if (files.length === 0) return ids.length === 1 ? "(file not found)" : `(${ids.length} files not found)`;
        if (files.length === 1) return truncate(this.committeeDisplayService.fileTitle(files[0]), 80);
        return truncate(files.map(file => this.committeeDisplayService.fileTitle(file)).join(", "), 80);
      }
      default: return "";
    }
  }

  protected fragmentIsExpandable(fragment: ComposerFragment): boolean {
    return EXPANDABLE_FRAGMENT_KINDS.has(fragment.kind);
  }

  private toPlainTextPreview(input: string): string {
    if (isUndefined(document)) {
      return input;
    }
    const container = document.createElement("div");
    container.innerHTML = input;
    return container.textContent ?? "";
  }

  protected eventsPreviewSummary(): string {
    if (this.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE) {
      const count = this.selectedGroupEventCount();
      return count > 0 ? this.stringUtils.pluraliseWithCount(count, "event") : "No events selected";
    }
    if (this.state.eventInclusion === EventInclusionMode.SINGLE_EVENT) {
      return this.state.singleEvent?.groupEvent?.title ?? "Single event (none loaded)";
    }
    return "No events";
  }

  protected findArticleBlock(id: string): ArticleBlock | null {
    return (this.state.articleBlocks ?? []).find(b => b.id === id) ?? null;
  }

  protected onSingleArticleBlockChange(updated: ArticleBlock): void {
    this.state.articleBlocks = (this.state.articleBlocks ?? []).map(b => b.id === updated.id ? updated : b);
  }

  private getFragmentList(parentPath: number[]): ComposerFragment[] | null {
    if (parentPath.length === 0) return this.state.fragmentOrder;
    if (parentPath.length === 2) {
      const top = this.state.fragmentOrder?.[parentPath[0]];
      if (!top || top.kind !== ComposerFragmentKind.MULTI_COLUMN) return null;
      return top.columns?.[parentPath[1]] ?? null;
    }
    return null;
  }

  protected getColumnFragments(topIndex: number, columnIndex: number): ComposerFragment[] {
    const top = this.state.fragmentOrder?.[topIndex];
    if (!top || top.kind !== ComposerFragmentKind.MULTI_COLUMN) return [];
    return top.columns?.[columnIndex] ?? [];
  }

  private getFragmentAt(path: number[]): ComposerFragment | null {
    if (path.length === 0) return null;
    const parent = this.getFragmentList(path.slice(0, -1));
    if (!parent) return null;
    return parent[path[path.length - 1]] ?? null;
  }

  private removeFragmentAt(path: number[]): ComposerFragment | null {
    const parent = this.getFragmentList(path.slice(0, -1));
    if (!parent) return null;
    const idx = path[path.length - 1];
    const removed = parent.splice(idx, 1)[0] ?? null;
    return removed;
  }

  protected removeFragment(path: number[]): void {
    this.removeFragmentAt(path);
    this.state.fragmentOrder = [...(this.state.fragmentOrder ?? [])];
  }

  protected hasFragmentKindAtTopLevel(kind: ComposerFragmentKind): boolean {
    return (this.state.fragmentOrder ?? []).some(f => f.kind === kind);
  }

  protected addIntroFragment(): void {
    if (this.hasFragmentKindAtTopLevel(ComposerFragmentKind.INTRO)) return;
    this.state.fragmentOrder = [
      { kind: ComposerFragmentKind.INTRO, id: "intro", dividerAfter: this.state.introDividerAfter ?? SectionDividerStyle.THIN_YELLOW },
      ...(this.state.fragmentOrder ?? [])
    ];
  }

  protected addSignoffFragment(): void {
    if (this.hasFragmentKindAtTopLevel(ComposerFragmentKind.SIGNOFF)) return;
    this.state.fragmentOrder = [
      ...(this.state.fragmentOrder ?? []),
      { kind: ComposerFragmentKind.SIGNOFF, id: "signoff", dividerAfter: this.state.signoffDividerAfter ?? SectionDividerStyle.THIN_YELLOW }
    ];
  }

  protected addEventsFragment(): void {
    if (this.hasFragmentKindAtTopLevel(ComposerFragmentKind.EVENTS)) return;
    const list = this.state.fragmentOrder ?? [];
    const signoffIdx = list.findIndex(f => f.kind === ComposerFragmentKind.SIGNOFF);
    const insertAt = signoffIdx >= 0 ? signoffIdx : list.length;
    const newFragment: ComposerFragment = { kind: ComposerFragmentKind.EVENTS, id: "events", dividerAfter: this.state.eventsDividerAfter ?? SectionDividerStyle.THIN_YELLOW };
    this.state.fragmentOrder = [...list.slice(0, insertAt), newFragment, ...list.slice(insertAt)];
  }

  private insertAboveSignoffAtTopLevel(fragment: ComposerFragment): void {
    const list = this.state.fragmentOrder ?? [];
    const signoffIdx = list.findIndex(f => f.kind === ComposerFragmentKind.SIGNOFF);
    const insertAt = signoffIdx >= 0 ? signoffIdx : list.length;
    this.state.fragmentOrder = [...list.slice(0, insertAt), fragment, ...list.slice(insertAt)];
  }

  protected addArticleFragment(parentPath: number[] = []): void {
    const blocks = this.state.articleBlocks ?? [];
    const newId = this.stringUtils.kebabCase(`block-${this.dateUtils.dateTimeNow().toMillis()}-${blocks.length}`);
    const newBlock: ArticleBlock = {
      id: newId,
      position: ArticleBlockPosition.ABOVE_EVENTS,
      order: blocks.length,
      title: "",
      markdown: "",
      image: null
    };
    this.state.articleBlocks = [...blocks, newBlock];
    const newFragment: ComposerFragment = {
      kind: ComposerFragmentKind.ARTICLE,
      id: newId,
      dividerAfter: this.state.betweenArticlesDivider ?? SectionDividerStyle.THIN_YELLOW
    };
    if (parentPath.length === 0) {
      this.insertAboveSignoffAtTopLevel(newFragment);
    } else {
      const parent = this.getFragmentList(parentPath);
      if (!parent) return;
      parent.push(newFragment);
      this.state.fragmentOrder = [...(this.state.fragmentOrder ?? [])];
    }
    this.expandedFragmentIds.add(newId);
  }

  protected addMultiColumnFragment(numColumns: number): void {
    const fragment = newMultiColumnFragment(numColumns, SectionDividerStyle.THIN_YELLOW);
    this.insertAboveSignoffAtTopLevel(fragment);
    this.expandedFragmentIds.add(fragment.id);
  }

  protected addDividerFragment(parentPath: number[] = []): void {
    const fragment = newDividerFragment();
    if (parentPath.length === 0) {
      this.insertAboveSignoffAtTopLevel(fragment);
    } else {
      const parent = this.getFragmentAt(parentPath.slice(0, -1));
      const columnIndex = parentPath[parentPath.length - 1];
      if (parent?.columns?.[columnIndex]) {
        parent.columns[columnIndex] = [...parent.columns[columnIndex], fragment];
      }
    }
  }

  protected onFragmentDividerChange(path: number[], style: SectionDividerStyle): void {
    const fragment = this.getFragmentAt(path);
    if (!fragment) return;
    fragment.dividerAfter = style;
    this.state.fragmentOrder = [...(this.state.fragmentOrder ?? [])];
  }

  protected onFragmentDragStart(path: number[], event: DragEvent): void {
    this.draggedFragmentPath = [...path];
    if (event?.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      const dragEl = (event.target as HTMLElement) || (event.currentTarget as HTMLElement);
      if (dragEl && event.dataTransfer.setDragImage) {
        event.dataTransfer.setDragImage(dragEl, 10, 10);
      }
    }
  }

  protected onFragmentDragOver(path: number[], event: DragEvent): void {
    if (!this.draggedFragmentPath) return;
    if (this.isPathPrefixOf(this.draggedFragmentPath, path)) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement | null;
    if (target) {
      const rect = target.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      this.dragHoverPosition = (event.clientY ?? midpoint) < midpoint ? DragHoverPosition.Before : DragHoverPosition.After;
    } else {
      this.dragHoverPosition = DragHoverPosition.Before;
    }
    this.dragHoverPath = [...path];
    this.dragHoverColumnPath = null;
  }

  protected onFragmentDrop(path: number[]): void {
    if (!this.draggedFragmentPath) return;
    if (this.isPathPrefixOf(this.draggedFragmentPath, path)) {
      this.resetDragState();
      return;
    }
    const targetIndex = this.dragHoverPosition === DragHoverPosition.After
      ? path[path.length - 1] + 1
      : path[path.length - 1];
    const targetPath = [...path.slice(0, -1), targetIndex];
    this.movePath(this.draggedFragmentPath, targetPath);
    this.resetDragState();
  }

  protected onColumnDragOver(parentPath: number[], event: DragEvent): void {
    if (!this.draggedFragmentPath) return;
    if (this.isPathPrefixOf(this.draggedFragmentPath, parentPath)) return;
    event.preventDefault();
    this.dragHoverColumnPath = [...parentPath];
    this.dragHoverPath = null;
  }

  protected onColumnDrop(parentPath: number[]): void {
    if (!this.draggedFragmentPath) return;
    if (this.isPathPrefixOf(this.draggedFragmentPath, parentPath)) {
      this.resetDragState();
      return;
    }
    const targetList = this.getFragmentList(parentPath);
    if (!targetList) {
      this.resetDragState();
      return;
    }
    this.movePath(this.draggedFragmentPath, [...parentPath, targetList.length]);
    this.resetDragState();
  }

  protected onFragmentDragEnd(): void {
    this.resetDragState();
  }

  private resetDragState(): void {
    this.draggedFragmentPath = null;
    this.dragHoverPath = null;
    this.dragHoverColumnPath = null;
  }

  private isPathPrefixOf(prefix: number[], full: number[]): boolean {
    if (prefix.length > full.length) return false;
    return prefix.every((value, idx) => value === full[idx]);
  }

  private movePath(srcPath: number[], tgtPath: number[]): void {
    const srcParent = this.getFragmentList(srcPath.slice(0, -1));
    const tgtParent = this.getFragmentList(tgtPath.slice(0, -1));
    if (!srcParent || !tgtParent) return;
    const srcIndex = srcPath[srcPath.length - 1];
    const initialTgtIndex = tgtPath[tgtPath.length - 1];
    const fragment = srcParent.splice(srcIndex, 1)[0];
    if (!fragment) return;
    const tgtIndex = srcParent === tgtParent && srcIndex < initialTgtIndex ? initialTgtIndex - 1 : initialTgtIndex;
    tgtParent.splice(tgtIndex, 0, fragment);
    this.state.fragmentOrder = [...(this.state.fragmentOrder ?? [])];
  }

  protected pathsEqual(a: number[] | null, b: number[] | null): boolean {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    return a.every((value, idx) => value === b[idx]);
  }

  protected isDragHover(path: number[]): boolean {
    return this.pathsEqual(this.dragHoverPath, path);
  }

  protected isColumnDragHover(parentPath: number[]): boolean {
    return this.pathsEqual(this.dragHoverColumnPath, parentPath);
  }

  onPreFilterKeyChange(key: MemberSelection | null): void {
    this.state.preFilterKey = key;
    this.syncStateToUrl({ [StoredValue.PRE_FILTER]: key ?? null });
  }

  onEmailConfigChanged(config: NotificationConfig): void {
    const previousConfigSubject = this.state.notificationConfig?.subject?.text ?? "";
    const userTypedCustomSubject = !!this.state.subject?.trim() && this.state.subject !== previousConfigSubject;
    this.state.notificationConfig = config;
    this.postSendActionWarningDismissed = false;
    this.state.bannerId = config?.bannerId ?? null;
    if (this.eventsStepOmitted() && this.state.eventInclusion !== EventInclusionMode.NONE) {
      this.setEventInclusionMode(EventInclusionMode.NONE);
    }
    if (!userTypedCustomSubject) {
      this.state.subject = config?.subject?.text ?? "";
    }
    this.state.signoffRoles = this.validSignoffRolesFor(config?.signOffRoles ?? []);
    this.applyRecipientDefaultsFrom(config);
    this.syncStateToUrl({
      [StoredValue.CONFIG_ID]: this.configToSlug(config),
      [StoredValue.LIST_ID]: this.state.recipientMode === RecipientMode.ENTIRE_LIST ? this.state.selectedListId?.toString() ?? null : null,
      [StoredValue.PRE_FILTER]: this.state.recipientMode === RecipientMode.SELECTED_MEMBERS ? this.state.preFilterKey ?? null : null,
      [StoredValue.EMAIL_TYPE]: kebabCase(this.state.recipientMode)
    });
    this.refreshTemplateContent();
    this.ensureFragmentOrder();
    this.maybeAutoRefreshPreview();
  }

  private applyRecipientDefaultsFrom(config: NotificationConfig | null): void {
    if (!config) return;
    if (this.state.brandingMode === BrandingMode.UNBRANDED) {
      this.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
      this.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
      this.state.preFilterKey = null;
      this.state.selectedMemberIds = [];
      return;
    }
    if (config.defaultMemberSelection === MemberSelection.MAILING_LIST) {
      this.state.recipientMode = RecipientMode.ENTIRE_LIST;
      this.state.sendingChannel = SendingChannel.CAMPAIGN;
      this.state.preFilterKey = null;
      if (isNumber(config.defaultListId)) {
        this.state.selectedListId = config.defaultListId;
      }
      this.state.selectedMemberIds = [];
    } else {
      this.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
      this.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
      this.state.preFilterKey = config.defaultMemberSelection ?? null;
      this.state.selectedMemberIds = [];
    }
    this.applyForcedMemberSelection();
  }

  private applyForcedMemberSelection(): void {
    if (!this.forcedMemberId) {
      return;
    }
    this.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
    this.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
    this.state.preFilterKey = null;
    this.state.selectedMemberIds = [this.forcedMemberId];
  }

  protected forcedMemberLabel(): string {
    const member = this.members?.find(item => item.id === this.forcedMemberId);
    if (!member) {
      return "the selected member";
    }
    const name = this.memberFullName(member);
    return member.email ? `${name} (${member.email})` : name;
  }

  private memberFullName(member: Member): string {
    const fullName = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
    return fullName || member.displayName?.trim() || "the selected member";
  }

  protected memberSendBlockReason(member: Member): string | null {
    if (!member) {
      return null;
    }
    if (this.respectsBlocks()) {
      if (member.emailBlock) {
        return "is blocked from email";
      }
      const referenceListId = this.unsubscribeReferenceListId();
      const unsubscribed = isNumber(referenceListId)
        ? isNumber(this.mailListUpdaterService.listUnsubscribedAt(member, referenceListId))
        : isNumber(this.mailListUpdaterService.fullyUnsubscribedAt(member));
      if (unsubscribed) {
        return "has unsubscribed from email";
      }
    }
    if (this.requiresConsent() && member.emailMarketingConsent === false) {
      return "has not given Head Office marketing consent";
    }
    return null;
  }

  private blockedSelectedMembers(): { member: Member; reason: string }[] {
    return this.state.selectedMemberIds
      .map(id => this.members.find(item => item.id === id))
      .filter((member): member is Member => !!member)
      .map(member => ({ member, reason: this.memberSendBlockReason(member) }))
      .filter((entry): entry is { member: Member; reason: string } => !!entry.reason);
  }

  protected clearForcedMember(): void {
    this.forcedMemberId = null;
    this.syncStateToUrl({ [StoredValue.MEMBER]: null });
  }

  private configHasWorkflowAction(action: WorkflowAction): boolean {
    const config = this.state.notificationConfig;
    if (!config) {
      return false;
    }
    return [...(config.preSendActions ?? []), ...(config.postSendActions ?? [])].includes(action);
  }

  protected bulkDeletionPending(): boolean {
    return this.configHasWorkflowAction(WorkflowAction.BULK_DELETE_GROUP_MEMBER);
  }

  protected memberDisablePending(): boolean {
    return this.configHasWorkflowAction(WorkflowAction.DISABLE_GROUP_MEMBER);
  }

  private workflowRemovesRecipients(): boolean {
    return this.bulkDeletionPending() || this.memberDisablePending();
  }

  protected postSendActionWarningVisible(): boolean {
    return (this.bulkDeletionPending() || this.memberDisablePending()) && !this.postSendActionWarningDismissed;
  }

  protected dismissPostSendActionWarning(): void {
    this.postSendActionWarningDismissed = true;
  }

  protected bulkDeletionMemberCount(): number {
    if (this.state.recipientMode === RecipientMode.ENTIRE_LIST && this.state.selectedListId !== null) {
      return this.members
        .filter(this.memberService.filterFor.GROUP_MEMBERS)
        .filter(member => this.mailListUpdaterService.memberSubscribed(member, this.state.selectedListId!))
        .length;
    }
    return this.state.selectedMemberIds?.length ?? 0;
  }

  protected showRecipientSourceRadios(): boolean {
    return !this.state.preFilterKey;
  }

  protected async refreshTemplateContent(): Promise<void> {
    const templateName = this.state.notificationConfig?.templateName;
    if (!templateName) {
      this.templateContentHtml = null;
      this.templateContentError = null;
      this.lastTemplateContentTemplateName = null;
      this.applyTemplateContentFragmentPresence();
      return;
    }
    if (this.lastTemplateContentTemplateName === templateName && this.templateContentHtml) {
      this.applyTemplateContentFragmentPresence();
      return;
    }
    this.templateContentFetching = true;
    this.templateContentError = null;
    try {
      const response = await this.mailService.localTemplateContent(templateName);
      this.templateContentHtml = response?.htmlContent ?? null;
      this.lastTemplateContentTemplateName = templateName;
      this.applyTemplateContentFragmentPresence();
    } catch (error) {
      this.logger.error("localTemplateContent failed:", error);
      this.templateContentError = "Could not load template content.";
      this.templateContentHtml = null;
    } finally {
      this.templateContentFetching = false;
    }
  }

  private templateHasTopBottomPlaceholders(): boolean {
    if (!this.templateContentHtml) return false;
    return this.templateContentHtml.includes("BODY_CONTENT_TOP") || this.templateContentHtml.includes("BODY_CONTENT_BOTTOM");
  }

  private applyTemplateContentFragmentPresence(): void {
    if (this.templateHasTopBottomPlaceholders() || !!this.state.notificationConfig?.body) {
      this.ensureTemplateContentFragment();
    } else {
      this.removeTemplateContentFragment();
    }
  }

  private ensureTemplateContentFragment(): void {
    const order = this.state.fragmentOrder ?? [];
    if (order.some(f => f.kind === ComposerFragmentKind.TEMPLATE_CONTENT)) return;
    const introIdx = order.findIndex(f => f.kind === ComposerFragmentKind.INTRO);
    const insertAt = introIdx >= 0 ? introIdx + 1 : 0;
    const newFragment: ComposerFragment = { kind: ComposerFragmentKind.TEMPLATE_CONTENT, id: "template-content", dividerAfter: SectionDividerStyle.NONE };
    this.state.fragmentOrder = [...order.slice(0, insertAt), newFragment, ...order.slice(insertAt)];
  }

  private removeTemplateContentFragment(): void {
    if (!this.state.fragmentOrder) return;
    this.state.fragmentOrder = this.state.fragmentOrder.filter(f => f.kind !== ComposerFragmentKind.TEMPLATE_CONTENT);
  }

  protected onSignoffRolesChanged(): void {
    this.state.signoffRoles = this.validSignoffRolesFor(this.state.signoffRoles ?? []);
  }

  private validSignoffRolesFor(roles: string[]): string[] {
    const committeeRoles = this.committeeReferenceData?.committeeMembers() ?? [];
    return roles.filter(role => {
      const member = committeeRoles.find((candidate: any) => candidate.type === role);
      if (!member) return false;
      const fullNameText = (member.fullName ?? "").toLowerCase();
      const nameAndDescriptionText = (member.nameAndDescription ?? "").toLowerCase();
      const vacantByText = fullNameText.includes("vacant") || nameAndDescriptionText.includes("vacant");
      return !member.vacant && !vacantByText;
    });
  }

  private configToSlug(config: NotificationConfig | null): string | null {
    if (!config) return null;
    const text = config.subject?.text || config.id;
    return text ? this.stringUtils.kebabCase(text) : null;
  }

  private resolveConfigIdFromSlug(slug: string | null): string | null {
    if (!slug) return null;
    const configs = this.mailMessagingConfig?.notificationConfigs ?? [];
    const matched = configs.find(config => this.configToSlug(config) === slug || config.id === slug);
    if (matched) return matched.id ?? null;
    if (/^[a-f0-9]{24}$/i.test(slug)) return slug;
    return null;
  }

  bannerImageSource(): string {
    if (!this.state.notificationConfig) return "";
    return this.mailMessagingService.bannerImageSource(this.state.notificationConfig, true);
  }

  requiresConsent(): boolean {
    if (this.state.recipientMode !== RecipientMode.SELECTED_MEMBERS) return false;
    return this.mailMessagingConfig?.mailConfig?.respectHeadOfficeConsent !== false;
  }

  respectsBlocks(): boolean {
    return this.mailMessagingConfig?.mailConfig?.respectEmailBlocks === true;
  }

  recipientCountSummary(includeChannel = true): string {
    if (this.state.recipientMode === RecipientMode.ENTIRE_LIST) {
      const list = this.availableLists().find(item => item.id === this.state.selectedListId);
      if (!list) return "no list chosen";
      return includeChannel ? `${this.listNameAndCount(list)} (campaign)` : this.listNameAndCount(list);
    }
    const memberCount = this.state.selectedMemberIds.length;
    const toCount = this.state.externalRecipients?.length ?? 0;
    const ccCount = this.state.ccRecipients?.length ?? 0;
    const bccCount = this.state.bccRecipients?.length ?? 0;
    const externalParts: string[] = [];
    if (toCount > 0) externalParts.push(this.stringUtils.pluraliseWithCount(toCount, "to recipient"));
    if (ccCount > 0) externalParts.push(`${ccCount} cc`);
    if (bccCount > 0) externalParts.push(`${bccCount} bcc`);
    const externalSummary = externalParts.join(" + ");
    if (externalParts.length === 0) return this.stringUtils.pluraliseWithCount(memberCount, "member");
    if (memberCount === 0) return externalSummary;
    return `${this.stringUtils.pluraliseWithCount(memberCount, "member")} + ${externalSummary}`;
  }

  totalRecipientCount(): number {
    if (this.state.recipientMode === RecipientMode.ENTIRE_LIST) {
      const list = this.availableLists().find(item => item.id === this.state.selectedListId);
      return list ? this.subscribedMemberCount(list) : 0;
    }
    return this.state.selectedMemberIds.length
      + (this.state.externalRecipients?.length ?? 0)
      + (this.state.ccRecipients?.length ?? 0)
      + (this.state.bccRecipients?.length ?? 0);
  }

  protected campaignQueueNotice(): CampaignOverflowNotice | null {
    if (this.state.recipientMode !== RecipientMode.ENTIRE_LIST || this.state.brandingMode === BrandingMode.UNBRANDED) {
      return null;
    }
    return campaignOverflowNotice(
      this.totalRecipientCount(),
      this.mailMessagingConfig?.brevo?.account,
      this.campaignAutomaticReleaseEnabled()
    );
  }

  private campaignAutomaticReleaseEnabled(): boolean | null {
    return this.automaticCampaignReleaseTaskEnabled;
  }

  private async loadCampaignReleaseTaskState(): Promise<void> {
    try {
      const task = (await this.scheduledTaskService.tasks()).find(item => item.id === BREVO_CAMPAIGN_RELEASE_TASK_ID);
      this.automaticCampaignReleaseTaskEnabled = task?.enabled ?? null;
    } catch (error) {
      this.logger.error("loadCampaignReleaseTaskState failed:", error);
      this.automaticCampaignReleaseTaskEnabled = null;
    }
  }

  estimatedSendTime(): string {
    const count = this.state.selectedMemberIds.length
      + (this.state.externalRecipients?.length ?? 0)
      + (this.state.ccRecipients?.length ?? 0)
      + (this.state.bccRecipients?.length ?? 0);
    if (count === 0) return "0s";
    const seconds = Math.max(1, Math.ceil(count * 0.4));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} min`;
  }

  sendingChannelLabel(): string {
    return this.state.sendingChannel === SendingChannel.CAMPAIGN ? "to the whole list" : "to each member individually";
  }

  recipientsStepErrors(): string[] {
    const errors: string[] = [];
    if (this.state.recipientMode === RecipientMode.ENTIRE_LIST) {
      if (this.nonEmptyLists().length === 0) {
        errors.push("No mailing lists configured - set them up in Mail Settings before sending to a whole list");
      } else if (this.state.selectedListId === null) {
        errors.push("Choose which mailing list to send to");
      }
    } else {
      const externalCount = (this.state.externalRecipients?.length ?? 0)
        + (this.state.ccRecipients?.length ?? 0)
        + (this.state.bccRecipients?.length ?? 0);
      if (this.state.selectedMemberIds.length === 0 && externalCount === 0) {
        errors.push(this.state.brandingMode === BrandingMode.UNBRANDED
          ? "Select at least one member or add an external recipient"
          : "Select at least one member");
      }
      const blockedMembers = this.workflowRemovesRecipients() ? [] : this.blockedSelectedMembers();
      if (blockedMembers.length === 1) {
        errors.push(`${this.memberFullName(blockedMembers[0].member)} ${blockedMembers[0].reason} and cannot be emailed - choose a different recipient`);
      } else if (blockedMembers.length > 1) {
        errors.push(`${blockedMembers.length} chosen members cannot be emailed (no consent, blocked or unsubscribed) - remove them to continue`);
      }
    }
    return errors;
  }

  recipientsStepValid(): boolean {
    return this.recipientsStepErrors().length === 0;
  }

  recipientsStepValidationMessage(): string {
    return this.recipientsStepErrors().join("; ");
  }

  templateStepErrors(): ValidationError[] {
    const errors: ValidationError[] = [];
    if (this.state.brandingMode === BrandingMode.UNBRANDED) {
      if (!this.unbrandedSenderInfo().email) {
        errors.push("You are not linked to a committee role with a valid email on this site - unbranded sends must come from a verified committee role address. Ask a site administrator to map your member record to a committee role, or switch to Branded mode.");
      }
    } else if (!this.state.notificationConfig) {
      errors.push("Choose an email type");
    } else {
      if (!this.state.notificationConfig.templateName) errors.push(this.errorWithMailSettingsLink("This email type has no template configured - choose another or set one up in ", "Mail Settings"));
      if (!this.senderExists) errors.push(this.errorWithMailSettingsLink("The sender role for this email type is not set up - configure it in ", "Mail Settings"));
      if (!this.state.notificationConfig.senderRole) errors.push("Sender is missing from the email type configuration");
      if (!this.state.notificationConfig.replyToRole) errors.push("Reply-to is missing from the email type configuration");
      const committeeRoles = this.committeeReferenceData?.committeeMembers() ?? [];
      const roleExists = (role: string | undefined) => !!role && committeeRoles.some((member: any) => member.type === role);
      const roleHasEmail = (role: string | undefined) => !!role && committeeRoles.some((member: any) => member.type === role && !!member.email);
      const roleDescription = (role: string | undefined) => {
        const match = committeeRoles.find((member: any) => member.type === role);
        return match?.description || role || "";
      };
      const senderLabel = roleDescription(this.state.notificationConfig.senderRole);
      const replyToLabel = roleDescription(this.state.notificationConfig.replyToRole);
      if (this.state.notificationConfig.senderRole && !roleExists(this.state.notificationConfig.senderRole)) {
        errors.push(this.errorWithMailSettingsLink(`Sender role "${senderLabel}" is not a committee member - pick a different role below, or assign someone to it in `, "Mail Settings"));
      } else if (this.state.notificationConfig.senderRole && !roleHasEmail(this.state.notificationConfig.senderRole)) {
        errors.push(this.errorWithMailSettingsLink(`Sender role "${senderLabel}" has no email address - pick a different role below, or set an email for it in `, "Mail Settings"));
      }
      if (this.state.notificationConfig.replyToRole && !roleExists(this.state.notificationConfig.replyToRole)) {
        errors.push(this.errorWithMailSettingsLink(`Reply-to role "${replyToLabel}" is not a committee member - pick a different role below, or assign someone to it in `, "Mail Settings"));
      } else if (this.state.notificationConfig.replyToRole && !roleHasEmail(this.state.notificationConfig.replyToRole)) {
        errors.push(this.errorWithMailSettingsLink(`Reply-to role "${replyToLabel}" has no email address - pick a different role below, or set an email for it in `, "Mail Settings"));
      }
    }
    return errors;
  }

  private errorWithMailSettingsLink(before: string, linkText: string): ValidationErrorWithLink {
    return {
      before,
      linkText,
      linkRouterLink: "/" + AdminPath.MAIL_SETTINGS,
      linkQueryParams: this.mailSettingsQueryParams(),
      linkTarget: "_blank"
    };
  }

  private mailSettingsQueryParams(): Record<string, string> {
    const params: Record<string, string> = { [StoredValue.TAB]: "email-configurations" };
    const config = this.state.notificationConfig;
    if (config) {
      const text = config.subject?.text || config.id;
      if (text) params[StoredValue.CONFIGURATION] = this.stringUtils.kebabCase(text);
    }
    return params;
  }

  protected isPlainError(error: ValidationError): error is string {
    return isString(error);
  }

  protected templateStepErrorPlainText(error: ValidationError): string {
    return isString(error) ? error : `${error.before}${error.linkText}${error.after ?? ""}`;
  }

  unmatchedSignOffRoles(): string[] {
    if (!this.state.notificationConfig) return [];
    const committeeRoles = this.committeeReferenceData?.committeeMembers() ?? [];
    const roleExists = (role: string) => committeeRoles.some((member: any) => member.type === role);
    return (this.state.notificationConfig.signOffRoles ?? []).filter(role => !roleExists(role));
  }

  matchedSignOffRoles(): string[] {
    if (!this.state.notificationConfig) return [];
    const committeeRoles = this.committeeReferenceData?.committeeMembers() ?? [];
    const roleExists = (role: string) => committeeRoles.some((member: any) => member.type === role);
    return (this.state.notificationConfig.signOffRoles ?? []).filter(role => roleExists(role));
  }

  templateStepValid(): boolean {
    return this.templateStepErrors().length === 0;
  }

  templateStepValidationMessage(): string {
    return this.templateStepErrors().join("; ");
  }

  composeStepErrors(): string[] {
    const errors: string[] = [];
    if (!this.state.subject?.trim()) errors.push("Subject line is required");
    return errors;
  }

  eventsStepErrors(): string[] {
    const errors: string[] = [];
    if (this.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE && this.selectedGroupEventCount() === 0) {
      errors.push("Either select at least one event or choose 'No events'");
    }
    return errors;
  }

  protected composeStepOmitted(): boolean {
    return !!this.state.notificationConfig?.omitComposeStep;
  }

  protected eventsStepOmitted(): boolean {
    return this.state.brandingMode === BrandingMode.UNBRANDED || !!this.state.notificationConfig?.omitEventsStep;
  }

  eventsStepValid(): boolean {
    return this.eventsStepOmitted() || this.eventsStepErrors().length === 0;
  }

  composeStepValid(): boolean {
    return this.composeStepOmitted() || this.composeStepErrors().length === 0;
  }

  composeStepValidationMessage(): string {
    return this.composeStepErrors().join("; ");
  }

  composeStepNextDisabledMessage(): string {
    const parts: string[] = [];
    if (!this.composeStepValid()) parts.push(this.composeStepValidationMessage());
    if (!this.recipientsStepValid()) parts.push(this.recipientsStepValidationMessage());
    return parts.filter(p => p).join("; ");
  }

  recycledTrackingUrlsInState(): string[] {
    const sources = [this.state.introMarkdown, this.state.signoffTextMarkdown];
    (this.state.articleBlocks ?? []).forEach(block => {
      sources.push(block.markdown);
      sources.push(block.buttonUrl);
    });
    const found = new Set<string>();
    sources.forEach(source => findRecycledTrackingUrls(source).forEach(url => found.add(url)));
    return Array.from(found);
  }

  private autoResolveTrackingInProgress = false;

  protected async autoResolveTrackingUrls(): Promise<void> {
    if (this.autoResolveTrackingInProgress) return;
    const trackingUrls = this.recycledTrackingUrlsInState();
    if (trackingUrls.length === 0) return;
    this.autoResolveTrackingInProgress = true;
    try {
      const results = await Promise.all(trackingUrls.map(async url => {
        try {
          return await this.sendService.resolveTrackingUrl(url);
        } catch (error: any) {
          return { originalUrl: url, resolvedUrl: null, error: error?.message ?? String(error) } as const;
        }
      }));
      const replacements = new Map<string, string>();
      const failedUrls: string[] = [];
      for (const result of results) {
        if (result.resolvedUrl) {
          replacements.set(result.originalUrl, result.resolvedUrl);
        } else {
          failedUrls.push(result.originalUrl);
          this.logger.warn("auto-resolve tracking url failed - stripping link", result.originalUrl, result.error);
        }
      }
      this.state.introMarkdown = this.rewriteTrackingUrls(this.state.introMarkdown, replacements, failedUrls);
      this.state.signoffTextMarkdown = this.rewriteTrackingUrls(this.state.signoffTextMarkdown, replacements, failedUrls);
      (this.state.articleBlocks ?? []).forEach(block => {
        block.markdown = this.rewriteTrackingUrls(block.markdown, replacements, failedUrls);
        block.buttonUrl = this.rewriteTrackingUrls(block.buttonUrl, replacements, failedUrls);
      });
    } finally {
      this.autoResolveTrackingInProgress = false;
    }
  }

  private rewriteTrackingUrls(content: string | null | undefined, replacements: Map<string, string>, failedUrls: string[]): string {
    if (!content) return content ?? "";
    let next = content;
    for (const [from, to] of replacements) {
      next = next.split(from).join(to);
    }
    for (const url of failedUrls) {
      next = this.stripTrackingLink(next, url);
    }
    return next;
  }

  private stripTrackingLink(content: string, url: string): string {
    if (!content || !url) return content;
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const markdownLink = new RegExp(`\\[([^\\]]+)\\]\\(${escaped}\\)`, "g");
    let next = content.replace(markdownLink, "$1");
    const htmlLink = new RegExp(`<a\\b[^>]*href=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/a>`, "gi");
    next = next.replace(htmlLink, "$1");
    next = next.split(url).join("");
    return next;
  }

  canAccessStep(stepKey: EmailComposerStepKey): boolean {
    if (stepKey === EmailComposerStepKey.EVENTS && this.eventsStepOmitted()) return false;
    if (stepKey === EmailComposerStepKey.COMPOSE && this.composeStepOmitted()) return false;
    if (stepKey === EmailComposerStepKey.TEMPLATE) return true;
    if (stepKey === EmailComposerStepKey.RECIPIENTS) return this.templateStepValid();
    const isUnbranded = this.state.brandingMode === BrandingMode.UNBRANDED;
    if (stepKey === EmailComposerStepKey.COMPOSE) return this.templateStepValid() && (isUnbranded || this.recipientsStepValid());
    if (stepKey === EmailComposerStepKey.EVENTS) return this.templateStepValid() && this.recipientsStepValid() && this.composeStepValid();
    if (stepKey === EmailComposerStepKey.REVIEW) return this.templateStepValid() && this.recipientsStepValid() && this.composeStepValid();
    if (stepKey === EmailComposerStepKey.SEND) return this.templateStepValid() && this.recipientsStepValid() && this.composeStepValid();
    return false;
  }

  protected visibleStepperSteps(): typeof EMAIL_COMPOSER_STEPS {
    return EMAIL_COMPOSER_STEPS.filter(step => {
      if (step.key === EmailComposerStepKey.EVENTS && this.eventsStepOmitted()) return false;
      if (step.key === EmailComposerStepKey.COMPOSE && this.composeStepOmitted()) return false;
      return true;
    });
  }

  protected isStepVisible(key: EmailComposerStepKey): boolean {
    return this.visibleStepperSteps().some(step => step.key === key);
  }

  goToStep(index: number): void {
    if (this.sendInProgress) return;
    const step = this.stepperSteps[index];
    if (step && this.canAccessStep(step.key)) {
      this.stepperActiveTab = step.key;
      this.syncStateToUrl({ [StoredValue.TAB]: step.key });
      if (step.key === EmailComposerStepKey.COMPOSE || step.key === EmailComposerStepKey.REVIEW) {
        this.autoResolveTrackingUrls().catch(error => this.logger.warn("auto-resolve tracking urls failed", error));
      }
      if (step.key === EmailComposerStepKey.REVIEW) {
        this.refreshPreview().catch(error => this.logger.error("preview refresh failed", error));
      }
    }
  }

  protected goToStepKey(key: EmailComposerStepKey): void {
    if (this.sendInProgress) return;
    if (this.canAccessStep(key)) {
      this.stepperActiveTab = key;
      this.syncStateToUrl({ [StoredValue.TAB]: key });
      if (key === EmailComposerStepKey.COMPOSE || key === EmailComposerStepKey.REVIEW) {
        this.autoResolveTrackingUrls().catch(error => this.logger.warn("auto-resolve tracking urls failed", error));
      }
      if (key === EmailComposerStepKey.COMPOSE) {
        this.focusComposeEditor();
      }
      if (key === EmailComposerStepKey.REVIEW) {
        this.refreshPreview().catch(error => this.logger.error("preview refresh failed", error));
      }
    }
  }

  private focusComposeEditor(): void {
    const introFragment = (this.state.fragmentOrder ?? []).find(fragment => fragment.kind === ComposerFragmentKind.INTRO);
    if (!introFragment) {
      return;
    }
    this.expandedFragmentIds.add(introFragment.id);
    if (this.introEditorRef) {
      queueMicrotask(() => this.introEditorRef?.focusAtStart());
    } else {
      this.pendingIntroFocus = true;
    }
  }

  protected goNext(): void {
    const visible = this.visibleStepperSteps();
    const idx = visible.findIndex(step => step.key === this.stepperActiveTab);
    if (idx === -1 || idx >= visible.length - 1) return;
    this.goToStepKey(visible[idx + 1].key);
  }

  protected goPrev(): void {
    const visible = this.visibleStepperSteps();
    const idx = visible.findIndex(step => step.key === this.stepperActiveTab);
    if (idx <= 0) return;
    this.goToStepKey(visible[idx - 1].key);
  }

  onStepperValueChange(value: unknown): void {
    const key = value as EmailComposerStepKey;
    if (!key) return;
    this.stepperActiveTab = key;
    this.syncStateToUrl({ [StoredValue.TAB]: key });
    if (key === EmailComposerStepKey.COMPOSE) {
      this.focusComposeEditor();
    }
    if (key === EmailComposerStepKey.REVIEW) {
      this.refreshPreview().catch(error => this.logger.error("preview refresh failed", error));
    }
  }

  stepHint(key: EmailComposerStepKey): string {
    const fallback = EMAIL_COMPOSER_STEPS.find(step => step.key === key)?.hint ?? "";
    switch (key) {
      case EmailComposerStepKey.RECIPIENTS: {
        if (this.state.brandingMode !== BrandingMode.UNBRANDED && this.state.recipientMode === RecipientMode.ENTIRE_LIST) {
          const list = this.availableLists().find(item => item.id === this.state.selectedListId);
          return list ? this.listNameAndCount(list) : fallback;
        }
        const total = this.totalRecipientCount();
        return total > 0 ? this.recipientCountSummary() : fallback;
      }
      case EmailComposerStepKey.TEMPLATE: {
        return this.state.notificationConfig?.subject?.text || fallback;
      }
      case EmailComposerStepKey.COMPOSE: {
        const subject = this.state.subject?.trim();
        if (!subject) return fallback;
        return subject.length > 50 ? `${subject.slice(0, 50)}…` : subject;
      }
      default:
        return fallback;
    }
  }

  cancel(): void {
    if (!this.confirmLeaveComposer("Cancel")) {
      return;
    }
    this.leaveComposer();
  }

  exitComposer(): void {
    if (!this.confirmLeaveComposer("Exit composer")) {
      return;
    }
    this.leaveComposer();
  }

  private confirmLeaveComposer(action: string): boolean {
    if (this.hasUnsavedChanges() && !this.cancelArmed) {
      this.cancelArmed = true;
      this.notify.warning({
        title: "Discard email content?",
        message: `You have unsent email content. Click ${action} again to discard and leave.`
      });
      return false;
    }
    return true;
  }

  private leaveComposer(): void {
    if (this.inboxReplyContext) {
      this.navigateToInbox();
    } else {
      this.location.back();
    }
  }

  private navigateToInbox(): void {
    const maximised = this.route.snapshot.queryParamMap.get(StoredValue.MAXIMISE) === "true";
      this.router.navigate(["/" + AdminPath.INBOX], {
      queryParams: {
        ...(this.inboxReplyContext?.threadId ? {[StoredValue.THREAD]: this.inboxReplyContext.threadId} : {}),
        ...(maximised ? {[StoredValue.MAXIMISE]: "true"} : {})
      },
      replaceUrl: true
    });
  }

  protected cancelArmed: boolean = false;
  protected sendConfirm = new Confirm();

  private hasUnsavedChanges(): boolean {
    return !!this.state.subject?.trim()
      || !!this.state.introMarkdown?.trim()
      || !!this.state.signoffTextMarkdown?.trim()
      || (this.state.articleBlocks ?? []).length > 0
      || (this.state.selectedMemberIds ?? []).length > 0
      || (this.state.externalRecipients ?? []).length > 0
      || (this.state.ccRecipients ?? []).length > 0
      || (this.state.bccRecipients ?? []).length > 0
      || !!this.state.selectedListId;
  }

  protected hasContentToDraft(): boolean {
    return this.hasUnsavedChanges();
  }

  protected async refreshDrafts(): Promise<void> {
    try {
      const all = await this.compositionsService.listSummaries();
      this.drafts = all.filter(c => c.status === EmailCompositionStatus.Draft);
      this.sentEmails = all.filter(c => c.status === EmailCompositionStatus.Sent);
    } catch (error) {
      this.logger.error("refreshDrafts failed:", error);
      this.drafts = [];
      this.sentEmails = [];
    }
  }

  protected toggleDraftsPanel(): void {
    this.draftsPanelOpen = !this.draftsPanelOpen;
    if (this.draftsPanelOpen) {
      this.sentEmailsPanelOpen = false;
      this.refreshDrafts().catch(error => this.logger.error("refreshDrafts failed:", error));
    }
  }

  protected toggleSentEmailsPanel(): void {
    this.sentEmailsPanelOpen = !this.sentEmailsPanelOpen;
    if (this.sentEmailsPanelOpen) {
      this.draftsPanelOpen = false;
      this.refreshDrafts().catch(error => this.logger.error("refreshDrafts failed:", error));
    }
  }

  protected sentDescription(composition: EmailCompositionSummary): string {
    if (!composition.sentAt) return "";
    const ownerName = this.compositionOwnerName(composition);
    const when = this.dateUtils.displayDateAndTime(composition.sentAt);
    return ownerName ? `Sent by ${ownerName} on ${when}` : `Sent ${when}`;
  }

  protected compositionOwnerName(composition: EmailCompositionSummary): string | null {
    const owner = this.members?.find(m => m.id === composition.ownerMemberId);
    if (!owner) return null;
    const name = `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim();
    return name || null;
  }

  protected pendingDraftDeleteId: string | null = null;

  protected requestDeleteDraft(id: string): void {
    this.pendingDraftDeleteId = id;
  }

  protected cancelDeleteDraft(): void {
    this.pendingDraftDeleteId = null;
  }

  protected async confirmDeleteDraft(id: string): Promise<void> {
    this.pendingDraftDeleteId = null;
    await this.deleteDraft(id);
  }

  protected async useAsTemplate(id: string): Promise<void> {
    try {
      const sent = await this.compositionsService.load(id);
      if (!sent) return;
      const restored: any = JSON.parse(JSON.stringify(sent.state));
      const selectedGroupEventIds = this.applyRestoredStateDefaults(restored);
      this.state = restored as EmailComposerState;
      if (this.state.subject) this.state.subject = `Copy of ${this.state.subject}`;
      this.currentDraftId = null;
      this.lastSavedAt = null;
      this.currentComposition = null;
      this.composeShared = false;
      this.sentEmailsPanelOpen = false;
      this.routeCompositionKey = `copy-of:${id}`;
      this.syncStateToUrl({ [StoredValue.DRAFT_ID]: null, [StoredValue.COPY_OF]: id });
      await this.rehydrateAfterLoad(selectedGroupEventIds);
      this.notify.success({ title: "Loaded as template", message: "Edit and save as a new draft" });
    } catch (error) {
      this.logger.error("useAsTemplate failed:", error);
      this.notify.error({ title: "Use as template failed", message: String(error) });
    }
  }

  protected async onSharedToggled(value: boolean): Promise<void> {
    this.composeShared = value;
    if (this.currentDraftId) {
      try {
        const updated = await this.compositionsService.save(this.state, this.currentDraftId, this.composeShared);
        this.lastSavedAt = updated.savedAt;
        await this.refreshDrafts();
      } catch (error) {
        this.logger.error("onSharedToggled save failed:", error);
        this.notify.error({ title: "Sharing change failed", message: String(error) });
      }
    }
  }

  protected async saveDraft(): Promise<void> {
    if (!this.hasUnsavedChanges()) return;
    try {
      const draft = await this.compositionsService.save(this.state, this.currentDraftId, this.composeShared);
      this.currentDraftId = draft.id;
      this.lastSavedAt = draft.savedAt;
      this.currentComposition = draft;
      this.routeCompositionKey = `draft:${draft.id}`;
      this.syncStateToUrl({ [StoredValue.DRAFT_ID]: draft.id, [StoredValue.COPY_OF]: null });
      await this.refreshDrafts();
      this.notify.success({ title: "Draft saved", message: draft.title });
    } catch (error) {
      this.logger.error("saveDraft failed:", error);
      this.notify.error({ title: "Save draft failed", message: String(error) });
    }
  }

  protected async revertToSavedDraft(): Promise<void> {
    if (!this.currentDraftId) return;
    await this.loadDraft(this.currentDraftId);
  }

  protected async loadDraft(id: string): Promise<void> {
    try {
      const draft = await this.compositionsService.load(id);
      if (!draft) return;
      const restored: any = JSON.parse(JSON.stringify(draft.state));
      const selectedGroupEventIds = this.applyRestoredStateDefaults(restored);
      this.state = restored as EmailComposerState;
      this.currentDraftId = draft.id;
      this.lastSavedAt = draft.savedAt;
      this.currentComposition = draft;
      this.composeShared = draft.shared;
      this.draftsPanelOpen = false;
      this.routeCompositionKey = `draft:${draft.id}`;
      this.syncStateToUrl({ [StoredValue.DRAFT_ID]: draft.id, [StoredValue.COPY_OF]: null });
      await this.rehydrateAfterLoad(selectedGroupEventIds);
      this.notify.success({ title: "Draft loaded", message: draft.title });
    } catch (error) {
      this.logger.error("loadDraft failed:", error);
      this.notify.error({ title: "Load draft failed", message: String(error) });
    }
  }

  private restoredMediaIndexById: Record<string, number> = {};

  private restoredDateValue(stored: { value?: number } | null | undefined): DateValue | null {
    return isNumber(stored?.value) ? this.dateUtils.asDateValue(stored!.value) : null;
  }

  private applyRestoredStateDefaults(restored: any): string[] {
    const selectedGroupEventIds: string[] = restored.selectedGroupEventIds ?? [];
    this.restoredMediaIndexById = restored.groupEventMediaIndexById ?? {};
    delete restored.selectedGroupEventIds;
    delete restored.groupEventMediaIndexById;
    restored.groupEvents = [];
    restored.notificationConfigListing = this.state.notificationConfigListing;
    restored.brandingMode = restored.brandingMode ?? BrandingMode.BRANDED;
    restored.unbrandedSenderRoleType = restored.unbrandedSenderRoleType ?? null;
    restored.externalRecipients = restored.externalRecipients ?? [];
    restored.ccRecipients = restored.ccRecipients ?? [];
    restored.bccRecipients = restored.bccRecipients ?? [];
    restored.selectedMemberIds = restored.selectedMemberIds ?? [];
    restored.signoffRoles = restored.signoffRoles ?? [];
    restored.fragmentOrder = restored.fragmentOrder ?? [];
    restored.articleBlocks = restored.articleBlocks ?? [];
    if (restored.groupEventsFilter) {
      restored.groupEventsFilter.fromDate = this.restoredDateValue(restored.groupEventsFilter.fromDate);
      restored.groupEventsFilter.toDate = this.restoredDateValue(restored.groupEventsFilter.toDate);
    }
    if (restored.brandingMode === BrandingMode.UNBRANDED && restored.recipientMode === RecipientMode.ENTIRE_LIST) {
      restored.recipientMode = RecipientMode.SELECTED_MEMBERS;
      restored.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
    }
    return selectedGroupEventIds;
  }

  private async rehydrateAfterLoad(selectedGroupEventIds: string[]): Promise<void> {
    if (!this.state.notificationConfigListing && this.mailMessagingConfig) {
      this.state.notificationConfigListing = {
        mailMessagingConfig: this.mailMessagingConfig,
        includeWorkflowRelatedConfigs: false,
        forceIncludeConfigIds: this.forcedConfigId ? [this.forcedConfigId] : []
      };
    }
    const storedConfigId = (this.state.notificationConfig as any)?.id;
    if (storedConfigId && this.state.notificationConfigListing) {
      const liveConfig = this.mailMessagingService.notificationConfigs(this.state.notificationConfigListing)
        .find(config => config.id === storedConfigId);
      if (liveConfig) this.state.notificationConfig = liveConfig;
    }
    if (!this.state.notificationConfig && this.state.brandingMode !== BrandingMode.UNBRANDED) {
      this.autoSelectNotificationConfig();
    }
    if (this.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE && this.state.groupEventsFilter) {
      await this.populateGroupEvents();
      const selectedSet = new Set(selectedGroupEventIds);
      this.state.groupEvents = this.state.groupEvents.map(event => {
        const restored = { ...event, selected: event.id ? selectedSet.has(event.id) : false } as GroupEventSummary;
        const savedIndex = event.id ? this.restoredMediaIndexById[event.id] : undefined;
        if (isNumber(savedIndex)) {
          this.applyMediaSelection(restored, this.clampMediaIndex(restored, savedIndex));
        }
        return restored;
      });
    }
    if (this.state.eventInclusion === EventInclusionMode.SINGLE_EVENT) {
      const storedSingleId = (this.state.singleEvent as any)?.id;
      if (storedSingleId) {
        await this.loadSingleEvent(storedSingleId);
      }
    }
    const allIds = this.allFragmentCommitteeFileIds();
    if (allIds.length > 0) {
      if (this.allCommitteeFiles.length === 0) {
        await this.loadAllCommitteeFiles();
      }
      await this.resolveCommitteeFiles(allIds);
    }
  }

  protected async deleteDraft(id: string): Promise<void> {
    try {
      await this.compositionsService.remove(id);
      if (this.currentDraftId === id) {
        this.currentDraftId = null;
        this.lastSavedAt = null;
        this.routeCompositionKey = null;
        this.syncStateToUrl({ [StoredValue.DRAFT_ID]: null });
      }
      await this.refreshDrafts();
    } catch (error) {
      this.logger.error("deleteDraft failed:", error);
    }
  }

  protected newComposition(): void {
    this.forcedMemberId = null;
    this.routeCompositionKey = null;
    this.syncStateToUrl({ [StoredValue.MEMBER]: null, [StoredValue.DRAFT_ID]: null, [StoredValue.COPY_OF]: null });
    this.state = defaultEmailComposerState();
    if (this.mailMessagingConfig) {
      this.state.notificationConfigListing = {
        mailMessagingConfig: this.mailMessagingConfig,
        includeWorkflowRelatedConfigs: false,
        forceIncludeConfigIds: this.forcedConfigId ? [this.forcedConfigId] : []
      };
      this.autoSelectNotificationConfig();
    }
    this.currentDraftId = null;
    this.lastSavedAt = null;
    this.composeShared = false;
    this.draftsPanelOpen = false;
    this.stepperActiveTab = EmailComposerStepKey.RECIPIENTS;
    this.batchProgress = null;
    this.campaignSendComplete = false;
    this.committeeFiles = new Map();
    this.committeeFileUrlInput = "";
    this.committeeFileUrlError = null;
    this.committeeFileUrlAllowedIds = null;
    this.sendConfirm.clear();
    this.notify.hide();
  }

  protected lastSavedDescription(): string {
    if (!this.currentComposition) return "";
    const owner = this.members?.find(m => m.id === this.currentComposition!.ownerMemberId);
    const ownerName = owner ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() : null;
    const when = this.dateUtils.displayDateAndTime(this.currentComposition.savedAt);
    const verb = this.currentComposition.status === "sent" ? "Sent" : "Created";
    if (ownerName) return `${this.currentComposition.title} ${verb} by ${ownerName} on ${when}`;
    return `${this.currentComposition.title} ${verb} on ${when}`;
  }

  protected draftSavedDescription(draft: EmailCompositionSummary): string {
    const ownerName = this.compositionOwnerName(draft);
    const when = this.dateUtils.displayDateAndTime(draft.savedAt);
    const verb = draft.status === "sent" ? "Sent" : "Created";
    return ownerName ? `${verb} by ${ownerName} on ${when}` : `${verb} on ${when}`;
  }

  private autoPreviewAttempts = 0;
  private maybeAutoRefreshPreview(): void {
    if (!this.autoPreviewPending) return;
    if (this.stepperActiveTab !== EmailComposerStepKey.REVIEW) return;
    if (!this.state.notificationConfig?.templateName) return;
    this.autoPreviewPending = false;
    this.autoPreviewAttempts = 0;
    const tryRender = () => {
      if (this.emailPreview) {
        this.refreshPreview().catch(error => this.logger.error("auto preview refresh failed", error));
        return;
      }
      this.autoPreviewAttempts += 1;
      if (this.autoPreviewAttempts > 20) return;
      setTimeout(tryRender, 100);
    };
    setTimeout(tryRender, 100);
  }

  protected previewRecipients(): Member[] {
    return this.previewEntries()
      .map(entry => entry.member)
      .filter((m): m is Member => !!m);
  }

  protected previewEntries(): { name: string; member?: Member; external?: ComposerExternalRecipient }[] {
    if (this.state.brandingMode !== BrandingMode.UNBRANDED && this.state.recipientMode === RecipientMode.ENTIRE_LIST && this.state.selectedListId !== null) {
      return this.members
        .filter(this.memberService.filterFor.GROUP_MEMBERS)
        .filter(member => this.mailListUpdaterService.memberSubscribed(member, this.state.selectedListId!))
        .map(member => ({ name: this.previewMemberName(member), member }));
    }
    const idSet = new Set(this.state.selectedMemberIds ?? []);
    const memberEntries: { name: string; member?: Member; external?: ComposerExternalRecipient }[] = idSet.size > 0
      ? this.candidateMembers()
        .filter(member => idSet.has(member.id ?? ""))
        .map(member => ({ name: this.previewMemberName(member), member }))
      : [];
    const externalEntries: { name: string; member?: Member; external?: ComposerExternalRecipient }[] = (this.state.externalRecipients ?? []).map(external => ({
      name: external.name?.trim() || external.email,
      external
    }));
    return [...memberEntries, ...externalEntries];
  }

  private previewMemberName(member: Member): string {
    const fullName = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
    return fullName || member.displayName?.trim() || member.email || "";
  }

  protected previewRecipientCount(): number {
    return this.previewEntries().length;
  }

  protected previewRecipientLabel(): string {
    const entries = this.previewEntries();
    const count = entries.length;
    if (count === 0) return "No recipients";
    const current = Math.min(this.previewRecipientIndex + 1, count);
    const entry = entries[this.previewRecipientIndex] ?? null;
    const name = entry?.name ?? "";
    return name ? `${current} of ${count} - ${name}` : `${current} of ${count}`;
  }

  protected canStepPreview(direction: PreviewStepDirection): boolean {
    const count = this.previewRecipientCount();
    if (count <= 1) return false;
    if (direction === PreviewStepDirection.First || direction === PreviewStepDirection.Prev) return this.previewRecipientIndex > 0;
    return this.previewRecipientIndex < count - 1;
  }

  protected stepPreview(direction: PreviewStepDirection): void {
    const count = this.previewRecipientCount();
    if (count === 0) return;
    if (direction === PreviewStepDirection.First) this.previewRecipientIndex = 0;
    else if (direction === PreviewStepDirection.Last) this.previewRecipientIndex = count - 1;
    else if (direction === PreviewStepDirection.Prev) this.previewRecipientIndex = Math.max(0, this.previewRecipientIndex - 1);
    else this.previewRecipientIndex = Math.min(count - 1, this.previewRecipientIndex + 1);
    this.refreshPreview().catch(error => this.logger.error("preview step failed", error));
  }

  async refreshPreview(): Promise<void> {
    const isUnbranded = this.state.brandingMode === BrandingMode.UNBRANDED;
    if (!isUnbranded && !this.state.notificationConfig?.templateName) {
      this.emailPreview?.showError("Choose a template to render the preview.");
      return;
    }
    try {
      await this.resolveCommitteeFileLinksForSend();
    } catch (error) {
      this.logger.error("refreshPreview committee file link resolution failed", error);
      this.emailPreview?.showError(this.errorMessage(error), "Committee document can't be linked");
      return;
    }
    const { top, bottom, combined } = this.composedBodyParts();
    const entries = this.previewEntries();
    if (entries.length > 0 && this.previewRecipientIndex >= entries.length) {
      this.previewRecipientIndex = entries.length - 1;
    }
    const entry = entries[this.previewRecipientIndex] ?? null;
    const memberId = entry?.member?.id ?? this.memberLoginService.loggedInMember().memberId;
    const member = await this.memberService.getById(memberId);
    const params = this.mailMessagingService.createSendSmtpEmailParams(
      member,
      this.state.notificationConfig as NotificationConfig,
      combined,
      this.state.subject,
      "",
      top,
      bottom
    );
    params.messageMergeFields.subject = isUnbranded ? this.state.subject : this.applySubjectAffixes(this.state.subject, params);
    const request: TemplateRenderRequest = isUnbranded
      ? { htmlContent: combined, params, brandingMode: BrandingMode.UNBRANDED }
      : {
        templateName: this.state.notificationConfig!.templateName,
        templateOverrides: this.state.notificationConfig!.templateOverrides,
        body: this.state.notificationConfig!.body,
        htmlContent: combined,
        params
      };
    await this.emailPreview.render(request);
  }

  private addresseePlaceholder(): string {
    return ADDRESSEE_OPTIONS.find(option => option.key === this.state.addresseeType)?.placeholder ?? "";
  }

  private applySubjectAffixes(subject: string, params: SendSmtpEmailParams): string {
    const subjectConfig = this.state.notificationConfig?.subject;
    const resolve = (path: string | null | undefined): string | null => {
      if (!path) return null;
      const value = path.split(".").reduce<any>((acc, key) => acc?.[key], params);
      return isString(value) && value ? value : null;
    };
    const prefix = resolve(subjectConfig?.prefixParameter);
    const suffix = resolve(subjectConfig?.suffixParameter);
    return [prefix, subject, suffix].filter(value => value).join(" - ");
  }

  private composedBodyParts(): { top: string; bottom: string; combined: string } {
    this.ensureFragmentOrder();
    const fragments = this.state.fragmentOrder ?? [];
    const articleBlocksById = new Map((this.state.articleBlocks ?? []).map(block => [block.id, block]));
    const renderFragment = (fragment: ComposerFragment): string => {
      switch (fragment.kind) {
        case ComposerFragmentKind.INTRO: return this.rendering.markdownToHtml(this.state.introMarkdown);
        case ComposerFragmentKind.SIGNOFF: {
          const textHtml = this.rendering.markdownToHtml(this.state.signoffTextMarkdown);
          const renderableRoles = this.validSignoffRolesFor(this.state.signoffRoles ?? []);
          const namesHtml = renderableRoles.length > 0
            ? this.mailMessagingService.signoffNames(renderableRoles, this.notificationDirective)
            : "";
          return [textHtml, namesHtml].filter(s => s && s.trim()).join("\n");
        }
        case ComposerFragmentKind.EVENTS: return this.renderedEventsHtml();
        case ComposerFragmentKind.COMMITTEE_FILE: return this.renderedCommitteeFileHtmlForFragment(fragment);
        case ComposerFragmentKind.TEMPLATE_CONTENT: return "";
        case ComposerFragmentKind.DIVIDER: return dividerHtml(fragment.dividerAfter ?? SectionDividerStyle.THIN_ROSYCHEEKS);
        case ComposerFragmentKind.ARTICLE: {
          const block = articleBlocksById.get(fragment.id);
          if (!block) return "";
          return this.rendering.renderArticleBlocksAsList([block], block.position).join("");
        }
        case ComposerFragmentKind.MULTI_COLUMN: return renderMultiColumn(fragment);
        default: return "";
      }
    };
    const renderColumn = (columnFragments: ComposerFragment[]): string =>
      this.rendering.joinSectionsWithPerSectionDividers(columnFragments.map(f => ({
        content: renderFragment(f),
        dividerAfter: f.kind === ComposerFragmentKind.DIVIDER ? SectionDividerStyle.NONE : (f.dividerAfter ?? SectionDividerStyle.THIN_YELLOW)
      })));
    const renderMultiColumn = (fragment: ComposerFragment): string => {
      const columns = fragment.columns ?? [];
      if (columns.length === 0) return "";
      const widthPct = (100 / columns.length).toFixed(4);
      const gap = fragment.columnGapPx ?? DEFAULT_COLUMN_GAP_PX;
      const cells = columns.map(columnFragments =>
        `<td valign="top" width="${widthPct}%" style="padding:0;vertical-align:top;">${renderColumn(columnFragments)}</td>`
      ).join("");
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:${gap}px 0;table-layout:fixed;width:100%;"><tr>${cells}</tr></table>`;
    };
    const templateContentIndex = fragments.findIndex(f => f.kind === ComposerFragmentKind.TEMPLATE_CONTENT);
    const beforeFragments = templateContentIndex >= 0 ? fragments.slice(0, templateContentIndex) : fragments;
    const afterFragments = templateContentIndex >= 0 ? fragments.slice(templateContentIndex + 1) : [];
    const templateContentFragment = templateContentIndex >= 0 ? fragments[templateContentIndex] : null;
    const toSections = (list: ComposerFragment[]) => list.map(f => ({
      content: renderFragment(f),
      dividerAfter: f.kind === ComposerFragmentKind.DIVIDER ? SectionDividerStyle.NONE : (f.dividerAfter ?? SectionDividerStyle.THIN_YELLOW)
    }));
    const hasTemplateContent = templateContentIndex >= 0;
    const renderedTop = this.rendering.joinSectionsWithPerSectionDividers(toSections(beforeFragments), hasTemplateContent);
    const renderedBottom = this.rendering.joinSectionsWithPerSectionDividers(toSections(afterFragments));
    const leadingBottomDivider = hasTemplateContent && templateContentFragment && renderedBottom.trim().length > 0
      ? dividerHtml(templateContentFragment.dividerAfter ?? SectionDividerStyle.THIN_YELLOW)
      : "";
    const bottom = leadingBottomDivider ? `${leadingBottomDivider}\n${renderedBottom}` : renderedBottom;
    const renderedCombined = this.rendering.joinSectionsWithPerSectionDividers(toSections(fragments));
    const salutationHtml = this.salutationHtml();
    const top = salutationHtml ? `${salutationHtml}\n${renderedTop}` : renderedTop;
    const combined = salutationHtml ? `${salutationHtml}\n${renderedCombined}` : renderedCombined;
    return { top, bottom, combined };
  }

  private salutationHtml(): string {
    const placeholder = this.addresseePlaceholder();
    return placeholder ? `<p>${placeholder}</p>` : "";
  }

  protected ensureFragmentOrder(): void {
    const isUnbranded = this.state.brandingMode === BrandingMode.UNBRANDED;
    if (!this.state.fragmentOrder || this.state.fragmentOrder.length === 0) {
      this.state.fragmentOrder = buildDefaultFragmentOrder(this.state, { includeTemplateContent: !isUnbranded, unbranded: isUnbranded });
      if (isUnbranded) {
        this.expandedFragmentIds.add("intro");
      }
      return;
    }
    const articleIds = new Set((this.state.articleBlocks ?? []).map(b => b.id));
    const collectArticleFragmentIds = (list: ComposerFragment[]): string[] =>
      list.flatMap(fragment => {
        if (fragment.kind === ComposerFragmentKind.ARTICLE) return [fragment.id];
        if (fragment.kind === ComposerFragmentKind.MULTI_COLUMN) {
          return (fragment.columns ?? []).flatMap(column => collectArticleFragmentIds(column));
        }
        return [];
      });
    const knownFragmentArticleIds = new Set(collectArticleFragmentIds(this.state.fragmentOrder));
    const missingArticles = (this.state.articleBlocks ?? []).filter(b => !knownFragmentArticleIds.has(b.id));
    if (missingArticles.length > 0) {
      const eventsIdx = this.state.fragmentOrder.findIndex(f => f.kind === ComposerFragmentKind.EVENTS);
      const insertAt = eventsIdx >= 0 ? eventsIdx : this.state.fragmentOrder.length;
      const newFragments: ComposerFragment[] = missingArticles.map(b => ({
        kind: ComposerFragmentKind.ARTICLE,
        id: b.id,
        dividerAfter: b.dividerAfter ?? this.state.betweenArticlesDivider ?? SectionDividerStyle.THIN_YELLOW
      }));
      this.state.fragmentOrder = [
        ...this.state.fragmentOrder.slice(0, insertAt),
        ...newFragments,
        ...this.state.fragmentOrder.slice(insertAt)
      ];
    }
    const pruneOrphanArticles = (list: ComposerFragment[]): ComposerFragment[] =>
      list
        .filter(f => f.kind !== ComposerFragmentKind.ARTICLE || articleIds.has(f.id))
        .map(f => f.kind === ComposerFragmentKind.MULTI_COLUMN
          ? { ...f, columns: (f.columns ?? []).map(column => pruneOrphanArticles(column)) }
          : f);
    this.state.fragmentOrder = pruneOrphanArticles(this.state.fragmentOrder);
  }

  sendDisabled(): boolean {
    return this.sendInProgress || !this.canAccessStep(EmailComposerStepKey.SEND);
  }

  sendDisabledReason(): string {
    if (this.sendInProgress) return "Sending in progress";
    if (this.unbrandedListSendBlocked()) return `Unbranded sends to more than ${UNBRANDED_HARD_CAP_RECIPIENTS} recipients are blocked - switch to Branded mode or reduce the recipient count.`;
    if (!this.recipientsStepValid()) return this.recipientsStepValidationMessage();
    if (!this.templateStepValid()) return this.templateStepValidationMessage();
    if (!this.composeStepValid()) return this.composeStepValidationMessage();
    return "";
  }

  protected subjectStartsWithCopyOf(): boolean {
    return !!this.state.subject?.trim().toLowerCase().startsWith("copy of ");
  }

  protected subjectUnchangedFromDefault(): boolean {
    const subjectConfig = this.state.notificationConfig?.subject;
    if (!subjectConfig) {
      return false;
    }
    if (subjectConfig.prefixParameter || subjectConfig.suffixParameter) {
      return false;
    }
    const defaultText = (subjectConfig.text ?? "").trim();
    const current = (this.state.subject ?? "").trim();
    return !!defaultText && current === defaultText;
  }

  protected hasSendBlockers(): boolean {
    return this.subjectStartsWithCopyOf() || this.unbrandedListSendBlocked();
  }

  protected unbrandedListSendBlocked(): boolean {
    return this.state.brandingMode === BrandingMode.UNBRANDED
      && this.totalRecipientCount() > UNBRANDED_HARD_CAP_RECIPIENTS;
  }

  protected unbrandedListSendSignals(): { manyRecipients: boolean; pulledFromList: boolean; notAReply: boolean; longBody: boolean; promotionalLanguage: boolean } {
    const total = this.totalRecipientCount();
    const manyRecipients = total > UNBRANDED_LIST_SEND_WARNING_THRESHOLD;
    const pulledFromList = (this.state.selectedMemberIds?.length ?? 0) > 0
      || !!this.state.preFilterKey
      || !!this.state.narrowListId;
    const subject = this.state.subject ?? "";
    const subjectIsAReplyOrForward = subject.trim().length > 0 && REPLY_OR_FORWARD_SUBJECT_PATTERN.test(subject);
    const bodyText = `${this.state.introMarkdown ?? ""}\n${this.state.signoffTextMarkdown ?? ""}`;
    const bodyIsLong = bodyText.length >= UNBRANDED_LONG_BODY_CHAR_THRESHOLD;
    const promotionalLanguage = PROMOTIONAL_LANGUAGE_PATTERN.test(bodyText);
    const notAReplyRuleEnabled = false;
    const longBodyRuleEnabled = false;
    const notAReply = notAReplyRuleEnabled && !subjectIsAReplyOrForward;
    const longBody = longBodyRuleEnabled && bodyIsLong;
    return { manyRecipients, pulledFromList, notAReply, longBody, promotionalLanguage };
  }

  protected unbrandedListSendWarningReasons(): string[] {
    const signals = this.unbrandedListSendSignals();
    const reasons: string[] = [];
    if (signals.manyRecipients) reasons.push(`${this.totalRecipientCount()} recipients - more than the ${UNBRANDED_LIST_SEND_WARNING_THRESHOLD}-recipient threshold for a one-to-few send`);
    if (signals.pulledFromList) {
      if ((this.state.selectedMemberIds?.length ?? 0) > 0) {
        reasons.push(`${this.stringUtils.pluraliseWithCount(this.state.selectedMemberIds.length, "recipient")} picked from the member list rather than typed in by hand`);
      } else if (this.state.preFilterKey) {
        reasons.push(`Recipients filtered via "${this.state.preFilterKey}" rather than typed in by hand`);
      } else if (this.state.narrowListId) {
        reasons.push("Recipients narrowed to a mailing list rather than typed in by hand");
      }
    }
    if (signals.notAReply) reasons.push("Subject does not start with \"Re:\" or \"Fwd:\", so this is not a reply or forward");
    if (signals.longBody) reasons.push(`Body is ${this.unbrandedBodyTextLength()} characters - longer than the ${UNBRANDED_LONG_BODY_CHAR_THRESHOLD}-character threshold for a short reply`);
    if (signals.promotionalLanguage) reasons.push("Body contains marketing-style language (e.g. donate, fundraise, charity, appeal, sponsor, volunteer, register)");
    return reasons;
  }

  private unbrandedBodyTextLength(): number {
    return (this.state.introMarkdown ?? "").length + 1 + (this.state.signoffTextMarkdown ?? "").length;
  }

  protected showUnbrandedListSendWarning(): boolean {
    if (this.state.brandingMode !== BrandingMode.UNBRANDED) return false;
    if (this.unbrandedListSendBlocked()) return false;
    if (this.unbrandedListSendWarningDismissed) return false;
    const trimmedBody = (this.state.introMarkdown ?? "").trim();
    if (trimmedBody.length < 50) return false;
    const signals = this.unbrandedListSendSignals();
    const triggered = [signals.manyRecipients, signals.pulledFromList, signals.notAReply, signals.longBody, signals.promotionalLanguage].filter(Boolean).length;
    return triggered >= 2;
  }

  protected dismissUnbrandedListSendWarning(): void {
    this.unbrandedListSendWarningDismissed = true;
  }

  protected switchToBrandedFromWarning(): void {
    this.setBrandingMode(BrandingMode.BRANDED);
  }

  protected goToCompose(): void {
    this.sendConfirm.clear();
    this.goToStep(2);
  }

  protected armSend(): void {
    if (this.hasSendBlockers()) return;
    this.sendConfirm.as(ConfirmType.SEND_NOTIFICATION);
  }

  protected cancelSendConfirm(): void {
    this.sendConfirm.clear();
  }

  async confirmAndSend(): Promise<void> {
    if (this.hasSendBlockers()) {
      this.sendConfirm.clear();
      return;
    }
    if (!this.sendConfirm.notificationsOutstanding()) {
      this.armSend();
      return;
    }
    this.sendConfirm.clear();
    this.sendInProgress = true;
    try {
      const useCampaign = this.state.recipientMode === RecipientMode.ENTIRE_LIST && this.state.brandingMode !== BrandingMode.UNBRANDED;
      if (useCampaign) {
        await this.sendCampaign();
      } else {
        await this.startBatchTransactionalSend();
      }
    } catch (error) {
      this.logger.error("send failed", error);
      this.notify.error({ title: "Send failed", message: this.errorMessage(error) });
      this.sendInProgress = false;
    }
  }

  private async sendCampaign(): Promise<void> {
    await this.loadCampaignReleaseTaskState();
    const groupMembers = await this.memberService.privilegedFields(this.memberService.filterFor.GROUP_MEMBERS);
    await this.mailListUpdaterService.updateMailLists(this.notify, groupMembers);
    const member = await this.memberService.getById(this.memberLoginService.loggedInMember().memberId);
    await this.resolveCommitteeFileLinksForSend();
    const { top, bottom, combined } = this.composedBodyParts();
    const campaignTop = toCampaignContactTokens(top);
    const campaignBottom = toCampaignContactTokens(bottom);
    const campaignCombined = toCampaignContactTokens(combined);
    const overflowNotice = this.campaignQueueNotice();
    const params = this.mailMessagingService.createSendSmtpEmailParams(
      member,
      this.state.notificationConfig!,
      campaignCombined,
      this.state.subject,
      "",
      campaignTop,
      campaignBottom
    );
    const request: CreateCampaignRequest = {
      createAsDraft: false,
      templateName: this.state.notificationConfig!.templateName,
      htmlContent: campaignCombined,
      inlineImageActivation: false,
      mirrorActive: false,
      name: this.state.subject,
      tag: NGX_BREVO_CAMPAIGN_TAG,
      params,
      recipients: { listIds: [this.state.selectedListId!] },
      replyTo: this.committeeReferenceData?.contactUsField(this.state.notificationConfig!.replyToRole, "email") ?? "",
      sender: {
        email: this.committeeReferenceData?.contactUsField(this.state.notificationConfig!.senderRole, "email") ?? "",
        name: this.committeeReferenceData?.contactUsField(this.state.notificationConfig!.senderRole, "fullName") ?? ""
      },
      subject: this.state.subject
    };
    const created: StatusMappedResponseSingleInput = await this.mailService.createCampaign(request);
    const campaignId: number = created?.responseBody?.id;
    await this.mailService.sendCampaign({ campaignId });
    const postSendSummary = await this.applyCampaignPostSendActions();
    this.campaignSendComplete = true;
    this.sendInProgress = false;
    await this.recordSentToHistory();
    this.notify.hide();
    this.notify.success({
      title: "Campaign sent",
      message: (overflowNotice ? `Campaign submitted to Brevo. ${overflowNotice.title} ${overflowNotice.message}` : `successfully to ${this.recipientCountSummary(false)}`) + postSendSummary
    });
  }

  private async applyCampaignPostSendActions(): Promise<string> {
    const postSendActions = this.state.notificationConfig?.postSendActions ?? [];
    if (postSendActions.length === 0 || this.state.selectedListId === null) {
      return "";
    }
    const listMemberIds = this.members
      .filter(this.memberService.filterFor.GROUP_MEMBERS)
      .filter(member => this.mailListUpdaterService.memberSubscribed(member, this.state.selectedListId!))
      .map(member => member.id)
      .filter((id): id is string => !!id);
    this.logger.info("applyCampaignPostSendActions: resolved", listMemberIds.length, "list members subscribed to list", this.state.selectedListId, "for post-send actions", postSendActions);
    if (listMemberIds.length === 0) {
      this.notify.warning({title: "Post-send actions", message: `The campaign was sent, but no members were found subscribed to the list for the configured post-send action - nothing was deleted or disabled.`});
      return "";
    }
    try {
      const result = await this.memberService.applyPostSendActions(listMemberIds, postSendActions);
      const parts: string[] = [];
      if (result.deleted) {
        parts.push(`${this.stringUtils.pluraliseWithCount(result.deleted, "member")} removed`);
      }
      if (result.disabled) {
        parts.push(`${this.stringUtils.pluraliseWithCount(result.disabled, "member")} disabled`);
      }
      return parts.length ? ` ${parts.join(" and ")} after the send.` : "";
    } catch (error) {
      this.logger.error("applyCampaignPostSendActions failed:", error);
      this.notify.warning({ title: "Post-send actions", message: `The campaign was sent, but applying post-send actions failed: ${this.errorMessage(error)}` });
      return "";
    }
  }

  private async recordSentToHistory(recipientCount?: number): Promise<void> {
    try {
      const saved = await this.compositionsService.save(this.state, this.currentDraftId, this.composeShared);
      this.currentDraftId = saved.id;
      this.lastSavedAt = saved.savedAt;
      await this.compositionsService.markSent(saved.id, recipientCount);
    } catch (error) {
      this.logger.error("recordSentToHistory failed:", error);
    }
    if (this.state.brandingMode === BrandingMode.UNBRANDED && this.state.externalRecipients?.length) {
      void this.loadSavedExternalRecipients();
    }
  }

  private async startBatchTransactionalSend(): Promise<void> {
    await this.resolveCommitteeFileLinksForSend();
    const { top, bottom, combined } = this.composedBodyParts();
    const isUnbranded = this.state.brandingMode === BrandingMode.UNBRANDED;
    const request: BatchTransactionalSendRequest = {
      notificationConfigId: isUnbranded ? undefined : this.state.notificationConfig!.id!,
      bannerId: isUnbranded ? null : this.state.bannerId,
      subject: this.state.subject,
      addresseeType: AddresseeType.NONE,
      signoffRoles: isUnbranded ? [] : this.state.signoffRoles,
      htmlBody: combined,
      htmlBodyTop: top,
      htmlBodyBottom: bottom,
      memberIds: this.state.selectedMemberIds,
      narrowListId: this.state.narrowListId,
      externalRecipients: isUnbranded ? this.state.externalRecipients : undefined,
      ccRecipients: this.state.ccRecipients?.length ? this.state.ccRecipients : undefined,
      bccRecipients: this.state.bccRecipients?.length ? this.state.bccRecipients : undefined,
      senderRoleOverride: isUnbranded ? undefined : this.state.notificationConfig!.senderRole,
      replyToRoleOverride: isUnbranded ? undefined : this.state.notificationConfig!.replyToRole,
      bccRolesOverride: isUnbranded ? [] : (this.state.notificationConfig!.bccRoles ?? this.state.notificationConfig!.ccRoles ?? []),
      brandingMode: this.state.brandingMode,
      unbrandedSenderRoleType: isUnbranded ? this.resolvedUnbrandedRole()?.type : undefined,
      inboxReplyContext: this.inboxReplyContext ?? undefined
    };
    const start = await this.sendService.startBatch(request);
    this.batchSendJobId = start.jobId;
    this.batchProgress = {
      jobId: start.jobId,
      status: BatchSendStatus.RUNNING,
      totalRecipients: start.totalRecipients,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      startedAt: 0,
      entries: []
    };
    this.pollBatchStatus(start.jobId);
  }

  private pollBatchStatus(jobId: string): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = timer(0, 1500)
      .pipe(switchMap(() => this.sendService.batchStatus(jobId)))
      .subscribe({
        next: progress => {
          this.batchProgress = progress;
          if (this.batchSendComplete()) {
            this.sendInProgress = false;
            this.pollSubscription?.unsubscribe();
            this.pollSubscription = null;
            this.notify.hide();
            void this.recordSentToHistory(this.batchProgress?.totalRecipients);
          }
        },
        error: error => {
          this.logger.error("batch poll failed", error);
          this.sendInProgress = false;
        }
      });
  }

  batchProgressPercent(): number {
    if (!this.batchProgress || this.batchProgress.totalRecipients === 0) return 0;
    const processed = this.batchProgress.sentCount + this.batchProgress.failedCount + (this.batchProgress.skippedCount ?? 0);
    return Math.round(processed * 100 / this.batchProgress.totalRecipients);
  }

  batchProgressBarClass(): string {
    if (this.batchProgress?.status === BatchSendStatus.FAILED) return "bg-danger";
    if (this.batchProgress?.status === BatchSendStatus.COMPLETED_WITH_ERRORS) return "bg-warning";
    return "bg-success";
  }

  batchSendComplete(): boolean {
    if (!this.batchProgress) return false;
    return [BatchSendStatus.COMPLETED, BatchSendStatus.COMPLETED_WITH_ERRORS, BatchSendStatus.FAILED, BatchSendStatus.CANCELLED].includes(this.batchProgress.status);
  }

  sendComplete(): boolean {
    return this.campaignSendComplete || this.batchSendComplete();
  }

  closeAfterSend(): void {
    this.leaveComposer();
  }

  private errorMessage(error: any): string {
    if (isString(error)) return error;
    if (error?.message) return error.message;
    return "An unknown error occurred";
  }
}
