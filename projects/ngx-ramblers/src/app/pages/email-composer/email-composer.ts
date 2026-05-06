import { Component, ElementRef, inject, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from "@angular/core";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { Location, NgClass, NgTemplateOutlet } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Subscription, timer } from "rxjs";
import { switchMap } from "rxjs/operators";
import { isArray, isNumber, isString, kebabCase, values } from "es-toolkit/compat";
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
import { Member, MemberBulkLoadAudit } from "../../models/member.model";
import { MemberBulkLoadAuditService } from "../../services/member/member-bulk-load-audit.service";
import {
  ADDRESSEE_OPTIONS,
  AddresseeType,
  ArticleBlock,
  ArticleBlockPosition,
  BatchSendProgress,
  BatchSendStatus,
  BatchTransactionalSendRequest,
  buildDefaultFragmentOrder,
  ComposerFragment,
  ComposerFragmentKind,
  DEFAULT_COLUMN_GAP_PX,
  defaultEmailComposerState,
  dividerHtml,
  EMAIL_COMPOSER_STEPS,
  EmailComposerState,
  EmailComposerStepKey,
  EventInclusionMode,
  EXPANDABLE_FRAGMENT_KINDS,
  findRecycledTrackingUrls,
  newDividerFragment,
  newMultiColumnFragment,
  EmailComposerContextSource,
  RecipientMode,
  SECTION_DIVIDER_OPTIONS,
  SectionDividerStyle,
  SendingChannel,
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
  TemplateRenderRequest
} from "../../models/mail.model";
import { MailMessagingService } from "../../services/mail/mail-messaging.service";
import { MailService } from "../../services/mail/mail.service";
import { MailListUpdaterService } from "../../services/mail/mail-list-updater.service";
import { MemberService } from "../../services/member/member.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { UrlService } from "../../services/url.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { TiptapMarkdownEditor } from "../../modules/common/tiptap-editor/tiptap-markdown-editor";
import { MemberMultiSelect } from "../../modules/common/member-multi-select/member-multi-select";
import { ArticleBlockSingleEditor } from "../../modules/common/article-blocks/article-block-single-editor";
import { SectionDividerSelectComponent } from "../../modules/common/section-divider-select/section-divider-select";
import { EmailComposerRenderingService } from "../../services/email-composer/email-composer-rendering.service";
import { EmailComposerSendService } from "../../services/email-composer/email-composer-send.service";
import { EmailComposition, EmailCompositionsService } from "../../services/email-composer/email-compositions.service";
import { NotificationConfigSelectorComponent } from "../admin/system-settings/mail/notification-config-selector";
import { SenderRepliesAndSignoff } from "../admin/send-emails/sender-replies-and-signoff";
import { EmailPreviewComponent } from "../../modules/common/email-preview/email-preview.component";
import { NotificationDirective } from "../../notifications/common/notification.directive";
import { SystemConfig } from "../../models/system.model";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { CommitteeQueryService } from "../../services/committee/committee-query.service";
import { WalksAndEventsService } from "../../services/walks-and-events/walks-and-events.service";
import { GoogleMapsService } from "../../services/google-maps.service";
import { CommitteeFile, GroupEventSummary, Notification, NotificationItem } from "../../models/committee.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { MediaQueryService } from "../../services/committee/media-query.service";
import { CommitteeDisplayService } from "../committee/committee-display.service";
import { PageService } from "../../services/page.service";
import { PageContentService } from "../../services/page-content.service";
import { PageContent } from "../../models/content-text.model";
import { SiteLinkInputComponent } from "../../modules/common/site-link-input/site-link-input";
import { CommitteeFileMultiSelectComponent } from "../../modules/common/committee-file-multi-select/committee-file-multi-select";
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
import { Confirm, ConfirmType, StoredValue } from "../../models/ui-actions";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgSelectModule } from "@ng-select/ng-select";
import {
  AdvancedSearchPreset,
  createAllTimePreset,
  createFuturePreset,
  createPastPreset
} from "../../models/search.model";
import { DateTime } from "luxon";

@Component({
  selector: "app-email-composer",
  styleUrls: ["./email-composer.sass"],
  imports: [
    PageComponent,
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
    NgSelectModule,
    SiteLinkInputComponent,
    CommitteeFileMultiSelectComponent,
    TiptapMarkdownEditor,
    SectionDividerSelectComponent,
    MemberMultiSelect,
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
    DisplayDatePipe
  ],
  template: `
    <app-page autoTitle pageTitle="Email Composer">
      <div class="row mb-3">
        <div class="col-sm-12">
          <p-stepper [value]="$any(stepperActiveTab)" (valueChange)="onStepperValueChange($event)" [linear]="false">
            <p-step-list>
              @for (step of stepperSteps; let idx = $index; track step.key) {
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
      @if (notifyTarget.showAlert) {
        <div class="row">
          <div class="col-sm-12">
            <div class="alert {{notifyTarget.alertClass}}">
              <fa-icon [icon]="notifyTarget.alert.icon"/>
              @if (notifyTarget.alertTitle) {
                <strong>{{ notifyTarget.alertTitle }}: </strong>
              }
              {{ notifyTarget.alertMessage }}
            </div>
          </div>
        </div>
      }
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
                  <div>
                    <button type="button" class="btn btn-primary btn-sm me-2" (click)="loadDraft(draft.id)">Load</button>
                    @if (pendingDraftDeleteId === draft.id) {
                      <button type="button" class="btn btn-danger btn-sm me-2" (click)="confirmDeleteDraft(draft.id)">Confirm delete</button>
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
                      <span class="text-muted small ms-2">to {{ sent.sentRecipientCount }} recipient{{ sent.sentRecipientCount === 1 ? "" : "s" }}</span>
                    }
                  </div>
                  <div>
                    <button type="button" class="btn btn-primary btn-sm me-2" (click)="useAsTemplate(sent.id)">Use as template</button>
                    @if (pendingDraftDeleteId === sent.id) {
                      <button type="button" class="btn btn-danger btn-sm me-2" (click)="confirmDeleteDraft(sent.id)">Confirm delete</button>
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
      <div class="email-composer-action-bar">
        @if (!sendComplete()) {
          <div class="email-composer-toolbar">
            <button type="button" class="btn btn-primary"
                    (click)="saveDraft()"
                    [disabled]="!hasContentToDraft()">
              <fa-icon [icon]="faFloppyDisk" class="me-1"/>Save as draft
            </button>
            @if (currentDraftId) {
              <button type="button" class="btn btn-primary"
                      (click)="revertToSavedDraft()"
                      title="Discard unsaved changes and reload the last saved version of this draft">
                <fa-icon [icon]="faArrowRotateLeft" class="me-1"/>Revert to saved draft
              </button>
            }
            <button type="button" class="btn btn-primary" (click)="toggleDraftsPanel()">
              <fa-icon [icon]="faFolderOpen" class="me-1"/>{{ draftsPanelOpen ? "Hide drafts" : "Show drafts" }} ({{ drafts.length }})
            </button>
            <button type="button" class="btn btn-primary" (click)="toggleSentEmailsPanel()">
              <fa-icon [icon]="faPaperPlane" class="me-1"/>{{ sentEmailsPanelOpen ? "Hide sent" : "Show sent" }} ({{ sentEmails.length }})
            </button>
            <button type="button" class="btn btn-primary" (click)="newComposition()" [disabled]="!hasContentToDraft()">
              <fa-icon [icon]="faFile" class="me-1"/>New
            </button>
          </div>
        }
        <div class="stepper-nav">
          @switch (stepperActiveTab) {
            @case (EmailComposerStepKey.TEMPLATE) {
              <button type="button" class="btn btn-primary" (click)="cancel()"><fa-icon [icon]="faXmark"/> Cancel</button>
              <button type="button" class="btn btn-primary" (click)="goToStep(1)" [disabled]="!templateStepValid()" [title]="templateStepValidationMessage()">
                Next <fa-icon [icon]="faArrowRight"/>
              </button>
            }
            @case (EmailComposerStepKey.RECIPIENTS) {
              <button type="button" class="btn btn-primary" (click)="goToStep(0)"><fa-icon [icon]="faArrowLeft"/> Back</button>
              <button type="button" class="btn btn-primary" (click)="goToStep(2)" [disabled]="!recipientsStepValid()" [title]="recipientsStepValidationMessage()">
                Next <fa-icon [icon]="faArrowRight"/>
              </button>
            }
            @case (EmailComposerStepKey.COMPOSE) {
              <button type="button" class="btn btn-primary" (click)="goToStep(1)"><fa-icon [icon]="faArrowLeft"/> Back</button>
              <button type="button" class="btn btn-primary" (click)="goToStep(3)" [disabled]="!composeStepValid()" [title]="composeStepValidationMessage()">
                Next <fa-icon [icon]="faArrowRight"/>
              </button>
            }
            @case (EmailComposerStepKey.EVENTS) {
              <button type="button" class="btn btn-primary" (click)="goToStep(2)"><fa-icon [icon]="faArrowLeft"/> Back</button>
              <button type="button" class="btn btn-primary" (click)="goToStep(4)">Next <fa-icon [icon]="faArrowRight"/></button>
            }
            @case (EmailComposerStepKey.REVIEW) {
              <button type="button" class="btn btn-primary" (click)="goToStep(3)"><fa-icon [icon]="faArrowLeft"/> Back</button>
              <button type="button" class="btn btn-primary" (click)="goToStep(5)">Next <fa-icon [icon]="faArrowRight"/></button>
            }
            @case (EmailComposerStepKey.SEND) {
              @if (sendComplete()) {
                <button type="button" class="btn btn-primary" (click)="newComposition()"><fa-icon [icon]="faFile"/> Start a new email</button>
                <button type="button" class="btn btn-primary" (click)="closeAfterSend()"><fa-icon [icon]="faXmark"/> Close</button>
              } @else {
                <button type="button" class="btn btn-primary" (click)="goToStep(4)" [disabled]="sendInProgress"><fa-icon [icon]="faArrowLeft"/> Back</button>
                @if (sendConfirm.notificationsOutstanding()) {
                  <button type="button" class="btn btn-sunset"
                          (click)="confirmAndSend()"
                          [disabled]="sendInProgress">
                    <fa-icon [icon]="faPaperPlane"/> Confirm send
                  </button>
                  <button type="button" class="btn btn-primary"
                          (click)="cancelSendConfirm()"
                          [disabled]="sendInProgress">
                    <fa-icon [icon]="faXmark"/> Cancel
                  </button>
                } @else {
                  <button type="button" class="btn btn-primary"
                          (click)="confirmAndSend()"
                          [disabled]="sendInProgress || sendDisabled() || hasSendBlockers()"
                          [title]="sendDisabledReason()">
                    <fa-icon [icon]="faPaperPlane"/> Send {{ sendingChannelLabel() }}
                  </button>
                }
              }
            }
          }
        </div>
      </div>
      @if (currentComposition && !sendComplete()) {
        <div class="text-muted small mb-2">{{ lastSavedDescription() }}</div>
      }
      @if (!sendComplete()) {
        <div class="form-check mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <input class="form-check-input" type="checkbox" id="composition-shared"
                   [checked]="composeShared"
                   (change)="onSharedToggled($any($event.target).checked)">
            <label class="form-check-label ms-2" for="composition-shared">Let other committee members load, edit and send this email</label>
          </div>
          <a href="javascript:void(0)" class="small" (click)="copyComposerStateAsJson()">Copy state as JSON</a>
        </div>
      }
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
                              <a [href]="committeeDisplayService.fileUrl(file)"
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
    </app-page>

    <ng-template #recipientsStep>
      <div class="email-composer-section">
        <h3>Who is this email going to?</h3>
        @if (recipientsStepErrors().length > 0) {
          <div class="email-composer-validation-summary">
            <h5>Before you can continue:</h5>
            <ul class="list-arrow">
              @for (error of recipientsStepErrors(); track error) { <li>{{ error }}</li> }
            </ul>
          </div>
        }
        <div class="row mb-3">
          <div class="col-sm-12">
            <div class="form-check">
              <input id="mode-list" type="radio" class="form-check-input" name="recipient-mode"
                     [checked]="state.recipientMode === RecipientMode.ENTIRE_LIST"
                     (change)="setRecipientMode(RecipientMode.ENTIRE_LIST)">
              <label class="form-check-label" for="mode-list">
                <strong>Everyone on a mailing list</strong> - one email sent to the whole list
              </label>
            </div>
            <div class="form-check">
              <input id="mode-selected" type="radio" class="form-check-input" name="recipient-mode"
                     [checked]="state.recipientMode === RecipientMode.SELECTED_MEMBERS"
                     (change)="setRecipientMode(RecipientMode.SELECTED_MEMBERS)">
              <label class="form-check-label" for="mode-selected">
                <strong>Specific members</strong> - send individually to chosen members
              </label>
            </div>
          </div>
        </div>
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
                    <span class="email-composer-list-count"
                          [tooltip]="listMembersTooltip(list)"
                          containerClass="email-composer-list-tooltip"
                          placement="right">{{ stringUtils.pluraliseWithCount(subscribedMemberCount(list), "member") }}</span>
                  </label>
                </div>
              }
              @if (nonEmptyLists().length === 0) {
                <div class="alert alert-warning">No mailing lists with members are configured. Set them up in Mail Settings first.</div>
              }
            </div>
          </div>
        } @else {
          <div class="row mb-3">
            <div class="col-sm-12">
              <label class="form-label">Choose members from:</label>
              <div class="form-check">
                <input class="form-check-input" type="radio" name="narrow-source"
                       id="narrow-source-all"
                       [checked]="!narrowFromListEnabled"
                       (change)="setNarrowFromList(false)">
                <label class="form-check-label" for="narrow-source-all">
                  <strong>All members</strong>
                </label>
              </div>
              <div class="form-check">
                <input class="form-check-input" type="radio" name="narrow-source"
                       id="narrow-source-list"
                       [checked]="narrowFromListEnabled"
                       (change)="setNarrowFromList(true)">
                <label class="form-check-label" for="narrow-source-list">
                  <strong>A specific mailing list</strong>
                </label>
              </div>
            </div>
          </div>
          @if (narrowFromListEnabled) {
            <div class="row mb-3">
              <div class="col-sm-6">
                <label for="narrow-list" class="form-label">Mailing list:</label>
                <select id="narrow-list" class="form-control"
                        [ngModel]="state.narrowListId"
                        (ngModelChange)="setNarrowListId($event)">
                  <option [ngValue]="null">- choose a list -</option>
                  @for (list of nonEmptyLists(); track list.id) {
                    <option [ngValue]="list.id">{{ list.name }} ({{ stringUtils.pluraliseWithCount(subscribedMemberCount(list), "member") }})</option>
                  }
                </select>
              </div>
            </div>
          }
          @if (!narrowFromListEnabled || state.narrowListId !== null) {
            <app-member-multi-select
              [members]="candidateMembers()"
              [selectedIds]="state.selectedMemberIds"
              [preFilterKey]="state.preFilterKey"
              [notificationConfig]="state.notificationConfig"
              [latestBulkLoadAudit]="latestBulkLoadAudit"
              [requireConsent]="requiresConsent()"
              (selectedIdsChange)="onSelectedMemberIdsChange($event)"
              (preFilterKeyChange)="onPreFilterKeyChange($event)"/>
            <div class="alert alert-success mt-2">
              {{ recipientCountSummary() }}
            </div>
          }
        }
      </div>
    </ng-template>

    <ng-template #templateStep>
      <div class="email-composer-section">
        <h3>Sender &amp; Template</h3>
        <p class="text-muted small mb-3">Pick the email type (which determines the visual template, banner and any built-in content), then choose who the email is from, who replies should go to, and which committee roles sign off.</p>
        @if (templateStepErrors().length > 0) {
          <div class="email-composer-validation-summary">
            <h5>Before you can continue:</h5>
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
        @if (state.notificationConfigListing) {
          <fieldset class="email-composer-fieldset">
            <legend>Email type &amp; visual template</legend>
            <app-notification-config-selector
              (emailConfigChanged)="onEmailConfigChanged($event)"
              [notificationConfig]="state.notificationConfig"
              [notificationConfigListing]="state.notificationConfigListing"/>
          </fieldset>
        }
        @if (state.notificationConfig) {
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
      </div>
    </ng-template>

    <ng-template #composeStep>
      <div class="email-composer-section">
        <h3>Compose your email</h3>
        @if (composeStepErrors().length > 0) {
          <div class="email-composer-validation-summary">
            <h5>Before you can continue:</h5>
            <ul class="list-arrow">
              @for (error of composeStepErrors(); track error) { <li>{{ error }}</li> }
            </ul>
          </div>
        }
        @let trackingUrls = recycledTrackingUrlsInState();
        @if (trackingUrls.length > 0) {
          <div class="alert alert-warning">
            <strong>Recycled tracking URLs detected.</strong>
            <p class="mb-2 mt-2">
              {{ trackingUrls.length }} link{{ trackingUrls.length === 1 ? "" : "s" }} in this email point at another sender's tracking redirect (typically pasted in from a forwarded marketing email). Brevo will wrap these again when we send, so recipients hit two redirect layers and may land on a stale 404. Edit the relevant section and replace each link with its original destination URL.
            </p>
            <ul class="mb-0 small">
              @for (url of trackingUrls; track url) { <li><code>{{ shortTrackingUrl(url) }}</code></li> }
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
            <button type="button" class="btn btn-sm btn-primary"
                    [disabled]="hasFragmentKindAtTopLevel(ComposerFragmentKind.INTRO)" (click)="addIntroFragment()">
              <fa-icon [icon]="faPlus"/> Add intro
            </button>
            <button type="button" class="btn btn-sm btn-primary" (click)="addArticleFragment([])">
              <fa-icon [icon]="faPlus"/> Add article block
            </button>
            <button type="button" class="btn btn-sm btn-primary"
                    [disabled]="hasFragmentKindAtTopLevel(ComposerFragmentKind.EVENTS)" (click)="addEventsFragment()">
              <fa-icon [icon]="faPlus"/> Add events
            </button>
            <button type="button" class="btn btn-sm btn-primary"
                    [disabled]="hasFragmentKindAtTopLevel(ComposerFragmentKind.SIGNOFF)" (click)="addSignoffFragment()">
              <fa-icon [icon]="faPlus"/> Add signoff
            </button>
            <button type="button" class="btn btn-sm btn-primary" (click)="onAddCommitteeFileFragmentClicked()">
              <fa-icon [icon]="faFile"/> Add committee file
            </button>
            <button type="button" class="btn btn-sm btn-primary" (click)="addDividerFragment([])">
              <fa-icon [icon]="faPlus"/> Add divider
            </button>
            <button type="button" class="btn btn-sm btn-primary" (click)="addMultiColumnFragment(2)">
              <fa-icon [icon]="faTableColumns"/> Add 2-column row
            </button>
            <button type="button" class="btn btn-sm btn-primary" (click)="addMultiColumnFragment(3)">
              <fa-icon [icon]="faTableColumns"/> Add 3-column row
            </button>
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
               [class.fragment-row-hover-before]="isDragHover(parentPath.concat([i])) && dragHoverPosition === 'before'"
               [class.fragment-row-hover-after]="isDragHover(parentPath.concat([i])) && dragHoverPosition === 'after'"
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
                    <app-tiptap-markdown-editor [value]="state.introMarkdown"
                                                (valueChange)="state.introMarkdown = $event"
                                                placeholder="Write your message here…"
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
                                <a class="ms-2" [href]="committeeDisplayService.fileUrl(file)" target="_blank">{{ file.fileNameData?.originalFileName || file.fileNameData?.awsFileName }}</a>
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
                      @if (templateContentFetching) {
                        <div class="text-muted small"><fa-icon [icon]="faSpinner" animation="spin"/> Loading template content…</div>
                      } @else if (templateContentError) {
                        <div class="text-danger small">{{ templateContentError }}</div>
                      } @else if (templateContentHtml) {
                        <div class="text-muted small mb-2">Read-only preview of the Brevo template body. Edit the template in Brevo to change this content.</div>
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
                   [checked]="dateInputMode === 'slider'"
                   (change)="setDateInputMode('slider')">
            <label class="form-check-label" for="date-input-slider">Slider</label>
          </div>
          <div class="form-check form-check-inline">
            <input class="form-check-input" type="radio" name="date-input-mode" id="date-input-pickers"
                   [checked]="dateInputMode === 'pickers'"
                   (change)="setDateInputMode('pickers')">
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
        @if (dateInputMode === 'slider') {
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
        <div class="col-sm-12 d-flex flex-nowrap align-items-center flex-wrap-md-wrap">
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
        <div class="col-sm-12 d-flex flex-nowrap align-items-center">
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
        <div class="d-flex flex-wrap align-items-center mb-3" style="gap: 0.5rem;">
          <button type="button" class="btn btn-primary" (click)="refreshPreview()">Refresh preview</button>
          <div class="btn-group" role="group" aria-label="Step through recipients">
            <button type="button" class="btn btn-primary"
                    [disabled]="!canStepPreview('first')"
                    (click)="stepPreview('first')" title="First recipient">
              <fa-icon [icon]="faAngleDoubleLeft"/>
            </button>
            <button type="button" class="btn btn-primary"
                    [disabled]="!canStepPreview('prev')"
                    (click)="stepPreview('prev')" title="Previous recipient">
              <fa-icon [icon]="faAngleLeft"/>
            </button>
            <button type="button" class="btn btn-primary"
                    [disabled]="!canStepPreview('next')"
                    (click)="stepPreview('next')" title="Next recipient">
              <fa-icon [icon]="faAngleRight"/>
            </button>
            <button type="button" class="btn btn-primary"
                    [disabled]="!canStepPreview('last')"
                    (click)="stepPreview('last')" title="Last recipient">
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
        @if (subjectStartsWithCopyOf()) {
          <div class="alert alert-warning">
            <strong>Subject still says "Copy of …"</strong>
            <p class="mb-2 mt-2">Update the subject line on the <a href="javascript:void(0)" (click)="goToCompose()">Compose step</a> before sending so recipients don't see "Copy of …".</p>
            <button type="button" class="btn btn-primary btn-sm" (click)="goToCompose()">
              <fa-icon [icon]="faArrowLeft"/> Go and fix
            </button>
          </div>
        }
        @let trackingUrls = recycledTrackingUrlsInState();
        @if (trackingUrls.length > 0) {
          <div class="alert alert-danger">
            <strong>Recycled tracking URLs detected</strong>
            <p class="mb-2 mt-2">
              {{ trackingUrls.length }} link{{ trackingUrls.length === 1 ? "" : "s" }} in this email point at another sender's tracking redirect. Brevo will wrap them again on send, so recipients hit two redirect layers and may land on a stale 404. Edit the relevant section and replace each link with its original destination URL.
            </p>
            <button type="button" class="btn btn-primary btn-sm" (click)="goToCompose()">
              <fa-icon [icon]="faArrowLeft"/> Go and fix
            </button>
          </div>
        }
        @if (sendInProgress) {
          <div class="alert alert-warning">
            <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
            Sending in progress…
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
                @if (batchSendComplete()) {
                  <span class="ms-2 text-success">
                    <fa-icon [icon]="faCheckCircle"/>
                    Done
                  </span>
                }
              </div>
              @if (batchProgress.entries?.length > 0 && (batchProgress.failedCount > 0 || batchSendComplete())) {
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
                          <td>{{ entry.email }}</td>
                          <td>{{ entry.status }}</td>
                          <td>{{ entry.errorMessage || "" }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </details>
              }
            </div>
          </div>
        }
        @if (campaignSendComplete) {
          <div class="alert alert-success">Campaign was sent successfully.</div>
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
  private memberService = inject(MemberService);
  private memberBulkLoadAuditService = inject(MemberBulkLoadAuditService);
  private memberLoginService = inject(MemberLoginService);
  private systemConfigService = inject(SystemConfigService);
  protected stringUtils = inject(StringUtilsService);
  protected dateUtils = inject(DateUtilsService);
  private rendering = inject(EmailComposerRenderingService);
  private sendService = inject(EmailComposerSendService);
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
  protected latestBulkLoadAudit: MemberBulkLoadAudit | null = null;
  protected senderExists = false;
  protected forcedConfigId: string | null = null;
  protected forcedConfigSlug: string | null = null;
  protected currentDraftId: string | null = null;
  protected currentComposition: EmailComposition | null = null;
  protected drafts: EmailComposition[] = [];
  protected sentEmails: EmailComposition[] = [];
  protected draftsPanelOpen = false;
  protected sentEmailsPanelOpen = false;
  protected composeShared = false;
  protected lastSavedAt: number | null = null;
  protected sendInProgress = false;
  protected campaignSendComplete = false;
  protected batchProgress: BatchSendProgress | null = null;
  protected batchSendJobId: string | null = null;
  protected notifyTarget: AlertTarget = {};
  private notify!: AlertInstance;
  private subscriptions: Subscription[] = [];
  private pollSubscription: Subscription | null = null;

  protected readonly EmailComposerStepKey = EmailComposerStepKey;
  protected readonly RecipientMode = RecipientMode;
  protected readonly EventInclusionMode = EventInclusionMode;
  protected readonly ComposerFragmentKind = ComposerFragmentKind;
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
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly faPlus = faPlus;
  protected readonly faTrash = faTrash;
  protected readonly faGripLines = faGripLines;

  async ngOnInit(): Promise<void> {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.route.queryParamMap.subscribe((paramMap: ParamMap) => {
      void this.applyContextFromRoute(paramMap, this.route.snapshot.paramMap);
      this.applyUrlStateToComposer(paramMap);
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
      this.applyDefaultListIfNeeded();
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.systemConfig = systemConfig;
    }));
    this.members = await this.memberService.publicFields(this.memberService.filterFor.GROUP_MEMBERS);
    try {
      this.latestBulkLoadAudit = await this.memberBulkLoadAuditService.findLatestBulkLoadAudit();
    } catch (error) {
      this.logger.warn("could not load latestBulkLoadAudit:", error);
      this.latestBulkLoadAudit = null;
    }
    await this.refreshDrafts();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.pollSubscription?.unsubscribe();
  }

  private async applyContextFromRoute(queryParams: ParamMap, pathParams: ParamMap): Promise<void> {
    const slug = queryParams.get(StoredValue.EMAIL_CONFIG_ID);
    this.forcedConfigSlug = slug;
    this.forcedConfigId = this.resolveConfigIdFromSlug(slug);
    const sourcePage = queryParams.get(StoredValue.EMAIL_SOURCE_PAGE);
    const committeeFile = queryParams.get(StoredValue.EMAIL_COMMITTEE_FILE);
    const eventQuery = queryParams.get(StoredValue.EMAIL_EVENT);
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
          this.resolveCommitteeFiles(this.allFragmentCommitteeFileIds());
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
      title: event?.groupEvent?.title || "Awaiting " + (event?.groupEvent?.item_type ?? "event") + " details",
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
    this.resolveCommitteeFiles(this.allFragmentCommitteeFileIds());
  }

  private resolveCommitteeFiles(ids: string[]): void {
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
    return fileType ? `Download ${fileType}` : "Download";
  }

  protected committeeFileDownloadFilename(file: CommitteeFile): string {
    return file.fileNameData?.originalFileName || file.fileNameData?.awsFileName || "";
  }

  protected onCommitteeFileIdsChanged(fragment: ComposerFragment, ids: string[]): void {
    fragment.committeeFileIds = isArray(ids) ? Array.from(new Set(ids)) : [];
    this.state.fragmentOrder = [...(this.state.fragmentOrder ?? [])];
    this.resolveCommitteeFiles(this.allFragmentCommitteeFileIds());
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
      const previouslySelected = new Map(this.state.groupEvents.map(item => [item.id, item.selected]));
      this.state.groupEvents = events.map(event => ({ ...event, selected: previouslySelected.get(event.id) ?? this.state.groupEventsFilter!.selectAll }));
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
    this.syncStateToUrl({ [StoredValue.EMAIL_EVENT_INCLUSION]: mode });
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

  protected dateInputMode: "slider" | "pickers" = "slider";
  protected eventSliderMinDate: DateTime = DateTime.now().startOf("day").minus({ months: 3 });
  protected eventSliderMaxDate: DateTime = DateTime.now().startOf("day").plus({ years: 2 });

  protected setDateInputMode(mode: "slider" | "pickers"): void {
    this.dateInputMode = mode;
    if (mode === "slider") {
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
    this.eventSliderMinDate = DateTime.fromMillis(fromMillis - padding).startOf("day");
    this.eventSliderMaxDate = DateTime.fromMillis(toMillis + padding).startOf("day");
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
      DateTime.now().startOf("day"),
      DateTime.now().plus({ years: 2 }).endOf("day")
    )
  ];

  protected customDateRangePreset: AdvancedSearchPreset = {
    label: "Custom",
    range: () => ({
      from: this.state.groupEventsFilter?.fromDate?.value ?? DateTime.now().startOf("day").toMillis(),
      to: this.state.groupEventsFilter?.toDate?.value ?? DateTime.now().startOf("day").toMillis()
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
      this.notify.success({ title: "Copied", message: "Composer state copied to clipboard as JSON." });
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
    event.selectedMediaIndex = nextIndex;
    const next = media[nextIndex];
    const mediumStyle = next?.styles?.find(style => style.style === "medium") ?? next?.styles?.[0];
    if (mediumStyle?.url) {
      event.image = mediumStyle.url;
    }
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
    if (this.state.eventInclusion === EventInclusionMode.NONE) return "";
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

  protected narrowFromListEnabled: boolean = false;

  setNarrowFromList(enabled: boolean): void {
    this.narrowFromListEnabled = enabled;
    if (!enabled) {
      this.state.narrowListId = null;
    }
    this.state.selectedMemberIds = [];
  }

  protected listNameAndCount(list: ListInfo): string {
    const subscribers = this.subscribedMemberCount(list);
    return `${list.name} (${this.stringUtils.pluraliseWithCount(subscribers, "member")})`;
  }

  protected subscribedMemberCount(list: ListInfo): number {
    return this.members
      .filter(this.memberService.filterFor.GROUP_MEMBERS)
      .filter(member => this.mailListUpdaterService.memberSubscribed(member, list.id))
      .length;
  }

  protected listMembersTooltip(list: ListInfo): string {
    const subscribers = this.members
      .filter(this.memberService.filterFor.GROUP_MEMBERS)
      .filter(member => this.mailListUpdaterService.memberSubscribed(member, list.id))
      .map(member => `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim())
      .filter(name => name.length > 0)
      .sort();
    if (subscribers.length === 0) {
      return "No members subscribed";
    }
    const previewLimit = 30;
    const preview = subscribers.slice(0, previewLimit).join(", ");
    return subscribers.length > previewLimit
      ? `${preview} and ${subscribers.length - previewLimit} more`
      : preview;
  }

  setNarrowListId(listId: number | null): void {
    this.state.narrowListId = listId;
    this.recomputeCandidateMembers();
    this.state.selectedMemberIds = this.state.selectedMemberIds.filter(id => this.cachedCandidateMembers.some(member => member.id === id));
    this.syncStateToUrl({ [StoredValue.LIST_ID]: listId?.toString() ?? null });
  }

  private cachedCandidateMembers: Member[] = [];
  private cachedNarrowListId: number | null | undefined = undefined;
  private cachedMembersRef: Member[] = [];

  private recomputeCandidateMembers(): void {
    if (this.state.narrowListId === null) {
      this.cachedCandidateMembers = this.members;
    } else {
      this.cachedCandidateMembers = this.members.filter(member => this.mailListUpdaterService.memberSubscribed(member, this.state.narrowListId!));
    }
    this.cachedNarrowListId = this.state.narrowListId;
    this.cachedMembersRef = this.members;
  }

  candidateMembers(): Member[] {
    if (this.cachedNarrowListId !== this.state.narrowListId || this.cachedMembersRef !== this.members) {
      this.recomputeCandidateMembers();
    }
    return this.cachedCandidateMembers;
  }

  setRecipientMode(mode: RecipientMode): void {
    this.state.recipientMode = mode;
    this.state.sendingChannel = mode === RecipientMode.ENTIRE_LIST ? SendingChannel.CAMPAIGN : SendingChannel.TRANSACTIONAL_BATCH;
    this.applyDefaultListIfNeeded();
    this.syncStateToUrl({ [StoredValue.EMAIL_TYPE]: kebabCase(mode) });
  }

  selectList(list: ListInfo): void {
    this.state.selectedListId = list.id;
    this.syncStateToUrl({ [StoredValue.LIST_ID]: list.id?.toString() });
  }

  private applyUrlStateToComposer(queryParams: ParamMap): void {
    const emailType = queryParams.get(StoredValue.EMAIL_TYPE);
    if (emailType === kebabCase(RecipientMode.ENTIRE_LIST) && this.state.recipientMode !== RecipientMode.ENTIRE_LIST) {
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
          this.narrowFromListEnabled = true;
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
    const preFilter = queryParams.get(StoredValue.EMAIL_PRE_FILTER);
    if (preFilter && values(MemberSelection).includes(preFilter as MemberSelection)) {
      this.state.preFilterKey = preFilter as MemberSelection;
    }
    const eventInclusion = queryParams.get(StoredValue.EMAIL_EVENT_INCLUSION);
    if (eventInclusion && values(EventInclusionMode).includes(eventInclusion as EventInclusionMode)) {
      this.state.eventInclusion = eventInclusion as EventInclusionMode;
      if (this.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE) {
        this.ensureGroupEventsFilter();
      }
    }
    const divider = queryParams.get(StoredValue.EMAIL_SECTION_DIVIDER);
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

  onEventsDividerChange(style: SectionDividerStyle): void {
    this.state.eventsDividerAfter = style;
  }

  onBetweenEventsDividerChange(style: SectionDividerStyle): void {
    this.state.betweenEventsDivider = style;
  }

  protected expandedFragmentIds: Set<string> = new Set();
  protected draggedFragmentPath: number[] | null = null;
  protected dragHoverPath: number[] | null = null;
  protected dragHoverPosition: "before" | "after" | null = null;
  protected dragHoverColumnPath: number[] | null = null;
  protected templateContentHtml: string | null = null;
  protected templateContentFetching = false;
  protected templateContentError: string | null = null;
  private lastTemplateContentTemplateId: number | null = null;

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
      const stripped = (input ?? "").replace(/\s+/g, " ").trim();
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
      this.dragHoverPosition = (event.clientY ?? midpoint) < midpoint ? "before" : "after";
    } else {
      this.dragHoverPosition = "before";
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
    const targetIndex = this.dragHoverPosition === "after"
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
    this.syncStateToUrl({ [StoredValue.EMAIL_PRE_FILTER]: key ?? null });
  }

  onEmailConfigChanged(config: NotificationConfig): void {
    const previousConfigSubject = this.state.notificationConfig?.subject?.text ?? "";
    const userTypedCustomSubject = !!this.state.subject?.trim() && this.state.subject !== previousConfigSubject;
    this.state.notificationConfig = config;
    this.state.bannerId = config?.bannerId ?? null;
    if (!userTypedCustomSubject) {
      this.state.subject = config?.subject?.text ?? "";
    }
    this.state.signoffRoles = this.validSignoffRolesFor(config?.signOffRoles ?? []);
    this.applyRecipientDefaultsFrom(config);
    this.syncStateToUrl({
      [StoredValue.EMAIL_CONFIG_ID]: this.configToSlug(config),
      [StoredValue.LIST_ID]: this.state.recipientMode === RecipientMode.ENTIRE_LIST ? this.state.selectedListId?.toString() ?? null : null,
      [StoredValue.EMAIL_PRE_FILTER]: this.state.recipientMode === RecipientMode.SELECTED_MEMBERS ? this.state.preFilterKey ?? null : null,
      [StoredValue.EMAIL_TYPE]: kebabCase(this.state.recipientMode)
    });
    this.refreshTemplateContent();
    this.ensureFragmentOrder();
    this.maybeAutoRefreshPreview();
  }

  private applyRecipientDefaultsFrom(config: NotificationConfig | null): void {
    if (!config) return;
    if (config.defaultMemberSelection === MemberSelection.MAILING_LIST) {
      this.state.recipientMode = RecipientMode.ENTIRE_LIST;
      this.state.preFilterKey = null;
      if (isNumber(config.defaultListId)) {
        this.state.selectedListId = config.defaultListId;
      }
      this.state.selectedMemberIds = [];
    } else {
      this.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
      this.state.preFilterKey = config.defaultMemberSelection ?? null;
      this.state.selectedMemberIds = [];
    }
  }

  protected async refreshTemplateContent(): Promise<void> {
    const templateId = this.state.notificationConfig?.templateId;
    if (!templateId) {
      this.templateContentHtml = null;
      this.templateContentError = null;
      this.lastTemplateContentTemplateId = null;
      this.removeTemplateContentFragment();
      return;
    }
    if (this.lastTemplateContentTemplateId === templateId && this.templateContentHtml) {
      this.applyTemplateContentFragmentPresence();
      return;
    }
    this.templateContentFetching = true;
    this.templateContentError = null;
    try {
      const response = await this.mailService.queryTemplateContent(templateId);
      this.templateContentHtml = response?.htmlContent ?? null;
      this.lastTemplateContentTemplateId = templateId;
      this.applyTemplateContentFragmentPresence();
    } catch (error) {
      this.logger.error("queryTemplateContent failed:", error);
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
    if (this.templateHasTopBottomPlaceholders()) {
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
    return this.state.recipientMode === RecipientMode.SELECTED_MEMBERS;
  }

  recipientCountSummary(): string {
    if (this.state.recipientMode === RecipientMode.ENTIRE_LIST) {
      const list = this.availableLists().find(item => item.id === this.state.selectedListId);
      if (!list) return "no list chosen";
      return `${this.listNameAndCount(list)} (campaign)`;
    }
    return this.stringUtils.pluraliseWithCount(this.state.selectedMemberIds.length, "member");
  }

  estimatedSendTime(): string {
    const count = this.state.selectedMemberIds.length;
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
      if (this.state.selectedListId === null) errors.push("Choose which mailing list to send to");
    } else {
      if (this.narrowFromListEnabled && this.state.narrowListId === null) errors.push("Choose which mailing list to pull members from");
      if (this.state.selectedMemberIds.length === 0) errors.push("Select at least one member");
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
    if (!this.state.notificationConfig) {
      errors.push("Choose an email type");
    } else {
      if (!this.state.notificationConfig.templateId) errors.push(this.errorWithMailSettingsLink("This email type has no template configured - choose another or set one up in ", "Mail Settings"));
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
      linkRouterLink: "/admin/mail-settings",
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

  eventsStepValid(): boolean {
    return this.eventsStepErrors().length === 0;
  }

  composeStepValid(): boolean {
    return this.composeStepErrors().length === 0;
  }

  composeStepValidationMessage(): string {
    return this.composeStepErrors().join("; ");
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

  protected shortTrackingUrl(url: string): string {
    return url.length > 60 ? `${url.slice(0, 57)}…` : url;
  }

  canAccessStep(stepKey: EmailComposerStepKey): boolean {
    if (stepKey === EmailComposerStepKey.TEMPLATE) return true;
    if (stepKey === EmailComposerStepKey.RECIPIENTS) return this.templateStepValid();
    if (stepKey === EmailComposerStepKey.COMPOSE) return this.templateStepValid() && this.recipientsStepValid();
    if (stepKey === EmailComposerStepKey.EVENTS) return this.templateStepValid() && this.recipientsStepValid() && this.composeStepValid();
    if (stepKey === EmailComposerStepKey.REVIEW) return this.templateStepValid() && this.recipientsStepValid() && this.composeStepValid();
    if (stepKey === EmailComposerStepKey.SEND) return this.templateStepValid() && this.recipientsStepValid() && this.composeStepValid();
    return false;
  }

  goToStep(index: number): void {
    if (this.sendInProgress) return;
    const step = this.stepperSteps[index];
    if (step && this.canAccessStep(step.key)) {
      this.stepperActiveTab = step.key;
      this.syncStateToUrl({ [StoredValue.TAB]: step.key });
      if (step.key === EmailComposerStepKey.REVIEW) {
        this.refreshPreview().catch(error => this.logger.error("preview refresh failed", error));
      }
    }
  }

  onStepperValueChange(value: unknown): void {
    const key = value as EmailComposerStepKey;
    if (!key) return;
    this.stepperActiveTab = key;
    this.syncStateToUrl({ [StoredValue.TAB]: key });
    if (key === EmailComposerStepKey.REVIEW) {
      this.refreshPreview().catch(error => this.logger.error("preview refresh failed", error));
    }
  }

  stepHint(key: EmailComposerStepKey): string {
    const fallback = EMAIL_COMPOSER_STEPS.find(step => step.key === key)?.hint ?? "";
    switch (key) {
      case EmailComposerStepKey.RECIPIENTS: {
        if (this.state.recipientMode === RecipientMode.ENTIRE_LIST) {
          const list = this.availableLists().find(item => item.id === this.state.selectedListId);
          return list ? this.listNameAndCount(list) : fallback;
        }
        const count = this.state.selectedMemberIds.length;
        return count > 0 ? `${this.stringUtils.pluraliseWithCount(count, "member")} chosen` : fallback;
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
    if (this.hasUnsavedChanges() && !this.cancelArmed) {
      this.cancelArmed = true;
      this.notify.warning({
        title: "Discard email content?",
        message: "You have unsent email content. Click Cancel again to discard and leave."
      });
      return;
    }
    this.location.back();
  }

  protected cancelArmed: boolean = false;
  protected sendConfirm = new Confirm();

  private hasUnsavedChanges(): boolean {
    return !!this.state.subject?.trim() || !!this.state.introMarkdown?.trim() || this.state.articleBlocks.length > 0;
  }

  protected hasContentToDraft(): boolean {
    return this.hasUnsavedChanges();
  }

  protected async refreshDrafts(): Promise<void> {
    try {
      const all = await this.compositionsService.list();
      this.drafts = all.filter(c => c.status === "draft");
      this.sentEmails = all.filter(c => c.status === "sent");
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

  protected sentDescription(composition: EmailComposition): string {
    if (!composition.sentAt) return "";
    const ownerName = this.compositionOwnerName(composition);
    const when = this.dateUtils.displayDateAndTime(composition.sentAt);
    return ownerName ? `Sent by ${ownerName} on ${when}` : `Sent ${when}`;
  }

  protected compositionOwnerName(composition: EmailComposition): string | null {
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
      const selectedGroupEventIds: string[] = restored.selectedGroupEventIds ?? [];
      delete restored.selectedGroupEventIds;
      restored.groupEvents = [];
      restored.notificationConfigListing = this.state.notificationConfigListing;
      this.state = restored as EmailComposerState;
      if (this.state.subject) this.state.subject = `Copy of ${this.state.subject}`;
      this.currentDraftId = null;
      this.lastSavedAt = null;
      this.currentComposition = null;
      this.composeShared = false;
      this.sentEmailsPanelOpen = false;
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
      const selectedGroupEventIds: string[] = restored.selectedGroupEventIds ?? [];
      delete restored.selectedGroupEventIds;
      restored.groupEvents = [];
      restored.notificationConfigListing = this.state.notificationConfigListing;
      this.state = restored as EmailComposerState;
      this.currentDraftId = draft.id;
      this.lastSavedAt = draft.savedAt;
      this.currentComposition = draft;
      this.composeShared = draft.shared;
      this.draftsPanelOpen = false;
      await this.rehydrateAfterLoad(selectedGroupEventIds);
      this.notify.success({ title: "Draft loaded", message: draft.title });
    } catch (error) {
      this.logger.error("loadDraft failed:", error);
      this.notify.error({ title: "Load draft failed", message: String(error) });
    }
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
    if (this.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE && this.state.groupEventsFilter) {
      await this.populateGroupEvents();
      const selectedSet = new Set(selectedGroupEventIds);
      this.state.groupEvents = this.state.groupEvents.map(event => ({
        ...event,
        selected: event.id ? selectedSet.has(event.id) : false
      } as any));
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
      this.resolveCommitteeFiles(allIds);
    }
  }

  protected async deleteDraft(id: string): Promise<void> {
    try {
      await this.compositionsService.remove(id);
      if (this.currentDraftId === id) {
        this.currentDraftId = null;
        this.lastSavedAt = null;
      }
      await this.refreshDrafts();
    } catch (error) {
      this.logger.error("deleteDraft failed:", error);
    }
  }

  protected newComposition(): void {
    this.state = defaultEmailComposerState();
    if (this.mailMessagingConfig) {
      this.state.notificationConfigListing = {
        mailMessagingConfig: this.mailMessagingConfig,
        includeWorkflowRelatedConfigs: false,
        forceIncludeConfigIds: this.forcedConfigId ? [this.forcedConfigId] : []
      };
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

  protected draftSavedDescription(draft: EmailComposition): string {
    const ownerName = this.compositionOwnerName(draft);
    const when = this.dateUtils.displayDateAndTime(draft.savedAt);
    const verb = draft.status === "sent" ? "Sent" : "Created";
    return ownerName ? `${verb} by ${ownerName} on ${when}` : `${verb} on ${when}`;
  }

  private autoPreviewAttempts = 0;
  private maybeAutoRefreshPreview(): void {
    if (!this.autoPreviewPending) return;
    if (this.stepperActiveTab !== EmailComposerStepKey.REVIEW) return;
    if (!this.state.notificationConfig?.templateId) return;
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
    if (this.state.recipientMode === RecipientMode.ENTIRE_LIST && this.state.selectedListId !== null) {
      return this.members
        .filter(this.memberService.filterFor.GROUP_MEMBERS)
        .filter(member => this.mailListUpdaterService.memberSubscribed(member, this.state.selectedListId!));
    }
    const candidates = this.candidateMembers();
    const ids = this.state.selectedMemberIds ?? [];
    if (ids.length > 0) {
      const idSet = new Set(ids);
      return candidates.filter(member => idSet.has(member.id ?? ""));
    }
    return candidates;
  }

  protected previewRecipientCount(): number {
    return this.previewRecipients().length;
  }

  protected previewRecipientLabel(): string {
    const count = this.previewRecipientCount();
    if (count === 0) return "No recipients";
    const current = Math.min(this.previewRecipientIndex + 1, count);
    const member = this.previewRecipients()[this.previewRecipientIndex] ?? null;
    const name = member ? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() : "";
    return name ? `${current} of ${count} - ${name}` : `${current} of ${count}`;
  }

  protected canStepPreview(direction: "first" | "prev" | "next" | "last"): boolean {
    const count = this.previewRecipientCount();
    if (count <= 1) return false;
    if (direction === "first" || direction === "prev") return this.previewRecipientIndex > 0;
    return this.previewRecipientIndex < count - 1;
  }

  protected stepPreview(direction: "first" | "prev" | "next" | "last"): void {
    const count = this.previewRecipientCount();
    if (count === 0) return;
    if (direction === "first") this.previewRecipientIndex = 0;
    else if (direction === "last") this.previewRecipientIndex = count - 1;
    else if (direction === "prev") this.previewRecipientIndex = Math.max(0, this.previewRecipientIndex - 1);
    else this.previewRecipientIndex = Math.min(count - 1, this.previewRecipientIndex + 1);
    this.refreshPreview().catch(error => this.logger.error("preview step failed", error));
  }

  async refreshPreview(): Promise<void> {
    if (!this.state.notificationConfig?.templateId) {
      this.emailPreview?.showError("Choose a template to render the preview.");
      return;
    }
    const { top, bottom, combined } = this.composedBodyParts();
    const recipients = this.previewRecipients();
    if (recipients.length > 0 && this.previewRecipientIndex >= recipients.length) {
      this.previewRecipientIndex = recipients.length - 1;
    }
    const previewMember = recipients[this.previewRecipientIndex] ?? null;
    const member = previewMember
      ? await this.memberService.getById(previewMember.id ?? this.memberLoginService.loggedInMember().memberId)
      : await this.memberService.getById(this.memberLoginService.loggedInMember().memberId);
    const params = this.mailMessagingService.createSendSmtpEmailParams(
      member,
      this.state.notificationConfig,
      combined,
      this.state.subject,
      "",
      top,
      bottom
    );
    params.messageMergeFields.subject = this.applySubjectAffixes(this.state.subject, params);
    const request: TemplateRenderRequest = {
      templateId: this.state.notificationConfig.templateId,
      templateOverrides: this.state.notificationConfig.templateOverrides,
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
    if (!this.state.fragmentOrder || this.state.fragmentOrder.length === 0) {
      this.state.fragmentOrder = buildDefaultFragmentOrder(this.state, { includeTemplateContent: true });
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
    if (!this.recipientsStepValid()) return this.recipientsStepValidationMessage();
    if (!this.templateStepValid()) return this.templateStepValidationMessage();
    if (!this.composeStepValid()) return this.composeStepValidationMessage();
    return "";
  }

  protected subjectStartsWithCopyOf(): boolean {
    return !!this.state.subject?.trim().toLowerCase().startsWith("copy of ");
  }

  protected hasSendBlockers(): boolean {
    return this.subjectStartsWithCopyOf() || this.recycledTrackingUrlsInState().length > 0;
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
      if (this.state.recipientMode === RecipientMode.ENTIRE_LIST) {
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
    const member = await this.memberService.getById(this.memberLoginService.loggedInMember().memberId);
    const { top, bottom, combined } = this.composedBodyParts();
    const params = this.mailMessagingService.createSendSmtpEmailParams(
      member,
      this.state.notificationConfig!,
      combined,
      this.state.subject,
      "",
      top,
      bottom
    );
    const request: CreateCampaignRequest = {
      createAsDraft: false,
      templateId: this.state.notificationConfig!.templateId,
      htmlContent: combined,
      inlineImageActivation: false,
      mirrorActive: false,
      name: this.state.subject,
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
    this.campaignSendComplete = true;
    this.sendInProgress = false;
    await this.recordSentToHistory();
    this.notify.hide();
    this.notify.success({ title: "Sent", message: `Campaign sent to ${this.recipientCountSummary()}` });
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
  }

  private async startBatchTransactionalSend(): Promise<void> {
    const { top, bottom, combined } = this.composedBodyParts();
    const request: BatchTransactionalSendRequest = {
      notificationConfigId: this.state.notificationConfig!.id!,
      bannerId: this.state.bannerId,
      subject: this.state.subject,
      addresseeType: AddresseeType.NONE,
      signoffRoles: this.state.signoffRoles,
      htmlBody: combined,
      htmlBodyTop: top,
      htmlBodyBottom: bottom,
      memberIds: this.state.selectedMemberIds,
      senderRoleOverride: this.state.notificationConfig!.senderRole,
      replyToRoleOverride: this.state.notificationConfig!.replyToRole,
      bccRolesOverride: this.state.notificationConfig!.bccRoles ?? this.state.notificationConfig!.ccRoles ?? []
    };
    const start = await this.sendService.startBatch(request);
    this.batchSendJobId = start.jobId;
    this.batchProgress = {
      jobId: start.jobId,
      status: BatchSendStatus.RUNNING,
      totalRecipients: start.totalRecipients,
      sentCount: 0,
      failedCount: 0,
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
    return Math.round((this.batchProgress.sentCount + this.batchProgress.failedCount) * 100 / this.batchProgress.totalRecipients);
  }

  batchProgressBarClass(): string {
    if (!this.batchProgress) return "";
    if (this.batchProgress.status === BatchSendStatus.FAILED) return "bg-danger";
    if (this.batchProgress.status === BatchSendStatus.COMPLETED_WITH_ERRORS) return "bg-warning";
    if (this.batchProgress.status === BatchSendStatus.COMPLETED) return "bg-success";
    return "";
  }

  batchSendComplete(): boolean {
    if (!this.batchProgress) return false;
    return [BatchSendStatus.COMPLETED, BatchSendStatus.COMPLETED_WITH_ERRORS, BatchSendStatus.FAILED, BatchSendStatus.CANCELLED].includes(this.batchProgress.status);
  }

  sendComplete(): boolean {
    return this.campaignSendComplete || this.batchSendComplete();
  }

  closeAfterSend(): void {
    this.location.back();
  }

  private errorMessage(error: any): string {
    if (isString(error)) return error;
    if (error?.message) return error.message;
    return "An unknown error occurred";
  }
}
