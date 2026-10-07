import {parseEmailHeadersFromMarkdown, emailHeadersNearTop, buildForwardedIntroMarkdown} from "../../functions/email-composer-intro-paste";
import { EmailComposerSenderService } from "../../services/email-composer/email-composer-sender.service";
import {EmailComposerDraftingComponent} from "./email-composer-drafting.component";
import {EmailComposerDraftingMode} from "../../models/email-composer.model";
import { EmailComposerDraftingService } from "../../services/email-composer/email-composer-drafting.service";
import { EmailComposerEventSelectionService } from "../../services/email-composer/email-composer-event-selection.service";
import {EmailComposerDocumentComponent} from "./email-composer-document.component";
import { EmailComposerDocumentsService } from "../../services/email-composer/email-composer-documents.service";
import { FocusInputDirective } from "../../modules/common/focus-input/focus-input.directive";
import { AlertMessageComponent } from "../../modules/common/alert-panel/alert-message";
import { EmailComposerRecipientsComponent } from "./email-composer-recipients.component";
import { EmailComposerSessionService } from "../../services/email-composer/email-composer-session.service";
import { EmailComposerRecipientsService } from "../../services/email-composer/email-composer-recipients.service";
import {
  EmailComposerRecipientResolutionService
} from "../../services/email-composer/email-composer-recipient-resolution.service";
import {
  EmailComposerRecipientSourcesService
} from "../../services/email-composer/email-composer-recipient-sources.service";
import {
  EmailComposerUpdateSettingsService
} from "../../services/email-composer/email-composer-update-settings.service";
import {
  ADDRESSEE_OPTIONS,
  AddresseeType,
  ArticleBlock,
  BatchSendEntryStatus,
  BatchSendProgress,
  BatchSendStatus,
  BatchTransactionalSendRequest,
  BRANDING_MODE_OPTIONS,
  BrandingMode,
  CommitteeFileEmailInclude,
  ComposerExternalRecipient,
  ComposerFragment,
  ComposerFragmentKind,
  DEFAULT_COLUMN_GAP_PX,
  DragHoverPosition,
  EMAIL_COMPOSER_STEPS,
  EmailComposerContextSource,
  EmailComposerState,
  EmailComposerStepKey,
  EmailComposition,
  EmailCompositionKind,
  EmailCompositionStatus,
  EmailCompositionSummary,
  EventInclusionMode,
  MERGE_FIELD_CATALOGUE,
  MergeFieldGroup,
  NewsletterWindow,
  PreviewStepDirection,
  PriorSendExclusion,
  PROMOTIONAL_LANGUAGE_PATTERN,
  RecipientAddressMode,
  RecipientField,
  RecipientMode,
  REPLY_OR_FORWARD_SUBJECT_PATTERN,
  SectionDividerStyle,
  SendingChannel,
  UNBRANDED_HARD_CAP_RECIPIENTS,
  UNBRANDED_LONG_BODY_CHAR_THRESHOLD,
  ValidationError,
  ValidationErrorWithLink,
  VOLUNTEER_MERGE_FIELD_CATALOGUE
} from "../../models/email-composer.model";
import { EmailComposerAttachmentsComponent } from "./email-composer-attachments.component";
import {
  EmailCompositionListComponent
} from "../../modules/common/email-compositions/email-composition-list.component";
import { EmailComposerFragmentsComponent } from "./email-composer-fragments.component";
import { EmailComposerFragmentsService } from "../../services/email-composer/email-composer-fragments.service";
import { EmailComposerEventsComponent } from "./email-composer-events.component";
import { applyMediaSelection, clampMediaIndex } from "../../functions/email-composer-event-media";
import { AdminMembersPath, AdminPath } from "../../models/admin-route-paths.model";
import {
  ChangeDetectorRef,
  Component,
  DoCheck,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  ViewChild
} from "@angular/core";
import { ActivatedRoute, ParamMap, Router, RouterLink } from "@angular/router";
import { Location, NgClass, NgTemplateOutlet } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { firstValueFrom, Subscription, timer } from "rxjs";
import { VolunteerManagementService } from "../../services/volunteer-management.service";
import { volunteerAudience } from "../../functions/volunteer-audiences";
import {
  VolunteerAudience,
  VolunteerAudienceType,
  VolunteerManagementSnapshot,
  VolunteerWorkspaceView
} from "../../models/volunteer-management.model";
import { volunteerLetterSeed } from "../../functions/volunteer-letters";
import { volunteerMergeFieldsFor } from "../../functions/volunteer-management";
import { HttpClient } from "@angular/common/http";
import { MemberResourcesReferenceDataService } from "../../services/member/member-resources-reference-data.service";
import { switchMap } from "rxjs/operators";
import { cloneDeep, isArray, isNumber, isString, kebabCase, keys, values } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import {
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faAngleLeft,
  faAngleRight,
  faArrowLeft,
  faArrowRight,
  faArrowRotateLeft,
  faCheckCircle,
  faCircleInfo,
  faCompress,
  faExpand,
  faFile,
  faFloppyDisk,
  faFolderOpen,
  faPaperPlane,
  faPlus,
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
  batchSendRecipientSplit,
  buildDefaultFragmentOrder,
  composerCommitteeRecipients,
  composerContentHasPersonalisation,
  composerRecipientAddressesArePrivate,
  composerRecipientCount,
  composerSenderIdentities,
  defaultAddresseeTypeForBranding,
  defaultBrandedSenderEmail,
  defaultEmailComposerState,
  defaultNewsletterSettings,
  defaultReleaseNoteUpdateSettings,
  dividerHtml,
  findRecycledTrackingUrls,
  fragmentIdsWithContent,
  releaseNoteUpdateArticlesFrom,
  releaseNoteUpdateFragmentOrder,
  releaseNoteUpdateSettingsFrom,
  releaseNoteUpdateSubject,
  unbrandedCommitteeSharedTo
} from "../../functions/email-composer";
import {
  committeeFileEmailHtml,
  committeeFileEmailSendsContent,
  committeeMarkdownForEmail,
  hasCommitteeDocumentContent,
  resolvedCommitteeFileEmailInclude
} from "../../functions/committee-file-email";
import {
  markEventsNewSinceLastNewsletter,
  newEventCount,
  newsletterWindowFrom
} from "../../functions/newsletter-window";
import { AiService } from "../../services/ai/ai.service";
import {
  DEFAULT_NEWSLETTER_INTRO_PURPOSE,
  NEWSLETTER_INTRO_PURPOSE_OPTIONS,
  NewsletterIntroEvent,
  NewsletterIntroPurpose,
  NewsletterPlan,
  ReleaseNoteUpdateDraftOutcome,
  ReleaseNoteUpdateResponse
} from "../../models/ai.model";
import { eventsForPurpose } from "../../functions/newsletter-purpose";
import {
  BREVO_SUPPORTED_ATTACHMENT_EXTENSIONS,
  COMMITTEE_ROLE_CAMPAIGN_EXCLUSION_LIST_NAME,
  ComposerDrafting,
  ComposerRoleDefaults,
  CreateCampaignRequest,
  MemberSelection,
  NotificationConfig,
  SendSmtpEmailParams,
  SendStatus,
  StatusMappedResponseSingleInput,
  TemplateRenderRequest
} from "../../models/mail.model";
import { toCampaignContactTokens } from "../../common/campaign-contact-tokens";
import { MailMessagingService } from "../../services/mail/mail-messaging.service";
import { MailService } from "../../services/mail/mail.service";
import { MailListUpdaterService } from "../../services/mail/mail-list-updater.service";
import { MemberService } from "../../services/member/member.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { notificationConfigIdFor } from "../../functions/event-type-notification-config";
import { SalesforceConfigService } from "../../services/salesforce/salesforce-config.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { ListSubscriberService } from "../../services/mail/list-subscriber.service";
import { UrlService } from "../../services/url.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { TiptapMarkdownEditor } from "../../modules/common/tiptap-editor/tiptap-markdown-editor";
import { MaximisablePanelComponent } from "../../modules/common/maximisable-panel/maximisable-panel";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { MemberAdminModalComponent } from "../admin/member-admin-modal/member-admin-modal.component";
import { ArticleBlockSingleEditor } from "../../modules/common/article-blocks/article-block-single-editor";
import { SectionDividerSelectComponent } from "../../modules/common/section-divider-select/section-divider-select";
import { EmailComposerRenderingService } from "../../services/email-composer/email-composer-rendering.service";
import { EmailComposerSendService } from "../../services/email-composer/email-composer-send.service";
import { InboxReplyHandoffService } from "../../services/inbox/inbox-reply-handoff.service";
import { VideoMeetingInviteHandoffService } from "../../services/video-meetings/video-meeting-invite-handoff.service";
import { InboxService } from "../../services/inbox/inbox.service";
import {
  aliasMailboxAddresses,
  inboxMessageMatchingId,
  inboxThreadId,
  newestInboxMessage,
  replyAllRecipients
} from "../../functions/inbox-thread";
import {
  extractLeadingTitle,
  placeForwardedIntroMarkdown,
  planTitledIntroPaste,
  shouldRunIntroSmartPaste,
  subjectStillDefault,
  subjectTextFromPaste
} from "../../functions/email-composer-intro-paste";
import { parseEmailAddressList } from "../../functions/email-addresses";
import { InboxAttachment, InboxReplyComposeResponse } from "../../models/inbox.model";
import TurndownService from "turndown";
import { EmailCompositionsService } from "../../services/email-composer/email-compositions.service";
import { ReleaseNoteUpdateConfigService } from "../../services/email-composer/release-note-update-config.service";
import { NotificationConfigSelectorComponent } from "../admin/system-settings/mail/notification-config-selector";
import { SenderRepliesAndSignoff } from "../admin/send-emails/sender-replies-and-signoff";
import { EmailPreviewComponent } from "../../modules/common/email-preview/email-preview.component";
import { NotificationDirective } from "../../notifications/common/notification.directive";
import { SystemConfig } from "../../models/system.model";
import { CommitteeReferenceData } from "../../services/committee/committee-reference-data";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";

import {
  CommitteeFile,
  committeeMailboxAddresses,
  CommitteeMailboxKind,
  CommitteeMember,
  GroupEventSummary,
  Notification,
  NotificationItem,
  roleEmailAddresses
} from "../../models/committee.model";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { DocumentConversionService } from "../../services/committee/document-conversion.service";
import { CONVERTIBLE_DOCUMENT_EXTENSIONS } from "../../models/aws-object.model";
import { CommitteeDisplayService } from "../committee/committee-display.service";
import { EM_DASH_WITH_SPACES, PageContent } from "../../models/content-text.model";
import { ExternalRecipientService } from "../../services/external-recipient/external-recipient.service";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { eventSlug } from "../../functions/walks/event-slug";
import { DateValue } from "../../models/date.model";
import {
  CommitteeNotificationDetailsComponent
} from "../../notifications/committee/templates/committee-notification-details.component";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { Confirm, ConfirmType, EditMode, StoredValue } from "../../models/ui-actions";
import { UiActionsService } from "../../services/ui-actions.service";
import { BsModalService } from "ngx-bootstrap/modal";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { NgSelectModule } from "@ng-select/ng-select";
import { campaignOverflowNotice } from "../../functions/brevo-campaigns";
import { CampaignOverflowNotice, NGX_BREVO_CAMPAIGN_TAG } from "../../models/brevo-campaign-queue.model";
import { ScheduledTaskId } from "../../models/scheduled-task.model";
import { ScheduledTaskService } from "../../services/scheduled-task.service";
import { stripTrailingSlash } from "../../functions/strings";
import { StickyControlsDirective } from "../../modules/common/tiptap-editor/sticky-controls.directive";

const HIDDEN_STYLE_PATTERN = /display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|max-height\s*:\s*0/i;
const TRACKING_PIXEL_MAX_DIMENSION = 2;
@Component({
  selector: "app-email-composer",
  styleUrls: ["./email-composer.sass"],
  host: {
    "[attr.data-sticky-offset-root]": "''"
  },
  providers: [
    EmailComposerDocumentsService,
    EmailComposerSessionService,
    EmailComposerRecipientSourcesService,
    EmailComposerRecipientResolutionService,
    EmailComposerRecipientsService,
    EmailComposerUpdateSettingsService,
    EmailComposerFragmentsService,
    EmailComposerDraftingService,
    EmailComposerSenderService,
    EmailComposerEventSelectionService
  ],
  imports: [
    EmailComposerDraftingComponent,
    EmailComposerDocumentComponent,
    FocusInputDirective,
    AlertMessageComponent,
    EmailComposerRecipientsComponent, EmailComposerAttachmentsComponent, EmailCompositionListComponent, EmailComposerFragmentsComponent, EmailComposerEventsComponent,
    PageComponent,
    AlertPanelComponent,
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
    TiptapMarkdownEditor,
    StickyControlsDirective,
    MaximisablePanelComponent,
    SectionDividerSelectComponent,
    ArticleBlockSingleEditor,
    NotificationConfigSelectorComponent,
    SenderRepliesAndSignoff,
    EmailPreviewComponent,
    NotificationDirective,
    CommitteeNotificationDetailsComponent,
    DisplayDatePipe,
    FullNameWithAliasPipe,
    RouterLink,
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
          @if (!sendComplete()) {
            <div class="form-check form-switch mb-0 composer-share-switch">
              <input class="form-check-input" type="checkbox" role="switch" id="composition-shared"
                     [checked]="composeShared"
                     (change)="onSharedToggled($any($event.target).checked)">
              <label class="form-check-label" for="composition-shared">Share with committee</label>
            </div>
          }
        </div>
      </div>
      @let recipientsValidationVisible = stepperActiveTab === EmailComposerStepKey.RECIPIENTS && !emptyWorkflowNextConfig() && (recipientsStepErrors().length > 0 || priorSendExclusions.length > 0);
      @let templateValidationVisible = stepperActiveTab === EmailComposerStepKey.TEMPLATE && templateStepErrors().length > 0;
      @let composeUnbrandedNoRecipients = state.brandingMode === BrandingMode.UNBRANDED && !recipientsStepValid();
        @let subjectNeedsEditVisible = subjectStartsWithCopyOf() || subjectUnchangedFromDefault();
        @let
        composeValidationVisible = stepperActiveTab === EmailComposerStepKey.COMPOSE && (composeUnbrandedNoRecipients || (!subjectNeedsEditVisible && composeStepErrors().length > 0));
      @let unbrandedSenderOnTemplateStep = state.brandingMode === BrandingMode.UNBRANDED && stepperActiveTab === EmailComposerStepKey.TEMPLATE;
      @let unbrandedSenderReady = unbrandedSenderOnTemplateStep && !!sender.unbrandedSenderInfo().email && !unbrandedSenderAlertDismissed;
      @let unbrandedSenderLoading = unbrandedSenderOnTemplateStep && !sender.unbrandedSenderInfo().email && !unbrandedSenderCheckReady();
        @let
        recipientsChosenVisible = stepperActiveTab === EmailComposerStepKey.RECIPIENTS && recipientsStepErrors().length === 0 && recipientResolution.totalRecipientCount() > 0 && !recipientsChosenAlertDismissed;
      @let recipientAddressesPrivateVisible = recipientAddressesArePrivate() && !recipientAddressesPrivateAlertDismissed;
        <ng-template #templateStatusErrors>
          @for (error of templateStepErrors(); track $index) {
            <div>
                      @if (isPlainError(error)) {
                        {{ error }}
                      } @else {
                        <span>{{ error.before }}</span><a [routerLink]="error.linkRouterLink"
                                                          [queryParams]="error.linkQueryParams"
                                                          [target]="error.linkTarget ?? null">{{ error.linkText }}</a>@if (error.after) {
                          <span>{{ error.after }}</span>
                        }
                      }
            </div>
          }
        </ng-template>
        <ng-template #composerStatusAlerts>
          <app-alert-panel grouped compact class="mb-3"
                           [attr.role]="inboxReplyLoading || drafting.creatingReleaseNoteUpdate ? 'status' : null"
                           [attr.aria-live]="inboxReplyLoading || drafting.creatingReleaseNoteUpdate ? 'polite' : null">
            @if (inboxReplyLoading) {
              <app-alert-message [messageKey]="state.subject + (state.notificationConfig?.subject?.text || '')"
                                 title="Loading reply…" [icon]="faSpinner" [spinning]="true">

                <div>
                  <div>Fetching the conversation and preparing recipients, subject and quoted message.</div>
                </div>

              </app-alert-message>
            } @else if (drafting.creatingReleaseNoteUpdate) {
              <app-alert-message [messageKey]="state.subject + (state.notificationConfig?.subject?.text || '')"
                                 title="Generating update…" [icon]="faSpinner" [spinning]="true">

                <div>
                  <div>Reading the release notes, preparing the summary and setting up Compose. You will be taken there
                    automatically when it is ready.
                  </div>
                </div>

              </app-alert-message>
            } @else {
              @if (unbrandedSenderReady || unbrandedSenderLoading) {
                <app-alert-message [messageKey]="state.subject + (state.notificationConfig?.subject?.text || '')"
                                   title="{{ composerStatusTitle(unbrandedSenderReady, unbrandedSenderLoading, templateValidationVisible) }}">

                  <div>
                    @if (unbrandedSenderLoading) {
                      <div>Checking which committee role will send this email.</div>
                    }
                    @if (unbrandedSenderReady) {
                      <div>Unbranded emails will go from your {{ sender.unbrandedSenderInfo().description }} role
                        ({{ sender.unbrandedSenderInfo().name }} &lt;{{ sender.unbrandedSenderInfo().email }}&gt;). Sign off the email
                        however you like in the body.
                      </div>
                }
                    @if (templateValidationVisible) {
                      <ng-container *ngTemplateOutlet="templateStatusErrors"/>
                    }
                  </div>

                </app-alert-message>
            }
            @if (templateValidationVisible && !(unbrandedSenderReady || unbrandedSenderLoading)) {
              <app-alert-message [messageKey]="state.subject + (state.notificationConfig?.subject?.text || '')"
                                 title="Before you can continue">

                <div>
                  <ng-container *ngTemplateOutlet="templateStatusErrors"/>
                </div>

              </app-alert-message>
            }
            @if (emptyWorkflowNextConfig(); as next) {
              <app-alert-message title="No members remain for this workflow step" [messageKey]="state.notificationConfig?.id"
                                 actionLabel="Continue to {{ next.subject?.text }}"
                                 (action)="continueToNextConfig(next)">
                Next will open "{{ next.subject?.text }}". This step will not send an email or run its post-send actions.
              </app-alert-message>
            }
            @if (precedingConfig(); as preceding) {
              <app-alert-message [messageKey]="state.subject + (state.notificationConfig?.subject?.text || '')"
                                 title="&quot;{{ state.notificationConfig?.subject?.text }}&quot; is usually sent after &quot;{{ preceding.subject?.text }}&quot;"
                                 actionLabel="Start with &quot;{{ preceding.subject?.text }}&quot;"
                                 (action)="onEmailConfigChanged(preceding)">

                <div>
                  <div>The "{{ preceding.subject?.text }}" email type is set to run this email as its next step, so
                    normally you would start there.
                  </div>
                  <div>Send this on its own only if that step has already been done.</div>
                </div>


              </app-alert-message>
            }
              @if (recipientSources.bulkDeletionPending()) {
                <app-alert-message [messageKey]="state.subject + (state.notificationConfig?.subject?.text || '')"
                                   title="This email workflow deletes its recipients">

                  <div>
                    <div>The "{{ state.notificationConfig?.subject?.text }}" email type will permanently delete its
                      recipients from the database once the email has gone out. This cannot be undone.
                    </div>
                    <div>{{ stringUtils.pluraliseWithCount(bulkDeletionMemberCount(), "member") }} will be removed after
                      the send.
                    </div>
                  </div>

                </app-alert-message>
            }
              @if (recipientSources.memberDisablePending()) {
                <app-alert-message [messageKey]="state.subject + (state.notificationConfig?.subject?.text || '')"
                                   title="This email workflow disables its recipients">

                  <div>
                    <div>The "{{ state.notificationConfig?.subject?.text }}" email type will remove its recipients from
                      the group (unticking Approved Group Member) once the email has gone out.
                    </div>
                    <div>{{ stringUtils.pluraliseWithCount(bulkDeletionMemberCount(), "member") }} will be disabled
                      after the send.
                    </div>
                  </div>

                </app-alert-message>
            }
            @if (recipientsValidationVisible) {
              @if (recipientsStepErrors().length > 0) {
                <app-alert-message title="Before you can continue" [messageKey]="recipientsStepErrors().join()">
                  <div>
                    @for (error of recipientsStepErrors(); track error) {
                      <div>{{ error }}</div>
                    }
                  </div>
                </app-alert-message>
              }
              @if (priorSendExclusions.length > 0) {
                <app-alert-message title="Previously sent recipients" [messageKey]="priorSendDateRangeLabel()"
                                   [actionLabel]="priorSendDetailsExpanded ? 'Hide who' : 'Show who'" (action)="togglePriorSendDetails()">
                  <div>
                  @if (!includeAlreadySent) {
                    {{ priorSendExclusions.length }} {{ priorSendExclusions.length === 1 ? "member was" : "members were" }} excluded because they already received this email{{ priorSendDateRangeLabel() }}.
                  } @else {
                    Including {{ priorSendExclusions.length }} already-sent {{ priorSendExclusions.length === 1 ? "member" : "members" }} in this re-send (originally sent{{ priorSendDateRangeLabel() }}).
                  }

                  </div>
                @if (priorSendDetailsExpanded) {
                  <div>
                    @for (exclusion of priorSendExclusions; track exclusion.member.id) {
                      <div>{{ exclusion.member | fullNameWithAlias }} -
                        sent {{ priorSendDateLabel(exclusion.sentAt) }}
                      </div>
                    }
                  </div>
                }
                <div class="form-check mt-2">
                  <input class="form-check-input"
                         type="checkbox"
                         id="include-already-sent"
                         [checked]="includeAlreadySent"
                         (change)="toggleIncludeAlreadySent()">
                  <label class="form-check-label small" for="include-already-sent">Re-send to members already sent this email</label>
                </div>
                </app-alert-message>
              }
            }
            @if (composeValidationVisible) {
              <app-alert-message [messageKey]="state.subject + (state.notificationConfig?.subject?.text || '')"
                                 title="Before you can continue">

                <div>
                @if (composeUnbrandedNoRecipients) {
                  <div>Paste a forwarded email (with <code>To:</code>, <code>Cc:</code>, <code>Subject:</code> headers)
                    into the body below and the addresses and subject will be picked up automatically, or go back to the
                    Recipients step to add them by hand.
                  </div>
                }
                  @for (error of composeStepErrors(); track error) {
                    <div>{{ error }}</div>
                  }
                </div>

              </app-alert-message>
            }
            <ng-template #subjectCorrection let-outcome="outcome">
              <span><a href="" (click)="$event.preventDefault(); goToCompose()">Update the subject</a> before sending so recipients don't see {{ outcome }}.</span>
            </ng-template>
            @if (subjectStartsWithCopyOf()) {
              <app-alert-message [messageKey]="state.subject + (state.notificationConfig?.subject?.text || '')"
                                 title="Subject still says &quot;Copy of …&quot;">
                <ng-container *ngTemplateOutlet="subjectCorrection; context: {outcome: 'a generated heading'}"/>
              </app-alert-message>
            }
            @if (subjectUnchangedFromDefault()) {
              <app-alert-message [messageKey]="state.subject" title="Subject still has the default text">
                <div>The subject is still "{{ state.subject }}", filled in by this email type.
                  <ng-container *ngTemplateOutlet="subjectCorrection; context: {outcome: 'a generated heading'}"/>
                </div>
              </app-alert-message>
            }
            }


            @if (recipientsChosenVisible) {
              <app-alert-message title="Recipients chosen" (dismissedChange)="dismissRecipientsChosenAlert()">
                {{ recipientCountSummary() }}
              </app-alert-message>
      }
      @if (recipientAddressesPrivateVisible) {
        <app-alert-message title="Recipient addresses are private"
                           (dismissedChange)="dismissRecipientAddressesPrivateAlert()">
          @if (recipientResolution.sendingAsCampaign()) {
            Brevo sends this campaign separately to each subscriber on {{ recipientCountSummary(false) }}. Names and email addresses are not shown to other recipients. Click the list to see who is on it.
          } @else {
            Each person receives their own copy. Names and email addresses are not shown to other recipients.
          }
        </app-alert-message>
      }

            @if (session.notifyTarget.showAlert) {
              <app-alert-message [title]="session.notifyTarget.alertTitle || 'Composer'"
                                 [messageKey]="session.notifyTarget.alertMessage || ''">
                {{ session.notifyTarget.alertMessage }}
              </app-alert-message>
            }
            @if (stepperActiveTab === EmailComposerStepKey.COMPOSE || stepperActiveTab === EmailComposerStepKey.SEND) {
              @if (pendingForwardedHeaderLines.length > 0 && stepperActiveTab === EmailComposerStepKey.COMPOSE) {
                <app-alert-message title="Forwarded email detected" (dismissedChange)="dismissForwardedHeaderOffer()">
                  <div>Recipients and subject were extracted from the headers and placed in the Recipients step and
                    Subject field.
                  </div>
                  <div>The original sender details are included between two horizontal rules. Edit or remove them in the
                    body if you do not want them included.
                  </div>
                  <div>Type your own reply above the first rule.</div>
                </app-alert-message>
              }
              @if (unbrandedListSendBlocked()) {
                <app-alert-message
                  title="Unbranded sends to more than {{ UNBRANDED_HARD_CAP_RECIPIENTS }} recipients are blocked"
                  [messageKey]="recipientCountSummary()" actionLabel="Switch to Branded"
                  [actionIcon]="faArrowRotateLeft" (action)="switchToBrandedFromWarning()">
                  <div>This send is for {{ recipientResolution.totalRecipientCount() }} recipients. At this volume PECR
                    and GDPR require the unsubscribe link and sender identity that the Branded format includes.
                  </div>
                  <div>Switch to Branded mode to continue, or reduce the recipient count.</div>
                </app-alert-message>
              } @else if (showUnbrandedListSendWarning()) {
                <app-alert-message title="This looks like a broadcast rather than a one-to-one reply"
                                   actionLabel="Switch to Branded" [actionIcon]="faArrowRotateLeft"
                                   (action)="switchToBrandedFromWarning()"
                                   (dismissedChange)="dismissUnbrandedListSendWarning()">
                  <div>Branded format includes the unsubscribe link and sender identity that PECR and GDPR require for
                    marketing-style sends to a list. Unbranded omits both, so it is best kept for replies and one-to-few
                    correspondence.
                  </div>
                  @for (reason of unbrandedListSendWarningReasons(); track reason) {
                    <div>{{ reason }}</div>
                  }
                </app-alert-message>
              }
            }
            @if (stepperActiveTab === EmailComposerStepKey.REVIEW || stepperActiveTab === EmailComposerStepKey.SEND) {
              @if (campaignQueueNotice(); as notice) {
                <app-alert-message [title]="notice.title" [messageKey]="notice.message">{{ notice.message }}
                </app-alert-message>
              }
            }
            @if (stepperActiveTab === EmailComposerStepKey.TEMPLATE || stepperActiveTab === EmailComposerStepKey.COMPOSE) {
              @if (newsletterMode()) {
                <app-alert-message [title]="drafting.newsletterWindowTitle()" [messageKey]="drafting.newsletterWindowDescription()">
                  {{ drafting.newsletterWindowDescription() }} The period, the events and the drafted intro can all be changed.
                </app-alert-message>
              } @else if (releaseNoteUpdateMode() && !drafting.creatingReleaseNoteUpdate) {
                <app-alert-message [title]="updateSettings.releaseNoteUpdateWindowTitle(state, session.currentDraftId)"
                                   [messageKey]="updateSettings.releaseNoteUpdateWindowDescription(state, session.currentDraftId)">
                  {{ updateSettings.releaseNoteUpdateWindowDescription(state, session.currentDraftId) }} The drafted copy stays
                  editable on Compose, and nothing is sent until you review it.
                </app-alert-message>
              }
            }
            @if (stepperActiveTab === EmailComposerStepKey.SEND) {
              @if (sendRefusalMessage(); as message) {
                <app-alert-message title="Sending is switched off for this site" [messageKey]="message">
                  <div>{{ message }}</div>
                  <div>Nothing will be sent until it is switched back on. A site administrator can check Mail Settings →
                    API, and the platform administrator if sending has been suspended centrally.
                  </div>
                </app-alert-message>
              }
              @if (sendInProgress) {
                <app-alert-message [title]="sendProgressDescription()" [icon]="faSpinner" [spinning]="true"/>
              }
              @if (batchProgress && nextConfigAfterSend) {
                <app-alert-message title="Next step: {{ nextConfigAfterSend.subject?.text }}"
                                   actionLabel="Continue to {{ nextConfigAfterSend.subject?.text }}"
                                   (action)="continueToNextConfig()">
                  This email type is set to run "{{ nextConfigAfterSend.subject?.text }}" afterwards. Continue to select
                  its recipients and send it.
                </app-alert-message>
              }
            }
            @if (session.attachmentWarning && stepperActiveTab === EmailComposerStepKey.COMPOSE) {
              <app-alert-message title="Attachments"
                                 [messageKey]="session.attachmentWarning">{{ session.attachmentWarning }}
              </app-alert-message>
            }
            @if (stepperActiveTab === EmailComposerStepKey.RECIPIENTS && !recipientResolution.sendingAsCampaign() && state.brandingMode === BrandingMode.UNBRANDED && recipients.replyCcSuggestion.length > 0) {
              <app-alert-message title="Replying from a shared inbox"
                                 (dismissedChange)="recipients.replyCcSuggestion = []">
                <span>Also Cc the other roles?
                  <a class="ms-2 me-2" href="" (click)="$event.preventDefault(); recipients.applyReplyCcSuggestion()">Cc All</a>
                  @for (suggestion of recipients.replyCcSuggestion; track suggestion.email) {
                    <a class="me-2" href="" (click)="$event.preventDefault(); recipients.applyReplyCcSuggestion(suggestion)">{{ suggestion.name || suggestion.email }}</a>
                  }
                </span>
              </app-alert-message>
            }
        </app-alert-panel>

      </ng-template>
      @if (!inboxReplyLoading) {
      <div class="row mb-3">
        <div class="col-sm-12">
          <p-stepper class="mt-3" [value]="$any(stepperActiveTab)" (valueChange)="onStepperValueChange($event)" [linear]="false">
            <div class="composer-sticky-chrome" appStickyControls>
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
            <div class="email-composer-step-caption">
              <div class="email-composer-step-label">{{ currentStepTitle() }}</div>
              <div class="email-composer-step-hint">{{ stepHint(stepperActiveTab) }}</div>
            </div>
      <div class="composer-workspace-actions d-flex gap-2 w-100 align-items-center"
           [class.is-maximised]="composerPanel.maximised">
          <div class="composer-workspace-doc-tools">
          @if (!sendComplete()) {
            <button type="button" class="btn btn-quiet"
                    (click)="saveDraft()"
                    [disabled]="!hasContentToDraft()"
                    tooltip="Save as draft"
                    placement="bottom">
              <fa-icon [icon]="faFloppyDisk" class="me-1"/>Save
            </button>
            @if (session.currentDraftId) {
              <button type="button" class="btn btn-quiet"
                      (click)="revertToSavedDraft()"
                      tooltip="Discard unsaved changes and reload the last saved version"
                      placement="bottom">
                <fa-icon [icon]="faArrowRotateLeft" class="me-1"/>Revert
              </button>
            }
            <div class="btn-group" dropdown>
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
          }
          </div>
          <div class="composer-flow-tools">
            @switch (stepperActiveTab) {
              @case (EmailComposerStepKey.TEMPLATE) {
                <button type="button" class="btn btn-primary" (click)="goNext()" [disabled]="!templateStepValid()" [title]="templateStepValidationMessage()">
                  Next <fa-icon [icon]="faArrowRight"/>
                </button>
              }
              @case (EmailComposerStepKey.RECIPIENTS) {
                <button type="button" class="btn btn-primary" (click)="goPrev()"><fa-icon [icon]="faArrowLeft"/> Back</button>
                <button type="button" class="btn btn-primary" (click)="goNext()" [disabled]="!recipientsStepValid() && !emptyWorkflowNextConfig() && state.brandingMode !== BrandingMode.UNBRANDED" [title]="emptyWorkflowNextConfig() ? 'Continue to the next workflow email' : recipientsStepValid() ? '' : recipientsStepValidationMessage()">
                  Next <fa-icon [icon]="faArrowRight"/>
                </button>
              }
              @case (EmailComposerStepKey.COMPOSE) {
                <button type="button" class="btn btn-primary" (click)="goPrev()"><fa-icon [icon]="faArrowLeft"/> Back</button>
                <button type="button" class="btn btn-primary" (click)="goNext()" [disabled]="!canGoToFollowingStep()" [title]="composeStepNextDisabledMessage()">
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
                  @if (nextConfigAfterSend) {
                    <button type="button" class="btn btn-primary" (click)="continueToNextConfig()"><fa-icon [icon]="faArrowRight"/> Continue to "{{ nextConfigAfterSend.subject?.text }}"</button>
                  }
                  <button type="button" class="btn btn-primary" (click)="newComposition()"><fa-icon [icon]="faFile"/> Start a new email</button>
                  <button type="button" class="btn btn-quiet" (click)="closeAfterSend()"><fa-icon [icon]="faXmark"/> Close</button>
                } @else {
                  <button type="button" class="btn btn-primary" (click)="goPrev()" [disabled]="sendInProgress"><fa-icon [icon]="faArrowLeft"/> Back</button>
                }
              }
            }
            @if (!sendComplete()) {
              @if (sendConfirm.notificationsOutstanding()) {
                <button type="button" class="btn btn-sunset text-nowrap"
                        (click)="confirmAndSend()"
                        [disabled]="sendInProgress">
                  <fa-icon [icon]="faPaperPlane"/> Confirm send
                </button>
                <button type="button" class="btn btn-quiet"
                        (click)="cancelSendConfirm()"
                        [disabled]="sendInProgress">
                  <fa-icon [icon]="faXmark"/> Cancel
                </button>
              } @else if (!sendDisabled() && !hasSendBlockers()) {
                <button type="button" class="btn btn-sunset text-nowrap" (click)="armSend()" [title]="'Send ' + sendingChannelLabel()">
                  <fa-icon [icon]="faPaperPlane"/> Send
                </button>
              }
            }
          </div>
          <div class="composer-workspace-window-tools">
          <button type="button" class="btn btn-quiet composer-maximise-toggle" (click)="composerPanel.toggle()"
                  [tooltip]="composerPanel.maximised ? composerPanel.restoreTooltip : composerPanel.maximiseTooltip">
            <fa-icon [icon]="composerPanel.maximised ? faCompress : faExpand" class="me-1"/>{{ composerPanel.maximised ? 'Restore' : 'Maximise' }}
          </button>
          <button type="button" class="btn btn-quiet" (click)="exitComposer()">
            <fa-icon [icon]="faXmark" class="me-1"/>Exit
          </button>
          </div>
        </div>
            @if (!draftsPanelOpen && !sentEmailsPanelOpen) {
              <ng-container *ngTemplateOutlet="composerStatusAlerts"/>
            }
            </div>
            <h3 class="email-composer-step-title">{{ draftsPanelOpen ? "Drafts" : sentEmailsPanelOpen ? "Sent" : currentStepTitle() }}</h3>
            @if (draftsPanelOpen || sentEmailsPanelOpen) {
              <app-email-composition-list [records]="draftsPanelOpen ? drafts : sentEmails" [members]="recipientSources.members" [busy]="sendInProgress"
                                          (open)="openSavedComposition($event.id)" (deleted)="onCompositionsDeleted($event)"/>
            }
            <p-step-panels [class.d-none]="draftsPanelOpen || sentEmailsPanelOpen">
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
      }
      <div class="d-none" #eventsContent>
        @if (!eventsStepOmitted() && (state.eventInclusion === EventInclusionMode.AUTO_INCLUDE || state.eventInclusion === EventInclusionMode.SINGLE_EVENT) && committeeNotification) {
          <app-committee-notification-details
            [notification]="committeeNotification"
            [members]="recipientSources.members"
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
      <app-email-composer-recipients [forcedMemberLabel]="forcedMemberLabel()"
                                     [recipientSummary]="recipientCountSummary()"
                                     [includeAlreadySent]="includeAlreadySent" [unavailableReasons]="unavailableRecipientReasons()" (clearForced)="clearForcedMember()"
                                     (openMember)="openMemberRecord($event)"
                                     (openSavedAddress)="openSavedAddress($event)"
                                     (priorSendExclusionsChange)="onPriorSendExclusionsChange($event)"/>
    </ng-template>

    <ng-template #templateStep>
      <div class="email-composer-section" [class.email-composer-section-busy]="drafting.creatingReleaseNoteUpdate"
           [attr.inert]="drafting.creatingReleaseNoteUpdate ? '' : null" [attr.aria-busy]="drafting.creatingReleaseNoteUpdate">
        <p class="text-muted small mb-3">Pick the email type (which determines the visual template, banner and any built-in content), then choose which of your addresses the email is from, who replies should go to, and which committee roles sign off.</p>
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
        @if (state.notificationConfigListing && state.brandingMode !== BrandingMode.UNBRANDED) {
          <fieldset class="email-composer-fieldset">
            <legend>Email type &amp; visual template</legend>
            <app-notification-config-selector
              (emailConfigChanged)="onEmailConfigChanged($event)"
              [notificationConfig]="state.notificationConfig"
              [notificationConfigListing]="state.notificationConfigListing"
              [showBranding]="true"/>
            @if (drafting.draftingOffered() || session.platformAdminEnabled || newsletterMode() || releaseNoteUpdateMode()) {
              <ng-container *ngTemplateOutlet="composerStartUi"/>
            }
          </fieldset>
        }
        @if (state.notificationConfig && state.brandingMode !== BrandingMode.UNBRANDED) {
          <fieldset class="email-composer-fieldset">
            <legend>Sender, reply to and sign-off</legend>
            <p class="text-muted small mb-2">{{ composerRoleDefaultsHelp() }}</p>
            <app-sender-replies-and-sign-off
              [mailMessagingConfig]="recipientSources.mailMessagingConfig"
              [notificationConfig]="state.notificationConfig"
              [signOffRolesOverride]="state.signoffRoles"
              (signOffRolesOverrideChange)="state.signoffRoles = $event"
              [senderIdentities]="sender.brandedSenderIdentities()"
              [senderEmail]="sender.resolvedBrandedSenderEmail()"
              (senderEmailChange)="sender.onBrandedSenderEmailChange($event)"
              [allowSelectAllAsMe]="true"
              [omitSender]="true"
              omitSenders
              (senderExists)="senderExists = $event"
              (rolesChanged)="onSignoffRolesChanged()"/>
          </fieldset>
        }
        @if (state.brandingMode === BrandingMode.UNBRANDED) {
          @let roleOptions = sender.unbrandedRoleOptions();
          @let senderInfo = sender.unbrandedSenderInfo();
          @if (senderInfo.email) {
            @if (roleOptions.length > 1) {
              <fieldset class="email-composer-fieldset">
                <legend>Send from which committee role?</legend>
                <p class="text-muted small mb-2">You are linked to more than one role - pick which identity recipients should see.</p>
                <select class="form-control" [ngModel]="sender.resolvedUnbrandedRole()?.type"
                        (ngModelChange)="sender.onUnbrandedSenderRoleChange($event)">
                  @for (role of roleOptions; track role.type) {
                    <option [ngValue]="role.type">{{ role.description }} - {{ role.fullName || '—' }} &lt;{{ role.email }}&gt;</option>
                  }
                </select>
              </fieldset>
            }
            @if (sender.unbrandedSenderAddressOptions().length > 1) {
              <fieldset class="email-composer-fieldset">
                <legend>Send from which address?</legend>
                <p class="text-muted small mb-2">This role has more than one email address - pick which one recipients should see.</p>
                <select class="form-control" [ngModel]="sender.resolvedUnbrandedSenderEmail()"
                        (ngModelChange)="sender.onUnbrandedSenderEmailChange($event)">
                  @for (choice of sender.unbrandedSenderAddressChoices(); track choice.email) {
                    <option [ngValue]="choice.email">{{ choice.label }}</option>
                  }
                </select>
              </fieldset>
            }
          }
        }
      </div>
    </ng-template>

    <ng-template #composerStartUi>
      <app-email-composer-drafting [mode]="EmailComposerDraftingMode.START"
                                  [templateValid]="templateStepValid()" [validationMessage]="templateStepValidationMessage()"/>
    </ng-template>

    <ng-template #composeStep>
      <div class="email-composer-section">
        <fieldset class="email-composer-fieldset">
          <legend>Subject</legend>
          <div>
            <label for="email-subject">Subject line</label>
            <input id="email-subject" [appFocusInput]="pendingSubjectFocus"
                   (focusCompleted)="pendingSubjectFocus = false" type="text" class="form-control"
                   [(ngModel)]="state.subject"
                   [class.is-invalid]="!state.subject?.trim()"
                   placeholder="Enter the subject as it will appear in inboxes"
                   (paste)="onSubjectPaste($event)"/>
            @if (!state.subject?.trim()) {
              <small class="text-danger">Subject line is required</small>
            }
          </div>
          @if (state.brandingMode !== BrandingMode.UNBRANDED) {
            <div class="form-check mt-2">
              <input id="email-show-title" type="checkbox" class="form-check-input" [(ngModel)]="state.showTitle"/>
              <label class="form-check-label" for="email-show-title">Show the subject as a heading at the top of the email</label>
            </div>
          }
        </fieldset>

        <app-email-composer-attachments [attachments]="state.attachments ?? []" [channel]="state.sendingChannel"
                                        (attachmentsChange)="state.attachments = $event"/>

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
          <app-email-composer-fragments [state]="state" [bodyTemplate]="fragmentBodyTemplate"
                                        [committeeFiles]="documents.committeeFiles" [eventSummary]="eventsPreviewSummary()"/>
          <div class="composer-add-row">
            <div class="btn-group" dropdown>
              <button type="button" class="btn btn-sm btn-quiet dropdown-toggle" dropdownToggle>
                <fa-icon [icon]="faPlus" class="me-1"/>Add section
              </button>
              <ul *dropdownMenu class="dropdown-menu" role="menu">
                <li role="menuitem">
                  <button type="button" class="dropdown-item"
                          [disabled]="fragmentEditor.hasFragmentKindAtTopLevel(state, ComposerFragmentKind.INTRO)"
                          (click)="fragmentEditor.addIntroFragment(state)">
                    <fa-icon [icon]="faPlus" class="me-2"/>Intro
                  </button>
                </li>
                @if (state.brandingMode !== BrandingMode.UNBRANDED) {
                  <li role="menuitem">
                    <button type="button" class="dropdown-item" (click)="fragmentEditor.addArticleFragment(state, [])">
                      <fa-icon [icon]="faPlus" class="me-2"/>Article block
                    </button>
                  </li>
                  <li role="menuitem">
                    <button type="button" class="dropdown-item"
                            [disabled]="fragmentEditor.hasFragmentKindAtTopLevel(state, ComposerFragmentKind.EVENTS)"
                            (click)="events.addEventsFragment()">
                      <fa-icon [icon]="faPlus" class="me-2"/>Events
                    </button>
                  </li>
                }
                <li role="menuitem">
                  <button type="button" class="dropdown-item"
                          [disabled]="fragmentEditor.hasFragmentKindAtTopLevel(state, ComposerFragmentKind.SIGNOFF)"
                          (click)="fragmentEditor.addSignoffFragment(state)">
                    <fa-icon [icon]="faPlus" class="me-2"/>Signoff
                  </button>
                </li>
                <li role="menuitem">
                  <button type="button" class="dropdown-item" (click)="documents.onAddCommitteeFileFragmentClicked()">
                    <fa-icon [icon]="faFile" class="me-2"/>Committee file
                  </button>
                </li>
                <li role="menuitem">
                  <button type="button" class="dropdown-item" (click)="fragmentEditor.addDividerFragment(state, [])">
                    <fa-icon [icon]="faPlus" class="me-2"/>Divider
                  </button>
                </li>
                @if (state.brandingMode !== BrandingMode.UNBRANDED) {
                  <li class="dropdown-divider"></li>
                  <li role="menuitem">
                    <button type="button" class="dropdown-item"
                            (click)="fragmentEditor.addMultiColumnFragment(state, 2)">
                      <fa-icon [icon]="faTableColumns" class="me-2"/>2-column row
                    </button>
                  </li>
                  <li role="menuitem">
                    <button type="button" class="dropdown-item"
                            (click)="fragmentEditor.addMultiColumnFragment(state, 3)">
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

    <ng-template #fragmentBodyTemplate let-fragment>
                @switch (fragment.kind) {
                  @case (ComposerFragmentKind.INTRO) {
                    <app-email-composer-drafting [mode]="EmailComposerDraftingMode.INTRO"
                                                [templateValid]="templateStepValid()" [validationMessage]="templateStepValidationMessage()"/>
                    <app-tiptap-markdown-editor #introEditor
                                                [value]="state.introMarkdown"
                                                (valueChange)="onIntroMarkdownChange($event)"
                                                (rawPaste)="onIntroRawPaste($event)"
                                                placeholder="Write your message here…"
                                                stickyToolbar
                                                [showMergeFields]="true"
                                                [mergeFieldCatalogue]="composerMergeFieldCatalogue">
                      <span toolbarExtras class="toolbar-extras">
                        <span class="toolbar-divider"></span>
                        <button type="button" class="toolbar-text-toggle" [disabled]="documentImporting"
                                tooltip="Start the message from a Word or PDF document" container="body" delay=500
                                (click)="documentFileInput.value = ''; documentFileInput.click()">
                          <fa-icon [icon]="documentImporting ? faSpinner : faFile" [spin]="documentImporting" class="me-1"/>
                          {{ documentImporting ? "Importing…" : "Word or PDF" }}
                        </button>
                      </span>
                    </app-tiptap-markdown-editor>
                    <input #documentFileInput type="file" class="d-none"
                           [accept]="documentImportAccept" (change)="onDocumentSelected($event)">
                  }
                  @case (ComposerFragmentKind.SIGNOFF) {
                    <app-tiptap-markdown-editor [value]="state.signoffTextMarkdown"
                                                (valueChange)="state.signoffTextMarkdown = $event"
                                                placeholder="Sign off…"
                                                [showMergeFields]="true"
                                                [mergeFieldCatalogue]="composerMergeFieldCatalogue"/>
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
                      @if (events.selectedGroupEventCount() === 0) {
                        <div class="text-muted small">No events selected. Choose events on the <a href="javascript:void(0)" (click)="goToStepKey(EmailComposerStepKey.EVENTS)">Events step</a>.</div>
                      } @else {
                        <ul class="list-unstyled mb-0 small">
                          @for (event of events.selectedGroupEventsList(); track event.id) {
                            <li>
                              <strong>{{ event.eventDate | displayDate }}</strong>
                              @if (event.eventTime) { <span> &bull; {{ event.eventTime }}</span> }
                              <span> &bull; {{ event.title }}</span>
                            </li>
                          }
                        </ul>
                        <div class="text-muted small mt-1">Edit the list on the <a href="javascript:void(0)" (click)="goToStepKey(EmailComposerStepKey.EVENTS)">Events step</a>.</div>
                      }
                      <app-section-divider-select label="Divider between consecutive events"
                                                  [value]="state.betweenEventsDivider"
                                                  (valueChange)="onBetweenEventsDividerChange($event)"/>
                    </div>
                  }
                  @case (ComposerFragmentKind.COMMITTEE_FILE) {
                    <app-email-composer-document [fragment]="fragment"/>
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
                }
    </ng-template>

    <ng-template #eventsStep>
      <div class="email-composer-section">
        <app-email-composer-events/>
      </div>
    </ng-template>

    <ng-template #reviewStep>
      <div class="email-composer-section">
        <ul class="mb-3">
          <li>Sending mode: <strong>{{ sendingChannelLabel() }}</strong></li>
          <li>Recipients: <strong>{{ recipientCountSummary() }}</strong></li>
          @if (canShareRecipientAddressesOnTo()) {
            <li>To: <strong>everyone on this send will see all recipients</strong> {{ sharedToAddressPreview() }}</li>
          }
          @if (state.recipientMode === RecipientMode.SELECTED_MEMBERS && !sharedToCommitteeSend()) {
            <li>Estimated send time: <strong>{{ estimatedSendTime() }}</strong></li>
          }
        </ul>
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
        @if (batchProgress) {
          <div class="row">
            <div class="col-sm-12">
              <div class="progress mb-2" style="height: 24px;">
                <div class="progress-bar"
                     role="progressbar"
                     [style.width.%]="batchProgressPercent()"
                     [ngClass]="batchProgressBarClass()">
                  {{ batchProcessedCount() }} / {{ batchProgress.totalRecipients }}
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
export class EmailComposer implements OnInit, DoCheck, OnDestroy {
  @HostListener("input")
  @HostListener("change")
  markUserEdit(): void {
    this.userHasEditedComposer = true;
  }

  @HostListener("window:beforeunload", ["$event"])
  warnBeforeBrowserLeave(event: BeforeUnloadEvent): void {
    if (this.shouldWarnAboutUnsavedChanges() && !this.sendInProgress) {
      event.preventDefault();
      event.returnValue = true;
    }
  }

  private logger: Logger = inject(LoggerFactory).createLogger("EmailComposer", NgxLoggerLevel.ERROR);
  private userHasEditedComposer = false;
  private volunteerManagementService = inject(VolunteerManagementService);
  protected volunteerAudienceSummary: VolunteerAudience | null = null;
  private volunteerSnapshot: VolunteerManagementSnapshot | null = null;

  protected get composerMergeFieldCatalogue(): MergeFieldGroup[] {
    return this.session.state.context?.source === EmailComposerContextSource.VOLUNTEER
      ? [...MERGE_FIELD_CATALOGUE, ...VOLUNTEER_MERGE_FIELD_CATALOGUE]
      : MERGE_FIELD_CATALOGUE;
  }

  protected documents = inject(EmailComposerDocumentsService);
  protected events = inject(EmailComposerEventSelectionService);
  protected drafting = inject(EmailComposerDraftingService);
  protected sender = inject(EmailComposerSenderService);
  protected session = inject(EmailComposerSessionService);
  protected recipientSources = inject(EmailComposerRecipientSourcesService);
  protected recipientResolution = inject(EmailComposerRecipientResolutionService);
  protected recipients = inject(EmailComposerRecipientsService);

  protected get state(): EmailComposerState {
    return this.session.state;
  }

  protected set state(value: EmailComposerState) {
    this.session.state = value;
  }

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private uiActions = inject(UiActionsService);
  private location = inject(Location);
  private notifierService = inject(NotifierService);
  private documentConversionService = inject(DocumentConversionService);
  protected readonly documentImportAccept = CONVERTIBLE_DOCUMENT_EXTENSIONS.map(extension => `.${extension}`).join(",");
  protected documentImporting = false;
  protected mailMessagingService = inject(MailMessagingService);
  private mailService = inject(MailService);
  private mailListUpdaterService = inject(MailListUpdaterService);
  private listSubscriberService = inject(ListSubscriberService);
  private memberService = inject(MemberService);
  private memberBulkLoadAuditService = inject(MemberBulkLoadAuditService);
  private memberLoginService = inject(MemberLoginService);
  private memberResourcesReferenceData = inject(MemberResourcesReferenceDataService);
  private changeDetector = inject(ChangeDetectorRef);
  protected pendingSubjectFocus = false;
  private systemConfigService = inject(SystemConfigService);
  private salesforceConfigService = inject(SalesforceConfigService);
  protected stringUtils = inject(StringUtilsService);
  protected dateUtils = inject(DateUtilsService);
  protected updateSettings = inject(EmailComposerUpdateSettingsService);
  protected readonly EmailComposerDraftingMode = EmailComposerDraftingMode;
  protected fragmentEditor = inject(EmailComposerFragmentsService);
  private rendering = inject(EmailComposerRenderingService);
  private sendService = inject(EmailComposerSendService);
  private inboxReplyHandoff = inject(InboxReplyHandoffService);
  private videoMeetingInviteHandoff = inject(VideoMeetingInviteHandoffService);
  private inboxService = inject(InboxService);
  private externalRecipientService = inject(ExternalRecipientService);
  private modalService = inject(BsModalService);
  private committeeConfigService = inject(CommitteeConfigService);
  protected committeeDisplayService = inject(CommitteeDisplayService);
  protected urlService = inject(UrlService);
  private compositionsService = inject(EmailCompositionsService);
  private releaseNoteUpdateConfigService = inject(ReleaseNoteUpdateConfigService);
  private aiService = inject(AiService);
  private scheduledTaskService = inject(ScheduledTaskService);
  private http = inject(HttpClient);
  @ViewChild("emailPreview")
  emailPreview!: EmailPreviewComponent;
  @ViewChild("eventsContent")
  eventsContent!: ElementRef<HTMLDivElement>;
  @ViewChild(Stepper)
  stepperRef!: Stepper;
  @ViewChild(NotificationDirective)
  notificationDirective!: NotificationDirective;
  protected stepperActiveTab: EmailComposerStepKey = EmailComposerStepKey.TEMPLATE;
  protected previewRecipientIndex = 0;
  private autoPreviewPending = false;
  protected stepperSteps = EMAIL_COMPOSER_STEPS;
  protected addresseeOptions = ADDRESSEE_OPTIONS;
  protected senderExists = false;
  protected forcedConfigId: string | null = null;
  protected forcedConfigSlug: string | null = null;
  protected currentComposition: EmailComposition | null = null;
  protected drafts: EmailCompositionSummary[] = [];
  protected sentEmails: EmailCompositionSummary[] = [];
  private salesforceEnabled = false;
  protected draftsPanelOpen = false;
  protected sentEmailsPanelOpen = false;
  protected composeShared = false;
  protected lastSavedAt: number | null = null;
  protected sendInProgress = false;
  protected sendStatus: SendStatus | null = null;
  protected campaignSendComplete = false;
  protected nextConfigAfterSend: NotificationConfig | null = null;
  private postSendRefresh: Promise<void> = Promise.resolve();
  private automaticCampaignReleaseTaskEnabled: boolean | null = null;
  protected unbrandedListSendWarningDismissed = false;
  protected unbrandedSenderAlertDismissed = false;
  protected recipientsChosenAlertDismissed = false;
  protected recipientAddressesPrivateAlertDismissed = false;
  protected readonly UNBRANDED_HARD_CAP_RECIPIENTS = UNBRANDED_HARD_CAP_RECIPIENTS;
  protected batchProgress: BatchSendProgress | null = null;
  protected batchSendJobId: string | null = null;
  protected postSendActionWarningDismissed = false;
  private subscriptions: Subscription[] = [];
  private pollSubscription: Subscription | null = null;
  private userPickedEmailType = false;
  protected readonly EmailComposerStepKey = EmailComposerStepKey;
  protected readonly RecipientMode = RecipientMode;
  protected readonly RecipientField = RecipientField;
  protected readonly RecipientAddressMode = RecipientAddressMode;
  protected readonly EventInclusionMode = EventInclusionMode;
  protected readonly CommitteeFileEmailInclude = CommitteeFileEmailInclude;
  protected readonly ComposerFragmentKind = ComposerFragmentKind;
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
  protected readonly faTableColumns = faTableColumns;
  protected inboxReplyLoading = false;
  private turndownService = new TurndownService({headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced"});
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly faPlus = faPlus;
  protected readonly SendingChannel = SendingChannel;
  protected readonly faTrash = faTrash;

  async ngOnInit(): Promise<void> {
    this.session.notify = this.notifierService.createAlertInstance(this.session.notifyTarget);
    this.subscriptions.push(this.session.requestStep.subscribe(key => {
      this.goToStepKey(this.canAccessStep(key) ? key : EmailComposerStepKey.RECIPIENTS);
    }));
    this.subscriptions.push(this.session.contentChanged.subscribe(() => {
      this.changeDetector.detectChanges();
      this.maybeAutoRefreshPreview();
    }));
    void this.loadSavedExternalRecipients();
    const identityAndSalesforceConfig = Promise.all([
      this.sender.loadLoggedInMemberRecord(),
      this.updateSettings.loadReleaseNoteUpdateDefaults(this.session.state, this.session.currentDraftId),
      this.salesforceConfigService.refresh().then(config => {
        this.salesforceEnabled = config.enabled;
      }),
    ]);
    void this.loadCampaignReleaseTaskState();
    this.subscriptions.push(this.route.queryParamMap.subscribe((paramMap: ParamMap) => {
      void this.applyContextFromRoute(paramMap, this.route.snapshot.paramMap);
      this.applyUrlStateToComposer(paramMap);
      void this.applyCompositionFromRoute(paramMap);
    }));
    this.subscriptions.push(this.committeeConfigService.committeeReferenceDataEvents().subscribe(data => {
      this.recipientSources.committeeReferenceData = data;
      this.recipientResolution.cachedCommitteeAddresses = composerCommitteeRecipients(data?.committeeMembers() ?? []);
      this.recipients.syncNotificationConfigBccIntoBcc();
      this.recipients.syncRecipientAddressMode();
      this.changeDetector.markForCheck();
    }));
    this.subscriptions.push(this.mailMessagingService.events().subscribe(config => {
      this.recipientSources.mailMessagingConfig = config;
      void this.loadSendStatus();
      if (config.committeeReferenceData) {
        this.recipientSources.committeeReferenceData = config.committeeReferenceData as CommitteeReferenceData;
        this.recipientResolution.cachedCommitteeAddresses = composerCommitteeRecipients(this.recipientSources.committeeReferenceData.committeeMembers() ?? []);
        this.recipients.syncNotificationConfigBccIntoBcc();
      }
      if (this.forcedConfigSlug) {
        this.forcedConfigId = this.resolveConfigIdFromSlug(this.forcedConfigSlug);
      }
      this.session.state.notificationConfigListing = {
        mailMessagingConfig: config,
        includeWorkflowRelatedConfigs: false,
        forceIncludeConfigIds: this.forcedIncludeConfigIds()
      };
      if (!this.userPickedEmailType && !this.session.currentDraftId && !this.pendingDraftLoad) {
        this.autoSelectNotificationConfig();
      }
      this.recipients.applyDefaultListIfNeeded();
      this.recipients.syncRecipientAddressMode();
      this.changeDetector.markForCheck();
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.session.systemConfig = systemConfig;
    }));
    this.subscriptions.push(this.memberResourcesReferenceData.platformAdminEnabledChanges().subscribe(enabled => {
      this.session.platformAdminEnabled = enabled;
      this.changeDetector.markForCheck();
    }));
    await identityAndSalesforceConfig;
    this.recipientSources.allMembers = await this.memberService.privilegedFields();
    await this.applyVolunteerAudience();
    this.recipientSources.members = this.recipientSources.allMembers.filter(this.memberService.filterFor.GROUP_MEMBERS);
    this.recipients.applyDefaultListIfNeeded();
    if (this.session.state.brandingMode !== BrandingMode.UNBRANDED) {
      this.recipients.applyPreFilterAudienceToTo();
    } else {
      this.recipients.clearUnbrandedBulkRecipients();
      this.session.state.externalRecipients = this.recipients.expandListChipsWhenMixedWithPeople(this.session.state.externalRecipients ?? []);
    }
    this.recipients.syncRecipientAddressMode();
    this.recipientSources.memberBulkLoadDateMap = await this.loadMemberBulkLoadDateMap();
    if (this.session.state.brandingMode !== BrandingMode.UNBRANDED) {
      this.recipients.applyPreFilterAudienceToTo();
    }
    await this.refreshDrafts();
  }

  private async loadMemberBulkLoadDateMap(): Promise<MemberBulkLoadDateMap | null> {
    try {
      return await this.memberBulkLoadAuditService.createMemberBulkLoadDateMap();
    } catch (error) {
      this.logger.warn("could not load memberBulkLoadDateMap:", error);
      return null;
    }
  }

  private configById(id: string | null | undefined): NotificationConfig | null {
    return id ? (this.recipientSources.mailMessagingConfig?.notificationConfigs ?? []).find(config => config.id === id) ?? null : null;
  }

  private forcedIncludeConfigIds(): string[] {
    return [this.forcedConfigId, this.session.state.notificationConfig?.id].filter((id): id is string => !!id);
  }

  private workflowArrivalConfigId: string | null = null;

  protected precedingConfig(): NotificationConfig | null {
    const currentId = this.session.state.notificationConfig?.id;
    return currentId && this.session.state.brandingMode !== BrandingMode.UNBRANDED
      && this.configById(this.workflowArrivalConfigId)?.nextNotificationConfigId !== currentId
      ? (this.recipientSources.mailMessagingConfig?.notificationConfigs ?? []).find(config => config.nextNotificationConfigId === currentId && config.id !== currentId) ?? null
      : null;
  }

  private offerNextConfigAfterSend(): void {
    this.nextConfigAfterSend = this.session.state.brandingMode === BrandingMode.UNBRANDED
      ? null
      : this.configById(this.session.state.notificationConfig?.nextNotificationConfigId);
  }

  async continueToNextConfig(next: NotificationConfig | null = this.nextConfigAfterSend): Promise<void> {
    if (next) {
      const previousConfigId = this.session.state.notificationConfig?.id ?? null;
      await this.postSendRefresh;
      this.nextConfigAfterSend = null;
      this.batchProgress = null;
      this.campaignSendComplete = false;
      this.sendConfirm.clear();
      this.session.notify.hide();
      this.session.state.subject = "";
      this.session.state.selectedMemberIds = [];
      this.onEmailConfigChanged(next);
      this.workflowArrivalConfigId = previousConfigId;
      this.goToStepKey(EmailComposerStepKey.RECIPIENTS);
    }
  }

  private async refreshMembersAfterPostSendActions(): Promise<void> {
    if ((this.session.state.notificationConfig?.postSendActions ?? []).length > 0) {
      try {
        this.recipientSources.allMembers = await this.memberService.privilegedFields();
        this.recipientSources.members = this.recipientSources.allMembers.filter(this.memberService.filterFor.GROUP_MEMBERS);
        this.recipientSources.memberBulkLoadDateMap = await this.loadMemberBulkLoadDateMap();
        this.logger.info("refreshed", this.recipientSources.members.length, "group members after post-send actions");
      } catch (error) {
        this.logger.error("could not refresh members after post-send actions:", error);
      }
      this.changeDetector.markForCheck();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.pollSubscription?.unsubscribe();
  }

  private async applyContextFromRoute(queryParams: ParamMap, pathParams: ParamMap): Promise<void> {
    const draftId = queryParams.get(StoredValue.DRAFT_ID);
    const slug = draftId ? null : queryParams.get(StoredValue.CONFIG_ID);
    this.forcedConfigSlug = slug;
    this.forcedConfigId = this.resolveConfigIdFromSlug(slug);
    const memberParam = queryParams.get(StoredValue.MEMBER);
    if (memberParam) {
      this.recipients.forcedMemberId = memberParam;
    }
    const sourcePage = queryParams.get(StoredValue.SOURCE_PAGE);
    const committeeFile = queryParams.get(StoredValue.COMMITTEE_FILE);
    const eventQuery = queryParams.get(StoredValue.EVENT);
    const eventPath = pathParams.get(StoredValue.COMMITTEE_EVENT_ID);
    if (eventQuery && !committeeFile && !sourcePage) {
      this.session.state.context = {source: EmailComposerContextSource.GROUP_EVENT, groupEventId: eventQuery};
      this.session.state.eventInclusion = EventInclusionMode.SINGLE_EVENT;
      this.events.ensureGroupEventsFilter();
      await this.events.loadSingleEvent(eventQuery);
      this.autoSelectNotificationConfig();
      this.applyGroupEventCampaignRecipients();
    } else if (committeeFile || sourcePage || eventPath) {
      this.session.state.context = {
        source: EmailComposerContextSource.COMMITTEE,
        committeeFileSlug: committeeFile ?? undefined,
        sourcePagePath: sourcePage ?? undefined,
        groupEventId: eventPath ?? undefined
      };
      if (committeeFile) {
        this.session.state.eventInclusion = EventInclusionMode.NONE;
        await this.documents.loadAllCommitteeFiles();
        const matched = this.documents.allCommitteeFiles.find(file => this.committeeDisplayService.committeeFileSlug(file) === committeeFile);
        if (matched) {
          this.documents.ensureCommitteeFileFragmentForIds([matched.id]);
          await this.documents.resolveCommitteeFiles(this.documents.allFragmentCommitteeFileIds());
        } else {
          this.logger.warn("applyContextFromRoute:no committee file matched slug:", committeeFile);
        }
      } else {
        this.session.state.eventInclusion = EventInclusionMode.AUTO_INCLUDE;
        this.events.ensureGroupEventsFilter();
        await this.events.populateGroupEvents();
      }
    } else if (queryParams.get(StoredValue.AUDIENCE)) {
      this.session.state.context = {
        source: EmailComposerContextSource.VOLUNTEER,
        volunteerAudience: {
          audienceType: queryParams.get(StoredValue.AUDIENCE) as VolunteerAudienceType,
          localAuthorityCode: queryParams.get(StoredValue.AUTHORITY),
          sectorCode: queryParams.get(StoredValue.SECTOR),
          rightsOfWayGroupCode: queryParams.get(StoredValue.GROUP)
        }
      };
      this.session.state.eventInclusion = EventInclusionMode.NONE;
      const letterSeed = volunteerLetterSeed(queryParams.get(StoredValue.LETTER));
      if (letterSeed) {
        this.session.state.subject = letterSeed.subject;
        this.session.state.introMarkdown = letterSeed.introMarkdown;
      }
    } else {
      this.session.state.context = {source: EmailComposerContextSource.ADMIN};
      this.session.state.eventInclusion = EventInclusionMode.NONE;
    }
  }

  private async ensureVolunteerSnapshot(): Promise<void> {
    if (!this.volunteerSnapshot) {
      const groupCode = this.session.systemConfig?.group?.groupCode ?? "";
      try {
        this.volunteerSnapshot = await firstValueFrom(this.volunteerManagementService.snapshot(groupCode));
      } catch (error) {
        this.logger.error("ensureVolunteerSnapshot failed", error);
      }
    }
  }

  private async applyVolunteerAudience(): Promise<void> {
    const criteria = this.session.state.context?.volunteerAudience;
    if (criteria?.audienceType) {
      try {
        const groupCode = this.session.systemConfig?.group?.groupCode ?? "";
        const [snapshot, contacts] = await Promise.all([
          firstValueFrom(this.volunteerManagementService.snapshot(groupCode)),
          this.externalRecipientService.list()
        ]);
        const audience = volunteerAudience(criteria, {
          parishes: snapshot.parishes,
          assignments: snapshot.assignments,
          members: this.recipientSources.allMembers,
          contacts
        });
        this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
        this.session.state.selectedMemberIds = audience.supporterIds;
        this.session.state.externalRecipients = audience.externalRecipients.map(recipient => ({
          email: recipient.email,
          name: recipient.name
        }));
        this.volunteerAudienceSummary = audience;
        this.volunteerSnapshot = snapshot;
        this.logger.info("applyVolunteerAudience:", audience.title, "members:", audience.supporterIds.length, "contacts:", audience.externalRecipients.length, "excluded:", audience.excluded.length);
      } catch (error) {
        this.logger.error("applyVolunteerAudience failed", error);
        this.session.notify.error({
          title: "Volunteer audience could not be loaded",
          message: this.stringUtils.stringifyObject(error)
        });
      }
    }
  }

  private routeCompositionKey: string | null = null;
  private pendingDraftLoad = false;

  private async applyCompositionFromRoute(queryParams: ParamMap): Promise<void> {
    const draftId = queryParams.get(StoredValue.DRAFT_ID);
    const copyOfId = queryParams.get(StoredValue.COPY_OF);
    const key = draftId ? `draft:${draftId}` : copyOfId ? `copy-of:${copyOfId}` : null;
    if (!(key === this.routeCompositionKey)) {
      this.routeCompositionKey = key;
      if (draftId) {
        this.pendingDraftLoad = true;
        await this.loadDraft(draftId);
        this.pendingDraftLoad = false;
      } else if (copyOfId) {
        await this.useAsTemplate(copyOfId);
      }
    }
  }

  protected newsletterMode(): boolean {
    return this.session.newsletterMode();
  }

  protected releaseNoteUpdateMode(): boolean {
    return this.session.releaseNoteUpdateMode();
    }

  protected async copyComposerStateAsJson(): Promise<void> {
    try {
      const sanitised = this.compositionsService.serialiseStateForStorage(this.session.state);
      const text = JSON.stringify(sanitised, null, 2);
      await navigator.clipboard.writeText(text);
      this.session.notify.success({title: "Copied", message: "Composer state copied to clipboard as JSON"});
    } catch (error) {
      this.logger.error("copyComposerStateAsJson failed:", error);
      this.session.notify.error({title: "Copy failed", message: "Could not copy composer state. See console for details."});
    }
  }

  protected committeeNotification: Notification | null = null;
  private committeeNotificationInputs: unknown[] = [];

  ngDoCheck(): void {
    this.refreshCommitteeNotification();
  }

  private refreshCommitteeNotification(): void {
    if (!this.session.state.notificationConfig || !this.session.state.groupEventsFilter) {
      this.committeeNotification = null;
      this.committeeNotificationInputs = [];
    } else {
      const inputs = [
        this.session.state.notificationConfig,
        this.session.state.subject ?? "",
        this.addresseePlaceholder(),
        this.session.state.selectedListId ?? undefined,
        this.session.state.selectedMemberIds,
        this.session.state.groupEvents,
        this.session.state.groupEventsFilter
      ];
      const unchanged = this.committeeNotification
        && this.committeeNotificationInputs.length === inputs.length
        && this.committeeNotificationInputs.every((value, index) => value === inputs[index]);
      if (!unchanged) {
        this.committeeNotificationInputs = inputs;
        this.committeeNotification = {
          cancelled: false,
          content: {
            notificationConfig: this.session.state.notificationConfig,
            text: {value: "", include: false},
            signoffText: {value: "", include: false},
            title: {value: this.session.state.subject ?? "", include: false},
            addresseeType: this.addresseePlaceholder(),
            listId: this.session.state.selectedListId ?? undefined,
            selectedMemberIds: this.session.state.selectedMemberIds,
            signoffAs: {value: "", include: false},
            includeDownloadInformation: false
          },
          groupEvents: this.session.state.groupEvents,
          groupEventsFilter: this.session.state.groupEventsFilter
        };
      }
    }
  }

  private renderedEventsHtml(): string {
    if (this.eventsStepOmitted() || this.session.state.eventInclusion === EventInclusionMode.NONE) {
      return "";
    } else {
      return this.eventsContent?.nativeElement?.innerHTML ?? "";
    }
  }

  private renderedCommitteeFileHtmlForFragment(fragment: ComposerFragment): string {
    const sourcePagePath = this.session.state.context?.sourcePagePath;
    const sourcePage = sourcePagePath
      ? {
        href: this.documents.absoluteSourcePageUrl(),
        groupName: this.session.systemConfig?.group?.shortName || "",
        pageTitle: this.documents.sourcePageTitleOrFallback()
      }
      : null;
    return this.documents.committeeFilesFor(fragment).map(file => committeeFileEmailHtml({
      subject: this.documents.committeeFileNotificationItemFor(file).subject,
      markdown: hasCommitteeDocumentContent(file) ? file.document?.markdown || "" : "",
      link: {
        href: this.committeeDisplayService.fileUrl(file, this.documents.committeeFileLinkPath(file)),
        label: this.documents.committeeFileDownloadLabel(file)
      },
      sourcePage,
      include: this.documents.committeeFileInclude(fragment)
    })).join("");
  }

  private async campaignExclusionListId(emails: string[]): Promise<number | null> {
    const resolved = {listId: null as number | null};
    if (emails.length > 0) {
      const lists = await this.mailService.queryLists();
      const existing = (lists.lists ?? []).find(list => list.name === COMMITTEE_ROLE_CAMPAIGN_EXCLUSION_LIST_NAME);
      const created = existing ? null : await this.mailService.createList({name: COMMITTEE_ROLE_CAMPAIGN_EXCLUSION_LIST_NAME});
      resolved.listId = existing?.id ?? created?.id ?? null;
      if (resolved.listId !== null) {
        await this.mailService.addContactsToList({listId: resolved.listId, emails});
      }
    }
    return resolved.listId;
  }

  private readonly unbrandedAutoFillLimit = 20;
  protected pendingForwardedHeaderLines: string[] = [];
  private introEditorRef?: TiptapMarkdownEditor;
  private pendingIntroFocus = false;

  @ViewChild("introEditor")
  set introEditor(editor: TiptapMarkdownEditor | undefined) {
    this.introEditorRef = editor;
    if (editor && this.pendingIntroFocus) {
      this.pendingIntroFocus = false;
      queueMicrotask(() => editor.focusAtStart());
    }
  }

  get introEditor(): TiptapMarkdownEditor | undefined {
    return this.introEditorRef;
  }

  protected onSubjectPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData("text/plain") ?? "";
    const html = event.clipboardData?.getData("text/html") ?? "";
    const plain = subjectTextFromPaste(text, html);
    const input = event.target as HTMLInputElement;
    const current = this.session.state.subject ?? "";
    const start = input.selectionStart ?? current.length;
    const end = input.selectionEnd ?? start;
    event.preventDefault();
    this.session.state.subject = `${current.slice(0, start)}${plain}${current.slice(end)}`;
  }

  protected onIntroRawPaste(event: {
    text: string;
    html?: string;
    consume: () => void;
  }): void {
    if (!this.session.inboxReplyContext) {
      const titled = extractLeadingTitle(event.text, event.html);
      const parsedHeaders = parseEmailHeadersFromMarkdown(event.text);
      if (parsedHeaders?.subject && emailHeadersNearTop(event.text)) {
        this.session.state.subject = parsedHeaders.subject;
      }
      if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
        if (shouldRunIntroSmartPaste(true, !!this.session.inboxReplyContext)) {
          const existingIntro = this.session.state.introMarkdown ?? "";
          const hasExistingIntro = existingIntro.trim().length > 0;
          const parsed = parsedHeaders;
          if (titled && !(parsed && emailHeadersNearTop(event.text))) {
            const plan = planTitledIntroPaste(event.text, titled, this.session.state.subject ?? "", this.session.state.notificationConfig?.subject?.text ?? "", hasExistingIntro);
            if (plan.apply) {
              event.consume();
              if (plan.subject) {
                this.session.state.subject = plan.subject;
              }
              this.session.state.introMarkdown = this.introEditor?.unwrapIfEnabled(plan.body) ?? plan.body;
              this.session.state.addresseeType = AddresseeType.NONE;
              this.pendingForwardedHeaderLines = [];
              queueMicrotask(() => this.introEditor?.focusAtStart());
            }
          } else {
            if (parsed) {
              event.consume();
              const incomingAddresses = [...parsed.to, ...parsed.cc];
              const existing = new Set(this.session.state.externalRecipients.map(item => item.email.toLowerCase()));
              const additions = incomingAddresses
                .filter(addr => !existing.has(addr.email.toLowerCase()))
                .map(addr => ({
                  email: addr.email,
                  name: addr.name || this.sender.nameFromEmail(addr.email) || undefined,
                  saveForReuse: true
                }));
              if (additions.length > 0) {
                this.session.state.externalRecipients = [...this.session.state.externalRecipients, ...additions];
              }
              if (parsed.subject) {
                this.session.state.subject = parsed.subject;
              }
              if (!hasExistingIntro) {
                this.session.state.addresseeType = AddresseeType.NONE;
              }
              const unwrappedBody = this.introEditor?.unwrapIfEnabled(parsed.body) ?? parsed.body;
              const forwardedMarkdown = buildForwardedIntroMarkdown(parsed.forwardedHeaderLines, unwrappedBody);
              this.session.state.introMarkdown = placeForwardedIntroMarkdown(existingIntro, forwardedMarkdown, true);
              this.pendingForwardedHeaderLines = parsed.forwardedHeaderLines;
              queueMicrotask(() => hasExistingIntro ? this.introEditor?.focusAtEnd() : this.introEditor?.focusAtStart());
            }
          }
        }
        this.autoResolveTrackingUrls().catch(error => this.logger.warn("auto-resolve tracking urls failed", error));
      }
      if (titled && this.subjectStillAutomatic()) {
        this.session.state.subject = titled.title;
      }
    }
  }

  private automaticGeneratedSubjects(): string[] {
    const templateSubject = this.session.state.notificationConfig?.subject?.text ?? "";
    const newsletterPeriod = this.session.state.compositionKind === EmailCompositionKind.NEWSLETTER ? this.drafting.newsletterPeriodDescription() : null;
    const releaseNotePeriod = this.session.state.compositionKind === EmailCompositionKind.RELEASE_NOTE_UPDATE ? this.updateSettings.releaseNoteUpdatePeriodDescription(this.session.state, this.session.currentDraftId) : null;
    return [
      newsletterPeriod ? `What's coming up: ${newsletterPeriod}` : null,
      releaseNotePeriod ? releaseNoteUpdateSubject(templateSubject, templateSubject, releaseNotePeriod) : null
    ].filter((subject): subject is string => !!subject);
  }

  private subjectStillAutomatic(): boolean {
    const templateSubject = this.session.state.notificationConfig?.subject?.text ?? "";
    return subjectStillDefault(this.session.state.subject ?? "", templateSubject, this.automaticGeneratedSubjects());
  }

  protected dismissForwardedHeaderOffer(): void {
    this.pendingForwardedHeaderLines = [];
  }

  protected onIntroMarkdownChange(value: string): void {
    this.session.state.introMarkdown = value ?? "";
    if (!(this.session.state.addresseeType === AddresseeType.NONE)) {
      const firstLine = (value ?? "")
        .replace(/^[\s>*_`#-]+/, "")
        .split(/\r?\n/)[0]
        ?.trim() ?? "";
      if (/^(hi|hello|hey|dear|good (morning|afternoon|evening))\b/i.test(firstLine)) {
        this.session.state.addresseeType = AddresseeType.NONE;
      }
    }
  }

  protected async onDocumentSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.documentImporting = true;
      this.session.notify.progress({title: "Document import", message: `Converting ${file.name}…`});
      try {
        const converted = await this.documentConversionService.convertFile(file);
        const markdown = this.documentConversionService.separateEditingBlocks(converted.markdown);
        this.session.state.introMarkdown = [this.session.state.introMarkdown, markdown].filter(Boolean).join("\n\n");
        this.introEditor?.syncValue(this.session.state.introMarkdown);
        this.introEditor?.focusAtEnd();
        this.session.notify.success({
          title: "Document imported",
          message: `Review the content from ${file.name} before sending`
        });
      } catch (error) {
        this.session.notify.error({
          title: "Document import failed",
          message: error?.error?.error || error?.message || "An unexpected error occurred"
        });
      } finally {
        this.documentImporting = false;
      }
    }
  }

  private autoSelectNotificationConfig(): void {
    if (!this.session.state.notificationConfigListing || this.session.state.brandingMode === BrandingMode.UNBRANDED) {
      return;
    } else {
      const candidates = this.mailMessagingService.notificationConfigs(this.session.state.notificationConfigListing);
      const restoredConfig = candidates.find(candidate => candidate.id === this.session.state.notificationConfig?.id);
      if (restoredConfig && !this.session.state.notificationConfig?.subject && !this.session.state.notificationConfig?.templateName) {
        this.session.state.notificationConfig = cloneDeep(restoredConfig);
      }
      const forced = this.forcedConfigId
        ? candidates.find(candidate => candidate.id === this.forcedConfigId)
        : undefined;
      if (forced) {
        if (forced.id !== this.session.state.notificationConfig?.id) {
          this.applyNotificationConfig(forced);
        }
        this.applyGroupEventCampaignRecipients();
      } else if (!this.userPickedEmailType && !this.session.state.notificationConfig?.id) {
        const preferred = this.preferredConfigForCurrentContext(candidates);
        const next = preferred ?? (!this.session.state.notificationConfig && candidates.length > 0 ? candidates[0] : undefined);
        if (next && next.id !== this.session.state.notificationConfig?.id) {
          this.applyNotificationConfig(next);
          this.applyGroupEventCampaignRecipients();
        }
      }
    }
  }

  private applyGroupEventCampaignRecipients(): void {
    const config = this.session.state.notificationConfig;
    if (this.session.state.context?.source === EmailComposerContextSource.GROUP_EVENT
      && !this.recipients.userPickedRecipientMode
      && this.session.state.brandingMode !== BrandingMode.UNBRANDED
      && config?.defaultMemberSelection === MemberSelection.MAILING_LIST) {
      this.session.state.recipientMode = RecipientMode.ENTIRE_LIST;
      this.session.state.sendingChannel = SendingChannel.CAMPAIGN;
      this.session.state.preFilterKey = null;
      this.session.state.selectedMemberIds = [];
      if (isNumber(config.defaultListId)) {
        this.session.state.selectedListId = config.defaultListId;
      }
      this.recipients.applyDefaultListIfNeeded();
      this.recipients.syncRecipientAddressMode();
      this.session.syncStateToUrl({
        [StoredValue.EMAIL_TYPE]: kebabCase(RecipientMode.ENTIRE_LIST),
        [StoredValue.LIST_ID]: this.session.state.selectedListId?.toString() ?? null,
        [StoredValue.PRE_FILTER]: null
      });
    }
  }

  private preferredConfigForCurrentContext(candidates: NotificationConfig[]): NotificationConfig | undefined {
    const configId = this.session.state.context?.source === EmailComposerContextSource.GROUP_EVENT
      ? notificationConfigIdFor(this.session.systemConfig?.group, this.session.state.singleEvent?.groupEvent?.item_type)
      : null;
    return configId ? candidates.find(candidate => candidate.id === configId) : undefined;
  }

  setBrandingMode(mode: BrandingMode, preserveRecipientMode = false): void {
    const previousMode = this.session.state.brandingMode;
    this.session.state.brandingMode = mode;
    if (previousMode !== mode) {
      this.unbrandedListSendWarningDismissed = false;
      this.unbrandedSenderAlertDismissed = false;
      this.session.state.addresseeType = defaultAddresseeTypeForBranding(mode);
    }
    if (mode === BrandingMode.UNBRANDED) {
      this.recipients.recipientsPanelExpanded = true;
      if (!preserveRecipientMode && this.session.state.recipientMode !== RecipientMode.SELECTED_MEMBERS) {
        this.recipients.setRecipientMode(RecipientMode.SELECTED_MEMBERS);
      }
      if (this.stepperActiveTab === EmailComposerStepKey.EVENTS) {
        this.goToStepKey(EmailComposerStepKey.COMPOSE);
      }
      this.session.state.signoffRoles = [];
      this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
      this.session.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
      this.session.state.selectedListId = null;
      this.session.state.narrowListId = null;
      this.session.state.preFilterKey = null;
      this.session.state.selectedMemberIds = [];
      if (previousMode !== BrandingMode.UNBRANDED) {
        this.session.state.externalRecipients = [];
        this.session.state.ccRecipients = [];
        this.session.state.bccRecipients = [];
        this.session.state.fragmentOrder = buildDefaultFragmentOrder(this.session.state, {unbranded: true});
        this.fragmentEditor.expandedFragmentIds.add("intro");
        this.session.state.notificationConfig = null;
        this.session.state.bannerId = null;
        this.forcedConfigId = null;
        this.forcedConfigSlug = null;
      } else {
        this.recipients.clearUnbrandedBulkRecipients();
      }
    } else {
      if (this.session.state.externalRecipients?.length) {
        this.session.state.externalRecipients = [];
      }
      if (this.session.state.recipientMode !== RecipientMode.ENTIRE_LIST) {
        this.recipients.setRecipientMode(RecipientMode.ENTIRE_LIST);
      }
      this.autoSelectNotificationConfig();
    }
    const urlUpdates: Record<string, string | null> = {[StoredValue.BRANDING]: mode};
    if (mode === BrandingMode.UNBRANDED) {
      urlUpdates[StoredValue.CONFIG_ID] = null;
      urlUpdates[StoredValue.LIST_ID] = null;
      urlUpdates[StoredValue.PRE_FILTER] = null;
      urlUpdates[StoredValue.EMAIL_TYPE] = kebabCase(RecipientMode.SELECTED_MEMBERS);
    }
    this.session.syncStateToUrl(urlUpdates);
    this.uiActions.saveValueFor(StoredValue.BRANDING, mode);
  }

  private async loadSavedExternalRecipients(): Promise<void> {
    try {
      this.recipients.savedExternalRecipients = await this.externalRecipientService.list();
    } catch (error) {
      this.logger.error("loadSavedExternalRecipients failed:", error);
      this.recipients.savedExternalRecipients = [];
    }
  }

  protected composerStatusTitle(unbrandedSenderReady: boolean, unbrandedSenderLoading: boolean, templateValidationVisible = false): string {
    if (templateValidationVisible) {
      return "Before you can continue";
    } else if (unbrandedSenderLoading) {
      return "Loading sender";
    } else if (unbrandedSenderReady) {
      return "Sender";
    } else {
      return "Composer";
    }
  }

  protected openMemberRecord(member: Member): void {
    this.modalService.show(MemberAdminModalComponent, {
      class: "modal-xl",
      animated: false,
      show: true,
      initialState: {
        editMode: EditMode.EDIT,
        member: cloneDeep(member),
        members: this.recipientSources.allMembers
      }
    });
  }

  protected openSavedAddress(recipient: ComposerExternalRecipient): void {
    void this.router.navigate(["/", ...AdminMembersPath.VOLUNTEERS.split("/")], {
      queryParams: {
        [StoredValue.TAB]: VolunteerWorkspaceView.CONTACTS,
        [StoredValue.SEARCH]: recipient.email || null
      }
    });
  }

  protected openSavedAddressesAdmin(): void {
    void this.router.navigate(["/", ...AdminMembersPath.VOLUNTEERS.split("/")], {
      queryParams: {[StoredValue.TAB]: VolunteerWorkspaceView.CONTACTS}
    });
  }

  protected sharedToCommitteeSend(): boolean {
    if (this.contentIsPersonalised()) {
      return false;
    } else {
      const toMembers = this.recipientResolution.membersInHeader(this.session.state.externalRecipients ?? []);
      return unbrandedCommitteeSharedTo({
        brandingMode: this.session.state.brandingMode,
        recipientMode: this.session.state.recipientMode,
        allMembersHoldCommitteeRoles: this.recipientResolution.allSelectedMembersHoldCommitteeRoles(),
        memberCount: toMembers.length,
        externalToCount: (this.session.state.externalRecipients ?? []).length - toMembers.length
      });
    }
  }

  protected contentIsPersonalised(): boolean {
    const {top, bottom, combined} = this.composedBodyParts();
    return composerContentHasPersonalisation([this.session.state.subject, this.session.state.introMarkdown, this.session.state.signoffTextMarkdown, top, bottom, combined], this.session.state.addresseeType);
  }

  protected visibleToRecipientCount(): number {
    return this.recipientResolution.sendingAsCampaign() ? 0 : composerRecipientCount(this.session.state.externalRecipients ?? []);
  }

  protected sharedToAddressPreview(): string {
    const names = this.previewEntries()
      .map(entry => entry.name)
      .filter(name => !!name);
    if (names.length === 0) {
      return "";
    } else {
      return `(${names.join(", ")})`;
    }
  }

  protected replyCcSuggestionLabel(): string {
    return this.recipients.replyCcSuggestion.map(recipient => recipient.name || recipient.email).join(", ");
    }

  private applyUrlStateToComposer(queryParams: ParamMap): void {
    const branding = queryParams.get(StoredValue.BRANDING);
    const storedBranding = this.uiActions.initialValueFor(StoredValue.BRANDING, BrandingMode.BRANDED);
    if (branding === BrandingMode.UNBRANDED && this.session.state.brandingMode !== BrandingMode.UNBRANDED) {
      this.setBrandingMode(BrandingMode.UNBRANDED, true);
    } else if (branding === BrandingMode.BRANDED && this.session.state.brandingMode !== BrandingMode.BRANDED) {
      this.setBrandingMode(BrandingMode.BRANDED, true);
    } else if (!branding && storedBranding === BrandingMode.UNBRANDED && this.session.state.brandingMode !== BrandingMode.UNBRANDED) {
      this.setBrandingMode(BrandingMode.UNBRANDED, true);
    } else if (!branding && storedBranding === BrandingMode.BRANDED && this.session.state.brandingMode !== BrandingMode.BRANDED) {
      this.setBrandingMode(BrandingMode.BRANDED, true);
    }
    const emailType = queryParams.get(StoredValue.EMAIL_TYPE);
    if (emailType === kebabCase(RecipientMode.ENTIRE_LIST) && this.session.state.brandingMode !== BrandingMode.UNBRANDED && this.session.state.recipientMode !== RecipientMode.ENTIRE_LIST) {
      this.session.state.recipientMode = RecipientMode.ENTIRE_LIST;
      this.session.state.sendingChannel = this.recipientResolution.sendingAsCampaign()
        ? SendingChannel.CAMPAIGN
        : SendingChannel.TRANSACTIONAL_BATCH;
      this.session.state.preFilterKey = null;
    } else if (emailType === kebabCase(RecipientMode.SELECTED_MEMBERS) && this.session.state.recipientMode !== RecipientMode.SELECTED_MEMBERS) {
      const keepEventOnList = this.session.state.context?.source === EmailComposerContextSource.GROUP_EVENT && !this.recipients.userPickedRecipientMode;
      if (!keepEventOnList) {
        this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
        this.session.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
      }
    }
    const listId = queryParams.get(StoredValue.LIST_ID);
    if (listId) {
      const numeric = Number(listId);
      if (!Number.isNaN(numeric)) {
        const unbrandedListAllowed = this.session.state.brandingMode !== BrandingMode.UNBRANDED
          || this.recipientSources.unbrandedCommitteeLists().some(list => list.id === numeric);
        if (!unbrandedListAllowed) {
          this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
          this.session.state.selectedListId = null;
          this.session.state.narrowListId = null;
          this.session.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
          this.session.syncStateToUrl({
            [StoredValue.EMAIL_TYPE]: kebabCase(RecipientMode.SELECTED_MEMBERS),
            [StoredValue.LIST_ID]: null
          });
        } else if (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST) {
          this.session.state.selectedListId = numeric;
        } else if (this.session.state.narrowListId !== numeric) {
          this.session.state.narrowListId = numeric;
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
      this.session.state.preFilterKey = preFilter as MemberSelection;
    }
    const eventInclusion = queryParams.get(StoredValue.EVENT_INCLUSION);
    if (eventInclusion && values(EventInclusionMode).includes(eventInclusion as EventInclusionMode)) {
      this.session.state.eventInclusion = eventInclusion as EventInclusionMode;
      if (this.session.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE) {
        this.events.ensureGroupEventsFilter();
      }
    }
    const divider = queryParams.get(StoredValue.DIVIDER);
    if (divider && values(SectionDividerStyle).includes(divider as SectionDividerStyle)) {
      const style = divider as SectionDividerStyle;
      this.session.state.introDividerAfter = style;
      this.session.state.eventsDividerAfter = style;
      this.session.state.signoffDividerAfter = style;
    }
    const dateFromMillis = queryParams.get(StoredValue.DATE_FROM);
    const dateToMillis = queryParams.get(StoredValue.DATE_TO);
    if (this.session.state.groupEventsFilter && dateFromMillis) {
      const fromMillis = Number(dateFromMillis);
      if (!Number.isNaN(fromMillis)) {
        this.session.state.groupEventsFilter.fromDate = this.dateUtils.asDateValue(fromMillis);
      }
    }
    if (this.session.state.groupEventsFilter && dateToMillis) {
      const toMillis = Number(dateToMillis);
      if (!Number.isNaN(toMillis)) {
        this.session.state.groupEventsFilter.toDate = this.dateUtils.asDateValue(toMillis);
      }
    }
    const storedCompositionRoute = !!queryParams.get(StoredValue.DRAFT_ID) || !!queryParams.get(StoredValue.COPY_OF);
    if (!storedCompositionRoute && this.session.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE && this.session.state.groupEventsFilter) {
      this.events.selectedDateRangePreset = this.events.matchPresetToCurrentRange();
      void this.events.populateGroupEvents();
    }
    this.recipients.applyForcedMemberSelection();
    this.applyInboxReplyHandoffIfAny(queryParams);
    this.applyVideoMeetingInviteHandoffIfAny();
  }

  private applyInboxReplyHandoffIfAny(queryParams: ParamMap): void {
    const reply = this.inboxReplyHandoff.consume();
    if (reply) {
      this.applyInboxReply(reply);
    } else {
      void this.rebuildInboxReplyFromRoute(queryParams);
    }
  }

  private applyVideoMeetingInviteHandoffIfAny(): void {
    const invite = this.videoMeetingInviteHandoff.consume();
    if (invite) {
      this.session.state.subject = invite.subject;
      this.session.state.introMarkdown = invite.body;
      if (invite.selectedListId != null) {
        this.session.state.recipientMode = RecipientMode.ENTIRE_LIST;
        this.session.state.selectedListId = invite.selectedListId;
        this.session.state.sendingChannel = SendingChannel.CAMPAIGN;
      }
      if (invite.externalRecipients?.length) {
        this.session.state.externalRecipients = invite.externalRecipients.map(recipient => ({
          email: recipient.email,
          name: recipient.name
        }));
        if (invite.selectedListId == null) {
          this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
          this.session.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
        }
      }
      if (invite.attachments?.length) {
        const existingUrls = new Set((this.session.state.attachments ?? []).map(attachment => attachment.url));
        const additions = invite.attachments.filter(attachment => !existingUrls.has(attachment.url));
        this.session.state.attachments = [...(this.session.state.attachments ?? []), ...additions];
      }
    }
  }

  private async rebuildInboxReplyFromRoute(queryParams: ParamMap): Promise<void> {
    const slug = queryParams.get(StoredValue.THREAD);
    if (slug && !this.session.inboxReplyContext) {
      this.inboxReplyLoading = true;
      try {
        const threadMessages = await this.inboxService.getThread(slug);
        const threadId = inboxThreadId(threadMessages.thread);
        if (threadId) {
          const forward = queryParams.get(StoredValue.FORWARD) === "true";
          const replyAll = queryParams.get(StoredValue.REPLY_ALL) === "true";
          const messages = threadMessages.messages ?? [];
          const messageId = queryParams.get(StoredValue.MESSAGE);
          const target = inboxMessageMatchingId(messages, messageId) ?? newestInboxMessage(messages);
          if (target) {
            const reply = await this.inboxService.composeReply(threadId, {
              threadId,
              messageId: target.messageId,
              forward
            });
            if (replyAll) {
              const aliases = await this.inboxService.listAliases();
              reply.cc = replyAllRecipients(reply, target, aliases.flatMap(alias => aliasMailboxAddresses(alias)));
              reply.replyAll = true;
            }
            this.applyInboxReply({...reply, forward}, true);
          } else {
            this.logger.error("No messages on thread", slug, "so no reply to rebuild");
          }
        } else {
          this.logger.error("No thread matching slug", slug, "so no reply to rebuild");
        }
      } catch (error) {
        this.logger.error("Failed to rebuild inbox reply for thread", slug, error);
      } finally {
        this.inboxReplyLoading = false;
      }
    }
  }

  private applyInboxReply(reply: InboxReplyComposeResponse, rebuiltFromRoute: boolean = false): void {
    this.logger.info(rebuiltFromRoute ? "Inbox reply rebuilt from thread in URL:" : "Inbox reply handoff consumed:", JSON.stringify({
      to: reply.to,
      subject: reply.subject,
      senderRoleType: reply.senderRoleType,
      threadId: reply.threadId,
      inboxMessageId: reply.inboxMessageId,
      forward: reply.forward
    }));
    if (this.session.state.brandingMode !== BrandingMode.UNBRANDED) {
      this.setBrandingMode(BrandingMode.UNBRANDED);
    }
    this.session.state.recipientMode = RecipientMode.SELECTED_MEMBERS;
    this.session.state.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
    this.session.state.addresseeType = AddresseeType.NONE;
    if (reply.forward) {
      this.recipients.replyCcSuggestion = [];
      this.applyForwardedAttachments(reply.attachments ?? []);
    } else {
      if (reply.to) {
        const recipient = {email: reply.to.email, name: reply.to.name ?? undefined, saveForReuse: false};
        const alreadyPresent = this.session.state.externalRecipients.some(existing => existing.email.toLowerCase() === reply.to.email.toLowerCase());
        if (!alreadyPresent) {
          this.session.state.externalRecipients = [recipient, ...this.session.state.externalRecipients];
        }
      }
      const replyCc = (reply.cc ?? []).map(address => ({
        email: address.email,
        name: address.name ?? undefined,
        saveForReuse: false
      }));
      if (reply.replyAll) {
        const existingCc = new Set(this.session.state.ccRecipients.map(existing => existing.email.toLowerCase()));
        this.session.state.ccRecipients = [...this.session.state.ccRecipients, ...replyCc.filter(address => !existingCc.has(address.email.toLowerCase()))];
        this.recipients.replyCcSuggestion = [];
      } else {
        this.recipients.replyCcSuggestion = replyCc;
      }
    }
    this.session.state.subject = reply.subject;
    if (reply.senderRoleType) {
      this.session.state.unbrandedSenderRoleType = reply.senderRoleType;
      this.session.state.unbrandedSenderEmail = reply.senderRoleEmail ?? null;
    }
    const placeholder = "\n\n";
    const existingBody = this.session.state.introMarkdown ?? "";
    const quotedMarkdown = this.htmlToReplyMarkdown(reply.quotedHtml);
    const alreadyHasQuote = !!this.session.inboxReplyContext && this.session.inboxReplyContext.inboxMessageId === reply.inboxMessageId;
    if (!alreadyHasQuote) {
      const keepExistingBody = !rebuiltFromRoute && existingBody.length > 0;
      this.session.state.introMarkdown = keepExistingBody ? existingBody : placeholder + quotedMarkdown;
    }
    this.session.inboxReplyContext = {
      threadId: reply.threadId,
      aliasId: reply.aliasId,
      senderRoleType: reply.senderRoleType,
      mailboxConnectionId: reply.mailboxConnectionId,
      inboxMessageId: reply.inboxMessageId,
      inReplyTo: reply.inReplyTo,
      references: reply.references
    };
    this.session.state.inboxReplyContext = this.session.inboxReplyContext;
    this.logger.info("Inbox reply applied:", JSON.stringify({
      ...this.session.inboxReplyContext,
      externalRecipients: this.session.state.externalRecipients
    }));
    if (this.introEditorRef) {
      this.introEditorRef.syncValue(this.session.state.introMarkdown ?? "");
      queueMicrotask(() => this.introEditorRef?.focusAtStart());
    } else {
      this.pendingIntroFocus = true;
    }
  }

  private applyForwardedAttachments(attachments: InboxAttachment[]): void {
    const unsupported = attachments.filter(attachment => !this.attachmentExtensionSupported(attachment.filename));
    if (unsupported.length) {
      this.session.notify.warning({
        title: "Attachments",
        message: `${unsupported.map(attachment => attachment.filename).join(", ")} can't be forwarded by email — the mail platform doesn't support ${unsupported.map(attachment => attachment.filename.split(".").pop()).join(", ")} files.`
      });
    }
    const existingUrls = new Set((this.session.state.attachments ?? []).map(attachment => attachment.url));
    const forwarded = attachments
      .filter(attachment => this.attachmentExtensionSupported(attachment.filename))
      .map(attachment => ({
        name: attachment.filename,
        url: `${stripTrailingSlash(this.urlService.publicBaseUrl())}/${this.urlService.resourceRelativePathForAWSFileName(attachment.s3Key)}`,
        sizeBytes: attachment.sizeBytes
      }))
      .filter(attachment => !existingUrls.has(attachment.url));
    this.session.state.attachments = [...(this.session.state.attachments ?? []), ...forwarded];
  }

  private attachmentExtensionSupported(fileName: string): boolean {
    return BREVO_SUPPORTED_ATTACHMENT_EXTENSIONS.includes(fileName.split(".").pop()?.toLowerCase() ?? "");
  }

  private htmlToReplyMarkdown(html: string | null | undefined): string {
    if (!html) {
      return "";
    } else {
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
  }

  private htmlContentForReplyMarkdown(html: string): string {
    const container = document.createElement("div");
    container.innerHTML = html;
    this.removeReplyMarkdownNonContent(container);
    return container.innerHTML;
  }

  private removeReplyMarkdownNonContent(container: HTMLElement): void {
    container.querySelectorAll("style, script, title, meta, link, head").forEach(element => element.remove());
    container.querySelectorAll<HTMLElement>("[style]").forEach(element => {
      if (HIDDEN_STYLE_PATTERN.test(element.getAttribute("style") ?? "")) {
        element.remove();
      }
    });
    container.querySelectorAll("img").forEach(image => {
      if (this.trackingPixel(image)) {
        image.remove();
      }
    });
  }

  private trackingPixel(image: HTMLImageElement): boolean {
    const dimensions = [image.getAttribute("width"), image.getAttribute("height")]
      .map(dimension => Number.parseInt(dimension ?? "", 10))
      .filter(dimension => Number.isFinite(dimension));
    return dimensions.length > 0 && dimensions.every(dimension => dimension <= TRACKING_PIXEL_MAX_DIMENSION);
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
    if (this.priorSendExclusions.length === 0) {
      return "";
    } else {
      const sortedDates = this.priorSendExclusions.map(entry => entry.sentAt).sort((a, b) => a - b);
      const earliest = this.dateUtils.displayDate(sortedDates[0]);
      const latest = this.dateUtils.displayDate(sortedDates[sortedDates.length - 1]);
      return earliest === latest ? ` on ${earliest}` : ` between ${earliest} and ${latest}`;
    }
  }

  priorSendDateLabel(sentAt: number): string {
    return this.dateUtils.displayDate(sentAt);
  }

  onEventsDividerChange(style: SectionDividerStyle): void {
    this.session.state.eventsDividerAfter = style;
  }

  onBetweenEventsDividerChange(style: SectionDividerStyle): void {
    this.session.state.betweenEventsDivider = style;
  }

  protected templateContentHtml: string | null = null;
  protected templateContentFetching = false;
  protected templateContentError: string | null = null;
  private lastTemplateContentTemplateName: string | null = null;

  protected eventsPreviewSummary(): string {
    if (this.session.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE) {
      const count = this.events.selectedGroupEventCount();
      return count > 0 ? this.stringUtils.pluraliseWithCount(count, "event") : "No events selected";
    } else {
      if (this.session.state.eventInclusion === EventInclusionMode.SINGLE_EVENT) {
        return this.session.state.singleEvent?.groupEvent?.title ?? "Single event (none loaded)";
      } else {
        return "No events";
      }
    }
  }

  protected findArticleBlock(id: string): ArticleBlock | null {
    return (this.session.state.articleBlocks ?? []).find(block => block.id === id) ?? null;
  }

  protected onSingleArticleBlockChange(updated: ArticleBlock): void {
    this.session.state.articleBlocks = (this.session.state.articleBlocks ?? []).map(b => b.id === updated.id ? updated : b);
    }

  onEmailConfigChanged(config: NotificationConfig): void {
    if (config?.id && config.id === this.session.state.notificationConfig?.id) {
      return;
    } else {
      this.userPickedEmailType = true;
      this.applyNotificationConfig(config);
    }
  }

  private applyNotificationConfig(config: NotificationConfig): void {
    const previousConfigSubject = this.session.state.notificationConfig?.subject?.text ?? "";
    const sameConfig = !!config?.id && config.id === this.session.state.notificationConfig?.id;
    if (!sameConfig) {
      this.workflowArrivalConfigId = null;
      this.onPriorSendExclusionsChange([]);
    }
    const preservedBanner = sameConfig ? (this.session.state.bannerId ?? this.session.state.notificationConfig?.bannerId) : null;
    const userTypedCustomSubject = !!this.session.state.subject?.trim() && this.session.state.subject !== previousConfigSubject;
    this.session.state.notificationConfig = config ? cloneDeep(config) : null;
    this.postSendActionWarningDismissed = false;
    this.session.state.bannerId = preservedBanner ?? this.session.state.notificationConfig?.bannerId ?? null;
    if (this.session.state.notificationConfig) {
      this.session.state.notificationConfig.bannerId = this.session.state.bannerId;
    }
    if (this.eventsStepOmitted() && this.session.state.eventInclusion !== EventInclusionMode.NONE) {
      this.events.setEventInclusionMode(EventInclusionMode.NONE);
    }
    if (!userTypedCustomSubject) {
      this.session.state.subject = this.session.state.notificationConfig?.subject?.text ?? "";
    }
    this.session.state.signoffRoles = this.validSignoffRolesFor(this.session.state.notificationConfig?.signOffRoles ?? []);
    this.recipients.applyRecipientDefaultsFrom(this.session.state.notificationConfig);
    this.session.syncStateToUrl({
      [StoredValue.CONFIG_ID]: this.configToSlug(this.session.state.notificationConfig),
      [StoredValue.LIST_ID]: this.session.state.recipientMode === RecipientMode.ENTIRE_LIST ? this.session.state.selectedListId?.toString() ?? null : null,
      [StoredValue.PRE_FILTER]: this.session.state.recipientMode === RecipientMode.SELECTED_MEMBERS ? this.session.state.preFilterKey ?? null : null,
      [StoredValue.EMAIL_TYPE]: kebabCase(this.session.state.recipientMode)
    });
    this.refreshTemplateContent();
    this.fragmentEditor.ensureFragmentOrder(this.session.state);
    this.maybeAutoRefreshPreview();
    if (!sameConfig) {
      this.recipients.syncedNotificationBccKey = null;
    }
    this.recipients.syncNotificationConfigBccIntoBcc();
  }

  protected composerRoleDefaultsHelp(): string {
    if (this.session.state.notificationConfig?.composerRoleDefaults === ComposerRoleDefaults.CURRENT_USER) {
      return "Sender and sign-off start from your committee role. Reply-To starts blank so replies go to the From address unless you set one.";
    } else if (this.session.state.notificationConfig?.composerRoleDefaults === ComposerRoleDefaults.SELECT_AT_SEND) {
      return "Choose the sender from any mapped committee member, then choose Reply-To and sign-off roles for this email.";
    } else {
      return "Reply-To and Sign-off start from Mail Settings. Click Select All As Me if you want sign-off to use your roles instead.";
    }
  }

  protected forcedMemberLabel(): string {
    const member = this.recipientSources.members?.find(item => item.id === this.recipients.forcedMemberId);
    if (!member) {
      return "the selected member";
    } else {
      const name = this.memberFullName(member);
      return member.email && this.mayViewMemberAddresses() ? `${name} (${member.email})` : name;
    }
  }

  protected mayViewMemberAddresses(): boolean {
    return !this.salesforceEnabled || this.sender.loggedInMemberRecord?.canViewMemberData === true;
  }

  private memberFullName(member: Member): string {
    const fullName = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
    return fullName || member.displayName?.trim() || "the selected member";
  }

  protected memberSendBlockReason(member: Member): string | null {
    if (!member) {
      return null;
    } else {
      if (this.recipientSources.respectsBlocks()) {
        if (member.emailBlock) {
          return "is blocked from email";
        } else {
          const referenceListId = this.recipientSources.unsubscribeReferenceListId();
          const unsubscribed = isNumber(referenceListId)
            ? isNumber(this.mailListUpdaterService.listUnsubscribedAt(member, referenceListId))
            : isNumber(this.mailListUpdaterService.fullyUnsubscribedAt(member));
          if (unsubscribed) {
            return "has unsubscribed from email";
          } else {
          }
        }
      }
      if (this.recipientSources.requiresConsent() && member.emailMarketingConsent === false) {
        return "has not given Head Office marketing consent";
      } else {
        return null;
      }
    }
  }

  private unavailableSelectedMembers() {
    return this.recipientSources.workflowRemovesRecipients() ? [] : this.blockedSelectedMembers();
  }

  protected unavailableRecipientReasons(): Record<string, string> {
    return this.unavailableSelectedMembers().reduce((reasons, entry) => ({...reasons, [(entry.member.email ?? "").toLowerCase()]: entry.reason}), {});
  }

  private blockedSelectedMembers(): {
    member: Member;
    reason: string;
  }[] {
    const committeeEmails = new Set(this.recipients.committeeCcEmails());
    return this.recipientResolution.uniqueSendEntries()
      .filter(entry => {
        const email = (entry.external?.email || entry.member?.email || "").toLowerCase();
        return !committeeEmails.has(email);
      })
      .map(entry => entry.member)
      .filter((member): member is Member => !!member)
      .map(member => ({member, reason: this.memberSendBlockReason(member)}))
      .filter((entry): entry is {
        member: Member;
        reason: string;
      } => !!entry.reason);
  }

  protected clearForcedMember(): void {
    this.recipients.forcedMemberId = null;
    this.session.syncStateToUrl({[StoredValue.MEMBER]: null});
  }

  protected postSendActionWarningVisible(): boolean {
    return (this.recipientSources.bulkDeletionPending() || this.recipientSources.memberDisablePending()) && !this.postSendActionWarningDismissed;
  }

  protected dismissPostSendActionWarning(): void {
    this.postSendActionWarningDismissed = true;
  }

  protected bulkDeletionMemberCount(): number {
    if (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST && this.session.state.selectedListId !== null) {
      return this.recipientSources.members
        .filter(this.memberService.filterFor.GROUP_MEMBERS)
        .filter(member => this.mailListUpdaterService.memberSubscribed(member, this.session.state.selectedListId!))
        .length;
    } else {
      return this.session.state.selectedMemberIds?.length ?? 0;
    }
  }

  protected showRecipientSourceRadios(): boolean {
    return !this.recipients.forcedMemberId && !this.session.state.notificationConfig;
  }

  protected async refreshTemplateContent(): Promise<void> {
    const templateName = this.session.state.notificationConfig?.templateName;
    if (!templateName) {
      this.templateContentHtml = null;
      this.templateContentError = null;
      this.lastTemplateContentTemplateName = null;
      this.applyTemplateContentFragmentPresence();
    } else {
      if (this.lastTemplateContentTemplateName === templateName && this.templateContentHtml) {
        this.applyTemplateContentFragmentPresence();
      } else {
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
    }
  }

  private templateHasTopBottomPlaceholders(): boolean {
    if (!this.templateContentHtml) {
      return false;
    } else {
      return this.templateContentHtml.includes("BODY_CONTENT_TOP") || this.templateContentHtml.includes("BODY_CONTENT_BOTTOM");
    }
  }

  private applyTemplateContentFragmentPresence(): void {
    if (this.templateHasTopBottomPlaceholders() || !!this.session.state.notificationConfig?.body) {
      this.ensureTemplateContentFragment();
    } else {
      this.removeTemplateContentFragment();
    }
  }

  private ensureTemplateContentFragment(): void {
    const order = this.session.state.fragmentOrder ?? [];
    if (!(order.some(f => f.kind === ComposerFragmentKind.TEMPLATE_CONTENT))) {
      const introIdx = order.findIndex(f => f.kind === ComposerFragmentKind.INTRO);
      const insertAt = introIdx >= 0 ? introIdx + 1 : 0;
      const newFragment: ComposerFragment = {
        kind: ComposerFragmentKind.TEMPLATE_CONTENT,
        id: "template-content",
        dividerAfter: SectionDividerStyle.NONE
      };
      this.session.state.fragmentOrder = [...order.slice(0, insertAt), newFragment, ...order.slice(insertAt)];
    }
  }

  private removeTemplateContentFragment(): void {
    if (!(!this.session.state.fragmentOrder)) {
      this.session.state.fragmentOrder = this.session.state.fragmentOrder.filter(f => f.kind !== ComposerFragmentKind.TEMPLATE_CONTENT);
    }
  }

  protected onSignoffRolesChanged(): void {
    this.session.state.signoffRoles = this.validSignoffRolesFor(this.session.state.signoffRoles ?? []);
  }

  private validSignoffRolesFor(roles: string[]): string[] {
    const committeeRoles = this.recipientSources.committeeReferenceData?.committeeMembers() ?? [];
    return roles.filter(role => {
      const member = committeeRoles.find((candidate: any) => candidate.type === role);
      if (!member) {
        return false;
      } else {
        const fullNameText = (member.fullName ?? "").toLowerCase();
        const nameAndDescriptionText = (member.nameAndDescription ?? "").toLowerCase();
        const vacantByText = fullNameText.includes("vacant") || nameAndDescriptionText.includes("vacant");
        return !member.vacant && !vacantByText;
      }
    });
  }

  private configToSlug(config: NotificationConfig | null): string | null {
    if (!config) {
      return null;
    } else {
      const text = config.subject?.text || config.id;
      return text ? this.stringUtils.kebabCase(text) : null;
    }
  }

  private resolveConfigIdFromSlug(slug: string | null): string | null {
    let resolved: string | null = null;
    if (slug) {
      const configs = this.recipientSources.mailMessagingConfig?.notificationConfigs ?? [];
      const matched = configs.find(config => this.configToSlug(config) === slug || config.id === slug);
      if (matched) {
        resolved = matched.id ?? null;
      } else if (/^[a-f0-9]{24}$/i.test(slug)) {
        resolved = slug;
      }
    }
    return resolved;
  }

  bannerImageSource(): string {
    if (!this.session.state.notificationConfig) {
      return "";
    } else {
      return this.mailMessagingService.bannerImageSource(this.session.state.notificationConfig, true);
    }
  }

  recipientCountSummary(includeChannel = true): string {
    const toHasExtraPeople = (this.session.state.externalRecipients ?? []).some(recipient => !recipient.listId);
    if (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST && !this.recipientResolution.unbrandedListExpanded() && !toHasExtraPeople) {
      const list = this.recipientSources.availableLists().find(item => item.id === this.session.state.selectedListId);
      const campaign = includeChannel && this.recipientResolution.sendingAsCampaign();
      if (!list) {
        return "no list chosen";
      } else if (campaign) {
        return `${this.recipientSources.listNameAndCount(list)} (campaign)`;
      } else {
        return this.recipientSources.listNameAndCount(list);
      }
    } else {
      const people = this.recipientResolution.uniqueEntriesFrom(this.session.state.externalRecipients ?? []).length;
      const ccCount = this.recipientResolution.uniqueEntriesFrom(this.session.state.ccRecipients ?? []).length;
      const bccCount = this.recipientResolution.uniqueEntriesFrom(this.session.state.bccRecipients ?? []).length;
      const peopleSummary = this.stringUtils.pluraliseWithCount(people, "member");
      const extra: string[] = [];
      if (ccCount > 0)
        extra.push(`${ccCount} cc`);
      if (bccCount > 0)
        extra.push(`${bccCount} bcc`);
      if (extra.length === 0) {
        return peopleSummary;
      } else if (people === 0) {
        return extra.join(" + ");
      } else {
        return `${peopleSummary} + ${extra.join(" + ")}`;
      }
    }
  }

  protected campaignQueueNotice(): CampaignOverflowNotice | null {
    if (this.session.state.recipientMode !== RecipientMode.ENTIRE_LIST || this.session.state.brandingMode === BrandingMode.UNBRANDED) {
      return null;
    } else {
      return campaignOverflowNotice(this.recipientResolution.totalRecipientCount(), this.recipientSources.mailMessagingConfig?.brevo?.account, this.campaignAutomaticReleaseEnabled());
    }
  }

  private campaignAutomaticReleaseEnabled(): boolean | null {
    return this.automaticCampaignReleaseTaskEnabled;
  }

  private async loadCampaignReleaseTaskState(): Promise<void> {
    try {
      const task = (await this.scheduledTaskService.tasks()).find(item => item.id === ScheduledTaskId.BREVO_CAMPAIGN_RELEASE);
      this.automaticCampaignReleaseTaskEnabled = task?.enabled ?? null;
    } catch (error) {
      this.logger.error("loadCampaignReleaseTaskState failed:", error);
      this.automaticCampaignReleaseTaskEnabled = null;
    }
  }

  estimatedSendTime(): string {
    const count = this.session.state.brandingMode === BrandingMode.UNBRANDED
      ? 1
      : this.session.state.selectedMemberIds.length
      + (this.session.state.externalRecipients?.length ?? 0)
      + (this.session.state.ccRecipients?.length ?? 0)
      + (this.session.state.bccRecipients?.length ?? 0);
    if (count === 0) {
      return "0s";
    } else {
      const seconds = Math.max(1, Math.ceil(count * 0.4));
      if (seconds < 60) {
        return `${seconds}s`;
      } else {
        const minutes = Math.ceil(seconds / 60);
        return `${minutes} min`;
      }
    }
  }

  sendingChannelLabel(): string {
    if (this.session.state.sendingChannel === SendingChannel.CAMPAIGN || this.recipientResolution.sendingAsCampaign()) {
      return "to the whole list";
    } else if (this.contentIsPersonalised() || this.recipientAddressesArePrivate()) {
      return "to each member individually";
    } else if (this.visibleToRecipientCount() > 1) {
      return "one email, with everyone on To";
    } else if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
      return this.sharedToCommitteeSend()
        ? "one email to the committee, with everyone on To"
        : "one email using To, Cc and Bcc";
    } else if (this.sharedToCommitteeSend()) {
      return "one email to the committee, with everyone on To";
    } else {
      return "to each member individually";
    }
  }

  recipientsStepErrors(): string[] {
    const errors: string[] = [];
    if (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST) {
      if (this.recipientSources.nonEmptyLists().length === 0) {
        errors.push("No mailing lists configured - set them up in Mail Settings before sending to a whole list");
      } else if (this.session.state.selectedListId == null
        || !this.recipientSources.nonEmptyLists().some(list => list.id === this.session.state.selectedListId)) {
        errors.push("Choose which mailing list to send to");
      }
    } else {
      const headerCount = (this.session.state.externalRecipients?.length ?? 0)
        + (this.session.state.ccRecipients?.length ?? 0)
        + (this.session.state.bccRecipients?.length ?? 0);
      if (this.session.state.selectedMemberIds.length === 0 && headerCount === 0) {
        errors.push("Select at least one member");
      }
      const blockedMembers = this.unavailableSelectedMembers();
      errors.push(...blockedMembers.map(entry => `${this.memberFullName(entry.member)} ${entry.reason} and cannot be emailed — remove this member from the recipients to continue`));
    }
    return errors;
  }

  recipientsStepValid(): boolean {
    return this.recipientsStepErrors().length === 0;
  }

  recipientsStepValidationMessage(): string {
    return this.recipientsStepErrors().join("; ");
  }

  private committeeRolesReady(): boolean {
    return !!this.recipientSources.committeeReferenceData;
  }

  protected unbrandedSenderCheckReady(): boolean {
    return !!this.recipientSources.committeeReferenceData && !!this.recipientSources.mailMessagingConfig;
  }

  templateStepErrors(): ValidationError[] {
    const errors: ValidationError[] = [];
    if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
      if (this.unbrandedSenderCheckReady() && !this.sender.unbrandedSenderInfo().email) {
        errors.push("You are not linked to a committee role with a valid email on this site. Emails are sent from a committee role address, so a site administrator needs to map your member record to a committee role before you can send.");
      }
    } else if (!this.session.state.notificationConfig) {
      errors.push("Choose an email type");
    } else if (!this.committeeRolesReady()) {
      return errors;
    } else {
      if (!this.session.state.notificationConfig.templateName)
        errors.push(this.errorWithMailSettingsLink("This email type has no template configured - choose another or set one up in ", "Mail Settings"));
      if (this.sender.brandedSenderIdentities().length === 0) {
        errors.push("You need a committee role address before you can send.");
      }
      if (!this.senderExists)
        errors.push(this.errorWithMailSettingsLink("The sender address is not registered in Brevo - configure it in ", "Mail Settings"));
      if (!this.session.state.notificationConfig.senderRole)
        errors.push("Sender is missing from the email type configuration");
      const committeeRoles = this.recipientSources.committeeReferenceData?.committeeMembers() ?? [];
      const roleExists = (role: string | undefined) => !!role && committeeRoles.some((member: any) => member.type === role);
      const roleHasEmail = (role: string | undefined) => !!role && committeeRoles.some((member: any) => member.type === role && !!member.email);
      const roleDescription = (role: string | undefined) => {
        const match = committeeRoles.find((member: any) => member.type === role);
        return match?.description || role || "";
      };
      const senderLabel = roleDescription(this.session.state.notificationConfig.senderRole);
      const replyToLabel = roleDescription(this.session.state.notificationConfig.replyToRole);
      if (this.session.state.notificationConfig.senderRole && !roleExists(this.session.state.notificationConfig.senderRole)) {
        errors.push(this.errorWithMailSettingsLink(`Sender role "${senderLabel}" is not a committee member - pick a different role below, or assign someone to it in `, "Mail Settings"));
      } else if (this.session.state.notificationConfig.senderRole && !roleHasEmail(this.session.state.notificationConfig.senderRole)) {
        errors.push(this.errorWithMailSettingsLink(`Sender role "${senderLabel}" has no email address - pick a different role below, or set an email for it in `, "Mail Settings"));
      }
      if (this.session.state.notificationConfig.replyToRole && !roleExists(this.session.state.notificationConfig.replyToRole)) {
        errors.push(this.errorWithMailSettingsLink(`Reply-to role "${replyToLabel}" is not a committee member - pick a different role below, or assign someone to it in `, "Mail Settings"));
      } else if (this.session.state.notificationConfig.replyToRole && !roleHasEmail(this.session.state.notificationConfig.replyToRole)) {
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
    const params: Record<string, string> = {[StoredValue.TAB]: "email-configurations"};
    const config = this.session.state.notificationConfig;
    if (config) {
      const text = config.subject?.text || config.id;
      if (text)
        params[StoredValue.CONFIGURATION] = this.stringUtils.kebabCase(text);
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
    if (!this.session.state.notificationConfig) {
      return [];
    } else {
      const committeeRoles = this.recipientSources.committeeReferenceData?.committeeMembers() ?? [];
      const roleExists = (role: string) => committeeRoles.some((member: any) => member.type === role);
      return (this.session.state.notificationConfig.signOffRoles ?? []).filter(role => !roleExists(role));
    }
  }

  matchedSignOffRoles(): string[] {
    if (!this.session.state.notificationConfig) {
      return [];
    } else {
      const committeeRoles = this.recipientSources.committeeReferenceData?.committeeMembers() ?? [];
      const roleExists = (role: string) => committeeRoles.some((member: any) => member.type === role);
      return (this.session.state.notificationConfig.signOffRoles ?? []).filter(role => roleExists(role));
    }
  }

  templateStepValid(): boolean {
    const errorsEmpty = this.templateStepErrors().length === 0;
    let valid = errorsEmpty;
    if (this.session.state.brandingMode === BrandingMode.UNBRANDED) {
      if (this.sender.unbrandedSenderInfo().email) {
        valid = errorsEmpty;
      } else if (!this.unbrandedSenderCheckReady()) {
        valid = false;
      } else {
        valid = errorsEmpty;
      }
    } else if (this.session.state.brandingMode === BrandingMode.BRANDED && this.session.state.notificationConfig && !this.committeeRolesReady()) {
      valid = false;
    }
    return valid;
  }

  templateStepValidationMessage(): string {
    let message = this.templateStepErrors().join("; ");
    if (this.session.state.brandingMode === BrandingMode.UNBRANDED && !this.sender.unbrandedSenderInfo().email && !this.unbrandedSenderCheckReady()) {
      message = "Loading committee roles…";
    } else if (this.session.state.brandingMode === BrandingMode.BRANDED && this.session.state.notificationConfig && !this.committeeRolesReady()) {
      message = "Loading committee roles…";
    }
    return message;
  }

  composeStepErrors(): string[] {
    const errors: string[] = [];
    if (!this.session.state.subject?.trim()) {
      errors.push("Subject line is required");
    } else if (this.subjectStartsWithCopyOf()) {
      errors.push("Change the copied subject before continuing");
    } else if (this.subjectUnchangedFromDefault()) {
      errors.push("Change the automatic subject before continuing");
    }
    return errors;
  }

  eventsStepErrors(): string[] {
    const errors: string[] = [];
    if (this.session.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE && this.events.selectedGroupEventCount() === 0) {
      errors.push("Either select at least one event or choose 'No events'");
    }
    return errors;
  }

  protected composeStepOmitted(): boolean {
    return !!this.session.state.notificationConfig?.omitComposeStep;
  }

  protected eventsStepOmitted(): boolean {
    return this.session.eventsStepOmitted();
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
    if (!this.composeStepValid())
      parts.push(this.composeStepValidationMessage());
    if (!this.recipientsStepValid())
      parts.push(this.recipientsStepValidationMessage());
    if (!this.templateStepValid())
      parts.push(this.templateStepValidationMessage());
    return parts.filter(p => p).join("; ");
  }

  protected canGoToFollowingStep(): boolean {
    const visible = this.visibleStepperSteps();
    const idx = visible.findIndex(step => step.key === this.stepperActiveTab);
    const following = idx >= 0 ? visible[idx + 1] : null;
    return !!following && this.canAccessStep(following.key);
  }

  recycledTrackingUrlsInState(): string[] {
    const sources = [this.session.state.introMarkdown, this.session.state.signoffTextMarkdown];
    (this.session.state.articleBlocks ?? []).forEach(block => {
      sources.push(block.markdown);
      sources.push(block.buttonUrl);
    });
    const found = new Set<string>();
    sources.forEach(source => findRecycledTrackingUrls(source).forEach(url => found.add(url)));
    return Array.from(found);
  }

  private autoResolveTrackingInProgress = false;

  protected async autoResolveTrackingUrls(): Promise<void> {
    if (!(this.autoResolveTrackingInProgress)) {
      const trackingUrls = this.recycledTrackingUrlsInState();
      if (trackingUrls.length === 0) {
      } else {
        this.autoResolveTrackingInProgress = true;
        try {
          const results = await Promise.all(trackingUrls.map(async (url) => {
            try {
              return await this.sendService.resolveTrackingUrl(url);
            } catch (error: any) {
              return {originalUrl: url, resolvedUrl: null, error: error?.message ?? String(error)} as const;
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
          this.session.state.introMarkdown = this.rewriteTrackingUrls(this.session.state.introMarkdown, replacements, failedUrls);
          this.session.state.signoffTextMarkdown = this.rewriteTrackingUrls(this.session.state.signoffTextMarkdown, replacements, failedUrls);
          (this.session.state.articleBlocks ?? []).forEach(block => {
            block.markdown = this.rewriteTrackingUrls(block.markdown, replacements, failedUrls);
            block.buttonUrl = this.rewriteTrackingUrls(block.buttonUrl, replacements, failedUrls);
          });
        } finally {
          this.autoResolveTrackingInProgress = false;
        }
      }
    }
  }

  private rewriteTrackingUrls(content: string | null | undefined, replacements: Map<string, string>, failedUrls: string[]): string {
    if (!content) {
      return content ?? "";
    } else {
      let next = content;
      for (const [from, to] of replacements) {
        next = next.split(from).join(to);
      }
      for (const url of failedUrls) {
        next = this.stripTrackingLink(next, url);
      }
      return next;
    }
  }

  private stripTrackingLink(content: string, url: string): string {
    if (!content || !url) {
      return content;
    } else {
      const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const markdownLink = new RegExp(`\\[([^\\]]+)\\]\\(${escaped}\\)`, "g");
      let next = content.replace(markdownLink, "$1");
      const htmlLink = new RegExp(`<a\\b[^>]*href=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/a>`, "gi");
      next = next.replace(htmlLink, "$1");
      next = next.split(url).join("");
      return next;
    }
  }

  canAccessStep(stepKey: EmailComposerStepKey): boolean {
    if (stepKey === EmailComposerStepKey.EVENTS && this.eventsStepOmitted()) {
      return false;
    } else {
      if (stepKey === EmailComposerStepKey.COMPOSE && this.composeStepOmitted()) {
        return false;
      } else {
        if (stepKey === EmailComposerStepKey.TEMPLATE) {
          return true;
        } else {
          if (stepKey === EmailComposerStepKey.RECIPIENTS) {
            return this.templateStepValid();
          } else {
            const isUnbranded = this.session.state.brandingMode === BrandingMode.UNBRANDED;
            if (stepKey === EmailComposerStepKey.COMPOSE) {
              return this.templateStepValid() && (isUnbranded || this.recipientsStepValid());
            } else {
              if (stepKey === EmailComposerStepKey.EVENTS) {
                return this.templateStepValid() && this.recipientsStepValid() && this.composeStepValid();
              } else {
                if (stepKey === EmailComposerStepKey.REVIEW) {
                  return this.templateStepValid() && this.recipientsStepValid() && this.composeStepValid();
                } else {
                  if (stepKey === EmailComposerStepKey.SEND) {
                    return this.templateStepValid() && this.recipientsStepValid() && this.composeStepValid();
                  } else {
                    return false;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  protected currentStepTitle(): string {
    return this.visibleStepperSteps().find(step => step.key === this.stepperActiveTab)?.label
      ?? EMAIL_COMPOSER_STEPS.find(step => step.key === this.stepperActiveTab)?.label
      ?? "";
  }

  protected visibleStepperSteps(): typeof EMAIL_COMPOSER_STEPS {
    return EMAIL_COMPOSER_STEPS.filter(step => {
      if (step.key === EmailComposerStepKey.EVENTS && this.eventsStepOmitted()) {
        return false;
      } else {
        if (step.key === EmailComposerStepKey.COMPOSE && this.composeStepOmitted()) {
          return false;
        } else {
          return true;
        }
      }
    });
  }

  protected isStepVisible(key: EmailComposerStepKey): boolean {
    return this.visibleStepperSteps().some(step => step.key === key);
  }

  protected goToStepKey(key: EmailComposerStepKey, focusComposeBody = true): void {
    if (!(this.sendInProgress)) {
      if (this.canAccessStep(key)) {
        this.setActiveStepperTab(key);
        if (key === EmailComposerStepKey.COMPOSE || key === EmailComposerStepKey.REVIEW) {
          this.autoResolveTrackingUrls().catch(error => this.logger.warn("auto-resolve tracking urls failed", error));
        }
        if (key === EmailComposerStepKey.COMPOSE && focusComposeBody) {
          this.focusComposeEditor();
        }
        if (key === EmailComposerStepKey.REVIEW) {
          this.refreshPreview().catch(error => this.logger.error("preview refresh failed", error));
        }
      }
    }
  }

  private focusComposeEditor(): void {
    const introFragment = (this.session.state.fragmentOrder ?? []).find(fragment => fragment.kind === ComposerFragmentKind.INTRO);
    if (!(!introFragment)) {
      this.fragmentEditor.expandedFragmentIds.add(introFragment.id);
      if (this.introEditorRef) {
        queueMicrotask(() => this.introEditorRef?.focusAtStart());
      } else {
        this.pendingIntroFocus = true;
      }
    }
  }

  protected emptyWorkflowNextConfig(): NotificationConfig | null {
    const config = this.session.state.notificationConfig;
    const next = this.configById(config?.nextNotificationConfigId);
    const state = this.session.state;
    return this.stepperActiveTab === EmailComposerStepKey.RECIPIENTS
      && state.brandingMode === BrandingMode.BRANDED
      && state.recipientMode === RecipientMode.SELECTED_MEMBERS
      && !!config?.defaultMemberSelection && state.preFilterKey === config.defaultMemberSelection
      && state.selectedMemberIds.length === 0
      && [state.externalRecipients, state.ccRecipients, state.bccRecipients].every(recipients => !recipients?.length)
      && next?.id !== config.id ? next : null;
  }

  protected goNext(): void {
    const nextConfig = this.emptyWorkflowNextConfig();
    if (nextConfig) {
      void this.continueToNextConfig(nextConfig);
    } else {
      const visible = this.visibleStepperSteps();
      const idx = visible.findIndex(step => step.key === this.stepperActiveTab);
      if (!(idx === -1 || idx >= visible.length - 1)) {
        this.goToStepKey(visible[idx + 1].key);
      }
    }
  }

  protected goPrev(): void {
    const visible = this.visibleStepperSteps();
    const idx = visible.findIndex(step => step.key === this.stepperActiveTab);
    if (!(idx <= 0)) {
      this.goToStepKey(visible[idx - 1].key);
    }
  }

  onStepperValueChange(value: unknown): void {
    const key = value as EmailComposerStepKey;
    if (key && this.canAccessStep(key)) {
      const scrollY = window.scrollY;
      this.setActiveStepperTab(key);
      if (key === EmailComposerStepKey.COMPOSE) {
        this.focusComposeEditor();
      }
      if (key === EmailComposerStepKey.REVIEW) {
        this.refreshPreview().catch(error => this.logger.error("preview refresh failed", error));
      }
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
      });
    } else if (key) {
      this.stepperRef?.value.set(this.stepperActiveTab as unknown as number);
    }
  }

  private setActiveStepperTab(key: EmailComposerStepKey, queryParams: Record<string, string | null | undefined> = {}): void {
    this.stepperActiveTab = key;
    this.session.syncStateToUrl({...queryParams, [StoredValue.TAB]: key});
  }

  stepHint(key: EmailComposerStepKey): string {
    const fallback = EMAIL_COMPOSER_STEPS.find(step => step.key === key)?.hint ?? "";
    switch (key) {
      case EmailComposerStepKey.RECIPIENTS: {
        if (this.session.state.brandingMode !== BrandingMode.UNBRANDED && this.session.state.recipientMode === RecipientMode.ENTIRE_LIST) {
          const list = this.recipientSources.availableLists().find(item => item.id === this.session.state.selectedListId);
          return list ? this.recipientSources.listNameAndCount(list) : fallback;
        } else {
          const total = this.recipientResolution.totalRecipientCount();
          return total > 0 ? this.recipientCountSummary() : fallback;
        }
      }
      case EmailComposerStepKey.TEMPLATE: {
        return this.session.state.notificationConfig?.subject?.text || fallback;
      }
      case EmailComposerStepKey.COMPOSE: {
        const subject = this.session.state.subject?.trim();
        if (!subject) {
          return fallback;
        } else {
          return subject.length > 50 ? `${subject.slice(0, 50)}…` : subject;
        }
      }
      default:
        return fallback;
    }
  }

  exitComposer(): void {
    if (!(!this.confirmLeaveComposer("Exit composer"))) {
      this.leaveComposer();
    }
  }

  private confirmLeaveComposer(action: string): boolean {
    if (this.shouldWarnAboutUnsavedChanges() && !this.cancelArmed) {
      this.cancelArmed = true;
      this.session.notify.warning({
        title: "Discard email content?",
        message: `You have unsent email content. Click ${action} again to discard and leave.`
      });
      return false;
    } else {
      return true;
    }
  }

  private leaveComposer(): void {
    if (this.session.inboxReplyContext) {
      this.navigateToInbox();
    } else {
      this.location.back();
    }
  }

  private navigateToInbox(): void {
    const maximised = this.route.snapshot.queryParamMap.get(StoredValue.MAXIMISE) === "true";
    const thread = this.route.snapshot.queryParamMap.get(StoredValue.THREAD);
    this.router.navigate(["/" + AdminPath.INBOX], {
      queryParams: {
        ...(thread ? {[StoredValue.THREAD]: thread} : {}),
        ...(maximised ? {[StoredValue.MAXIMISE]: "true"} : {})
      },
      replaceUrl: true
    });
  }

  protected cancelArmed: boolean = false;
  protected sendConfirm = new Confirm();

  private hasUnsavedChanges(): boolean {
    return !!this.session.state.subject?.trim()
      || !!this.session.state.introMarkdown?.trim()
      || !!this.session.state.signoffTextMarkdown?.trim()
      || (this.session.state.articleBlocks ?? []).length > 0
      || (this.session.state.selectedMemberIds ?? []).length > 0
      || (this.session.state.externalRecipients ?? []).length > 0
      || (this.session.state.ccRecipients ?? []).length > 0
      || (this.session.state.bccRecipients ?? []).length > 0
      || !!this.session.state.selectedListId;
  }

  private shouldWarnAboutUnsavedChanges(): boolean {
    return !this.sendSuccessfullyCompleted() && this.userHasEditedComposer && this.hasUnsavedChanges();
  }

  private sendSuccessfullyCompleted(): boolean {
    return this.campaignSendComplete || this.batchProgress?.status === BatchSendStatus.COMPLETED;
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

  protected async openSavedComposition(id: string): Promise<void> {
    if (this.draftsPanelOpen) {
      await this.loadDraft(id);
    } else {
      await this.useAsTemplate(id);
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

  protected compositionOwnerName(composition: EmailCompositionSummary): string | null {
    const owner = this.recipientSources.members?.find(m => m.id === composition.ownerMemberId);
    if (!owner) {
      return null;
    } else {
      const name = `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim();
      return name || null;
    }
  }

  protected async useAsTemplate(id: string): Promise<void> {
    try {
      const sent = await this.compositionsService.load(id);
      if (!(!sent)) {
        const restored: any = JSON.parse(JSON.stringify(sent.state));
        const selectedGroupEventIds = this.applyRestoredStateDefaults(restored);
        this.session.state = restored as EmailComposerState;
        this.session.state.inboxReplyContext = null;
        this.session.inboxReplyContext = null;
        if (this.session.state.subject)
          this.session.state.subject = `Copy of ${this.session.state.subject}`;
        this.session.currentDraftId = null;
        this.lastSavedAt = null;
        this.currentComposition = null;
        this.composeShared = false;
        this.sentEmailsPanelOpen = false;
        this.routeCompositionKey = `copy-of:${id}`;
        this.userPickedEmailType = !!this.session.state.notificationConfig?.id;
        this.session.syncStateToUrl({[StoredValue.DRAFT_ID]: null, [StoredValue.COPY_OF]: id});
        await this.rehydrateAfterLoad(selectedGroupEventIds);
        this.session.notify.success({title: "Loaded as template", message: "Edit and save as a new draft"});
      }
    } catch (error) {
      this.logger.error("useAsTemplate failed:", error);
      this.session.notify.error({title: "Use as template failed", message: String(error)});
    }
  }

  protected async onSharedToggled(value: boolean): Promise<void> {
    this.composeShared = value;
    if (this.session.currentDraftId) {
      try {
        this.recipients.syncSelectedMembersToHeaders();
        const updated = await this.compositionsService.save(this.session.state, this.session.currentDraftId, this.composeShared);
        this.lastSavedAt = updated.savedAt;
        await this.refreshDrafts();
      } catch (error) {
        this.logger.error("onSharedToggled save failed:", error);
        this.session.notify.error({title: "Sharing change failed", message: String(error)});
      }
    }
  }

  protected async saveDraft(): Promise<void> {
    if (!(!this.hasUnsavedChanges())) {
      try {
        this.recipients.syncSelectedMembersToHeaders();
        const draft = await this.compositionsService.save(this.session.state, this.session.currentDraftId, this.composeShared);
        this.session.currentDraftId = draft.id;
        this.lastSavedAt = draft.savedAt;
        this.currentComposition = draft;
        this.userHasEditedComposer = false;
        this.routeCompositionKey = `draft:${draft.id}`;
        this.session.syncStateToUrl({[StoredValue.DRAFT_ID]: draft.id, [StoredValue.COPY_OF]: null});
        await this.refreshDrafts();
        this.session.notify.success({title: "Draft saved", message: draft.title});
      } catch (error) {
        this.logger.error("saveDraft failed:", error);
        this.session.notify.error({title: "Save draft failed", message: String(error)});
      }
    }
  }

  protected async revertToSavedDraft(): Promise<void> {
    if (!(!this.session.currentDraftId)) {
      await this.loadDraft(this.session.currentDraftId);
    }
  }

  protected async loadDraft(id: string): Promise<void> {
    try {
      const draft = await this.compositionsService.load(id);
      if (!(!draft)) {
        const restored: any = JSON.parse(JSON.stringify(draft.state));
        const selectedGroupEventIds = this.applyRestoredStateDefaults(restored);
        this.session.state = restored as EmailComposerState;
        this.session.inboxReplyContext = this.session.state.inboxReplyContext ?? null;
        this.session.currentDraftId = draft.id;
        this.lastSavedAt = draft.savedAt;
        this.currentComposition = draft;
        this.userHasEditedComposer = false;
        this.composeShared = draft.shared;
        this.draftsPanelOpen = false;
        this.routeCompositionKey = `draft:${draft.id}`;
        this.userPickedEmailType = !!this.session.state.notificationConfig?.id;
        await this.rehydrateAfterLoad(selectedGroupEventIds);
        this.session.syncStateToUrl({
          [StoredValue.DRAFT_ID]: draft.id,
          [StoredValue.COPY_OF]: null,
          [StoredValue.CONFIG_ID]: this.configToSlug(this.session.state.notificationConfig)
        });
        this.session.notify.success({title: "Draft loaded", message: draft.title});
      }
    } catch (error) {
      this.logger.error("loadDraft failed:", error);
      this.session.notify.error({title: "Load draft failed", message: String(error)});
    }
  }

  private restoredMediaIndexById: Record<string, number> = {};

  private restoredDateValue(stored: {
    value?: number;
  } | null | undefined): DateValue | null {
    return isNumber(stored?.value) ? this.dateUtils.asDateValue(stored!.value) : null;
  }

  private applyRestoredStateDefaults(restored: any): string[] {
    const selectedGroupEventIds: string[] = restored.selectedGroupEventIds ?? [];
    this.restoredMediaIndexById = restored.groupEventMediaIndexById ?? {};
    delete restored.selectedGroupEventIds;
    delete restored.groupEventMediaIndexById;
    restored.groupEvents = [];
    restored.notificationConfigListing = this.session.state.notificationConfigListing
      ? {
        ...this.session.state.notificationConfigListing,
        forceIncludeConfigIds: [
          ...(this.session.state.notificationConfigListing.forceIncludeConfigIds ?? []),
          restored.notificationConfig?.id
        ].filter((id): id is string => !!id)
      }
      : this.session.state.notificationConfigListing;
    restored.brandingMode = restored.brandingMode ?? BrandingMode.BRANDED;
    restored.showTitle = restored.showTitle ?? true;
    restored.unbrandedSenderRoleType = restored.unbrandedSenderRoleType ?? null;
    restored.unbrandedSenderEmail = restored.unbrandedSenderEmail ?? null;
    restored.brandedSenderEmail = restored.brandedSenderEmail ?? null;
    restored.recipientAddressMode = restored.recipientAddressMode === RecipientAddressMode.COMMITTEE_ROLE
      ? RecipientAddressMode.COMMITTEE_ROLE
      : RecipientAddressMode.PERSONAL;
    this.recipients.recipientAddressModeTouched = true;
    restored.externalRecipients = restored.externalRecipients ?? [];
    restored.ccRecipients = restored.ccRecipients ?? [];
    restored.bccRecipients = restored.bccRecipients ?? [];
    restored.selectedMemberIds = restored.selectedMemberIds ?? [];
    restored.signoffRoles = restored.signoffRoles ?? [];
    restored.attachments = restored.attachments ?? [];
    restored.fragmentOrder = restored.fragmentOrder ?? [];
    restored.inboxReplyContext = restored.inboxReplyContext ?? null;
    restored.articleBlocks = restored.articleBlocks ?? [];
    restored.compositionKind = restored.compositionKind ?? EmailCompositionKind.STANDARD;
    restored.newsletter = restored.compositionKind === EmailCompositionKind.NEWSLETTER
      ? {...defaultNewsletterSettings(), ...(restored.newsletter ?? {})}
      : null;
    restored.releaseNoteUpdate = restored.compositionKind === EmailCompositionKind.RELEASE_NOTE_UPDATE
      ? releaseNoteUpdateSettingsFrom(restored.releaseNoteUpdate)
      : restored.releaseNoteUpdate ?? defaultReleaseNoteUpdateSettings();
    if (restored.groupEventsFilter) {
      restored.groupEventsFilter.fromDate = this.restoredDateValue(restored.groupEventsFilter.fromDate);
      restored.groupEventsFilter.toDate = this.restoredDateValue(restored.groupEventsFilter.toDate);
    }
    if (restored.brandingMode === BrandingMode.UNBRANDED && restored.recipientMode === RecipientMode.ENTIRE_LIST) {
      restored.recipientMode = RecipientMode.SELECTED_MEMBERS;
      restored.sendingChannel = SendingChannel.TRANSACTIONAL_BATCH;
    }
    if (restored.recipientMode === RecipientMode.ENTIRE_LIST) {
      restored.preFilterKey = null;
    }
    if (restored.selectedListId === undefined) {
      restored.selectedListId = null;
    }
    if (restored.narrowListId === undefined) {
      restored.narrowListId = null;
    }
    return selectedGroupEventIds;
  }

  private async rehydrateAfterLoad(selectedGroupEventIds: string[]): Promise<void> {
    await this.mailMessagingService.refreshNotificationConfigs();
    if (!this.session.state.notificationConfigListing) {
      this.session.state.notificationConfigListing = {
        mailMessagingConfig: this.recipientSources.mailMessagingConfig,
        includeWorkflowRelatedConfigs: false,
        forceIncludeConfigIds: this.forcedIncludeConfigIds()
      };
    } else {
      this.session.state.notificationConfigListing = {
        ...this.session.state.notificationConfigListing,
        mailMessagingConfig: this.session.state.notificationConfigListing.mailMessagingConfig ?? this.recipientSources.mailMessagingConfig,
        forceIncludeConfigIds: this.forcedIncludeConfigIds()
      };
    }
    const storedConfigId = (this.session.state.notificationConfig as any)?.id;
    const storedBannerId = this.session.state.bannerId;
    if (storedConfigId) {
      const liveConfig = this.configById(storedConfigId)
        ?? this.mailMessagingService.notificationConfigs(this.session.state.notificationConfigListing)
          .find(config => config.id === storedConfigId);
      if (liveConfig) {
        this.session.state.notificationConfig = cloneDeep(liveConfig);
        this.session.state.notificationConfig.bannerId = storedBannerId ?? this.session.state.notificationConfig.bannerId ?? null;
        this.session.state.bannerId = this.session.state.notificationConfig.bannerId;
      }
    }
    if (!this.session.state.notificationConfig && this.session.state.brandingMode !== BrandingMode.UNBRANDED) {
      this.autoSelectNotificationConfig();
    }
    this.recipients.syncSelectedMembersToHeaders();
    this.session.state.externalRecipients = this.recipients.expandListChipsWhenMixedWithPeople(this.session.state.externalRecipients ?? []);
    this.recipients.syncNotificationConfigBccIntoBcc();
    if (this.session.state.eventInclusion === EventInclusionMode.AUTO_INCLUDE && this.session.state.groupEventsFilter) {
      await this.events.populateGroupEvents();
      const selectedSet = new Set(selectedGroupEventIds);
      this.session.state.groupEvents = this.session.state.groupEvents.map(event => {
        const restored = {...event, selected: event.id ? selectedSet.has(event.id) : false} as GroupEventSummary;
        const savedIndex = event.id ? this.restoredMediaIndexById[event.id] : undefined;
        if (isNumber(savedIndex)) {
          applyMediaSelection(restored, clampMediaIndex(restored, savedIndex));
        }
        return restored;
      });
    }
    if (this.session.state.eventInclusion === EventInclusionMode.SINGLE_EVENT) {
      const storedSingleId = (this.session.state.singleEvent as any)?.id;
      if (storedSingleId) {
        await this.events.loadSingleEvent(storedSingleId);
      }
    }
    if (this.releaseNoteUpdateMode() && this.session.state.releaseNoteUpdate?.fromMillis && this.session.state.releaseNoteUpdate?.toMillis) {
      this.updateSettings.applyReleaseNoteUpdateDates(this.session.state, this.session.currentDraftId, {
        fromMillis: this.session.state.releaseNoteUpdate.fromMillis,
        toMillis: this.session.state.releaseNoteUpdate.toMillis,
        continuesPreviousWindow: false
      });
    }
    const allIds = this.documents.allFragmentCommitteeFileIds();
    if (allIds.length > 0) {
      if (this.documents.allCommitteeFiles.length === 0) {
        await this.documents.loadAllCommitteeFiles();
      }
      await this.documents.resolveCommitteeFiles(allIds);
    }
    this.recipients.applyDefaultListIfNeeded();
    this.recipients.syncRecipientAddressMode();
    this.expandFragmentsWithContent();
  }

  private expandFragmentsWithContent(): void {
    this.fragmentEditor.ensureFragmentOrder(this.session.state);
    this.fragmentEditor.expandedFragmentIds = new Set(fragmentIdsWithContent(this.session.state));
  }

  protected async onCompositionsDeleted(ids: string[]): Promise<void> {
    if (this.session.currentDraftId && ids.includes(this.session.currentDraftId)) {
      this.session.currentDraftId = null;
      this.lastSavedAt = null;
      this.routeCompositionKey = null;
      this.session.syncStateToUrl({[StoredValue.DRAFT_ID]: null});
    }
    await this.refreshDrafts();
    }

  protected newComposition(): void {
    this.recipients.forcedMemberId = null;
    this.routeCompositionKey = null;
    this.unbrandedSenderAlertDismissed = false;
    this.session.state = defaultEmailComposerState();
    this.recipients.narrowMembersExpanded = true;
    this.recipients.recipientAddressModeTouched = false;
    this.userPickedEmailType = false;
    this.recipients.userPickedRecipientMode = false;
    if (this.recipientSources.mailMessagingConfig) {
      this.session.state.notificationConfigListing = {
        mailMessagingConfig: this.recipientSources.mailMessagingConfig,
        includeWorkflowRelatedConfigs: false,
        forceIncludeConfigIds: this.forcedConfigId ? [this.forcedConfigId] : []
      };
      this.autoSelectNotificationConfig();
    }
    const storedBranding = this.uiActions.initialValueFor(StoredValue.BRANDING, BrandingMode.BRANDED);
    if (storedBranding === BrandingMode.UNBRANDED) {
      this.setBrandingMode(BrandingMode.UNBRANDED, true);
    }
    this.session.currentDraftId = null;
    this.userHasEditedComposer = false;
    this.lastSavedAt = null;
    this.composeShared = false;
    this.draftsPanelOpen = false;
    this.setActiveStepperTab(EmailComposerStepKey.TEMPLATE, {
      [StoredValue.MEMBER]: null,
      [StoredValue.DRAFT_ID]: null,
      [StoredValue.COPY_OF]: null
    });
    this.batchProgress = null;
    this.campaignSendComplete = false;
    this.nextConfigAfterSend = null;
    this.documents.committeeFiles = new Map();
    this.documents.committeeFileUrlInput = "";
    this.documents.committeeFileUrlError = null;
    this.documents.committeeFileUrlAllowedIds = null;
    this.sendConfirm.clear();
    this.session.notify.hide();
  }

  protected lastSavedDescription(): string {
    if (!this.currentComposition) {
      return "";
    } else {
      const owner = this.recipientSources.members?.find(m => m.id === this.currentComposition!.ownerMemberId);
      const ownerName = owner ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() : null;
      const when = this.dateUtils.displayDateAndTime(this.currentComposition.savedAt);
      const verb = this.currentComposition.status === "sent" ? "Sent" : "Created";
      if (ownerName) {
        return `${this.currentComposition.title} ${verb} by ${ownerName} on ${when}`;
      } else {
        return `${this.currentComposition.title} ${verb} on ${when}`;
      }
    }
  }

  private autoPreviewAttempts = 0;

  private maybeAutoRefreshPreview(): void {
    if (!(!this.autoPreviewPending)) {
      if (this.stepperActiveTab !== EmailComposerStepKey.REVIEW) {
      } else {
        if (!this.session.state.notificationConfig?.templateName) {
        } else {
          this.autoPreviewPending = false;
          this.autoPreviewAttempts = 0;
          const tryRender = () => {
            if (this.emailPreview) {
              this.refreshPreview().catch(error => this.logger.error("auto preview refresh failed", error));
            } else {
              this.autoPreviewAttempts += 1;
              if (this.autoPreviewAttempts > 20) {
              } else {
                setTimeout(tryRender, 100);
              }
            }
          };
          setTimeout(tryRender, 100);
        }
      }
    }
  }

  protected previewRecipients(): Member[] {
    return this.previewEntries()
      .map(entry => entry.member)
      .filter((m): m is Member => !!m);
  }

  protected previewEntries(): {
    name: string;
    member?: Member;
    external?: ComposerExternalRecipient;
  }[] {
    return this.recipientResolution.uniqueSendEntries();
  }

  protected previewRecipientCount(): number {
    return this.previewEntries().length;
  }

  protected previewRecipientLabel(): string {
    const entries = this.previewEntries();
    const count = entries.length;
    if (count === 0) {
      return "No recipients";
    } else {
      const current = Math.min(this.previewRecipientIndex + 1, count);
      const entry = entries[this.previewRecipientIndex] ?? null;
      const name = entry?.name ?? "";
      return name ? `${current} of ${count} - ${name}` : `${current} of ${count}`;
    }
  }

  protected canStepPreview(direction: PreviewStepDirection): boolean {
    const count = this.previewRecipientCount();
    if (count <= 1) {
      return false;
    } else {
      if (direction === PreviewStepDirection.First || direction === PreviewStepDirection.Prev) {
        return this.previewRecipientIndex > 0;
      } else {
        return this.previewRecipientIndex < count - 1;
      }
    }
  }

  protected stepPreview(direction: PreviewStepDirection): void {
    const count = this.previewRecipientCount();
    if (!(count === 0)) {
      if (direction === PreviewStepDirection.First)
        this.previewRecipientIndex = 0;
      else if (direction === PreviewStepDirection.Last)
        this.previewRecipientIndex = count - 1;
      else if (direction === PreviewStepDirection.Prev)
        this.previewRecipientIndex = Math.max(0, this.previewRecipientIndex - 1);
      else
        this.previewRecipientIndex = Math.min(count - 1, this.previewRecipientIndex + 1);
      this.refreshPreview().catch(error => this.logger.error("preview step failed", error));
    }
  }

  async refreshPreview(): Promise<void> {
    const isUnbranded = this.session.state.brandingMode === BrandingMode.UNBRANDED;
    if (!isUnbranded && !this.session.state.notificationConfig?.templateName) {
      this.emailPreview?.showError("Choose a template to render the preview.");
    } else {
      try {
        await this.documents.resolveCommitteeFileLinksForSend();
      } catch (error) {
        this.logger.error("refreshPreview committee file link resolution failed", error);
        this.emailPreview?.showError(this.session.errorMessage(error), "Committee document can't be linked");
        return;
      }
      const {top, bottom, combined} = this.composedBodyParts();
      const entries = this.previewEntries();
      if (entries.length > 0 && this.previewRecipientIndex >= entries.length) {
        this.previewRecipientIndex = entries.length - 1;
      }
      const entry = entries[this.previewRecipientIndex] ?? null;
      const memberId = entry?.member?.id ?? this.memberLoginService.loggedInMember().memberId;
      const member = await this.memberService.getById(memberId);
      const params = this.mailMessagingService.createSendSmtpEmailParams(member, this.session.state.notificationConfig as NotificationConfig, combined, this.session.state.subject, "", top, bottom);
      if ((combined || "").includes("volunteerMergeFields")) {
        await this.ensureVolunteerSnapshot();
      }
      if (this.volunteerSnapshot) {
        params.volunteerMergeFields = volunteerMergeFieldsFor(memberId, this.volunteerSnapshot.assignments, this.volunteerSnapshot.parishes, this.recipientSources.allMembers, value => this.dateUtils.displayDate(value));
      }
      params.messageMergeFields.subject = isUnbranded ? this.session.state.subject : this.applySubjectAffixes(this.session.state.subject, params);
      const request: TemplateRenderRequest = isUnbranded
        ? {htmlContent: combined, params, brandingMode: BrandingMode.UNBRANDED}
        : {
          templateName: this.session.state.notificationConfig!.templateName,
          templateOverrides: this.session.state.notificationConfig!.templateOverrides,
          body: this.editableBodyForSend(),
          htmlContent: combined,
          params,
          showTitle: this.session.state.showTitle
        };
      await this.emailPreview.render(request);
    }
  }

  private editableBodyForSend(): string {
    return this.session.state.context?.source === EmailComposerContextSource.VOLUNTEER ? "" : this.session.state.notificationConfig!.body;
  }

  private addresseePlaceholder(): string {
    return ADDRESSEE_OPTIONS.find(option => option.key === this.session.state.addresseeType)?.placeholder ?? "";
  }

  private applySubjectAffixes(subject: string, params: SendSmtpEmailParams): string {
    const subjectConfig = this.session.state.notificationConfig?.subject;
    const resolve = (path: string | null | undefined): string | null => {
      if (!path) {
        return null;
      } else {
        const value = path.split(".").reduce<any>((acc, key) => acc?.[key], params);
        return isString(value) && value ? value : null;
      }
    };
    const prefix = resolve(subjectConfig?.prefixParameter);
    const suffix = resolve(subjectConfig?.suffixParameter);
    return [prefix, subject, suffix].filter(value => value).join(" - ");
  }

  private composedBodyParts(): {
    top: string;
    bottom: string;
    combined: string;
  } {
    this.fragmentEditor.ensureFragmentOrder(this.session.state);
    const fragments = this.session.state.fragmentOrder ?? [];
    const articleBlocksById = new Map((this.session.state.articleBlocks ?? []).map(block => [block.id, block]));
    const renderFragment = (fragment: ComposerFragment): string => {
      switch (fragment.kind) {
        case ComposerFragmentKind.INTRO:
          return this.rendering.markdownToHtml(this.session.state.introMarkdown);
        case ComposerFragmentKind.SIGNOFF: {
          const textHtml = this.rendering.markdownToHtml(this.session.state.signoffTextMarkdown);
          const renderableRoles = this.validSignoffRolesFor(this.session.state.signoffRoles ?? []);
          const namesHtml = renderableRoles.length > 0
            ? this.mailMessagingService.signoffNames(renderableRoles, this.notificationDirective)
            : "";
          return [textHtml, namesHtml].filter(s => s && s.trim()).join("\n");
        }
        case ComposerFragmentKind.EVENTS:
          return this.renderedEventsHtml();
        case ComposerFragmentKind.COMMITTEE_FILE:
          return this.renderedCommitteeFileHtmlForFragment(fragment);
        case ComposerFragmentKind.TEMPLATE_CONTENT:
          return "";
        case ComposerFragmentKind.DIVIDER:
          return dividerHtml(fragment.dividerAfter ?? SectionDividerStyle.THIN_ROSYCHEEKS);
        case ComposerFragmentKind.ARTICLE: {
          const block = articleBlocksById.get(fragment.id);
          if (!block) {
            return "";
          } else {
            return this.rendering.renderArticleBlocksAsList([block], block.position).join("");
          }
        }
        case ComposerFragmentKind.MULTI_COLUMN:
          return renderMultiColumn(fragment);
        default:
          return "";
      }
    };
    const renderColumn = (columnFragments: ComposerFragment[]): string => this.rendering.joinSectionsWithPerSectionDividers(columnFragments.map(f => ({
      content: renderFragment(f),
      dividerAfter: f.kind === ComposerFragmentKind.DIVIDER ? SectionDividerStyle.NONE : (f.dividerAfter ?? SectionDividerStyle.THIN_YELLOW)
    })));
    const renderMultiColumn = (fragment: ComposerFragment): string => {
      const columns = fragment.columns ?? [];
      if (columns.length === 0) {
        return "";
      } else {
        const widthPct = (100 / columns.length).toFixed(4);
        const gap = fragment.columnGapPx ?? DEFAULT_COLUMN_GAP_PX;
        const cells = columns.map(columnFragments => `<td valign="top" width="${widthPct}%" style="padding:0;vertical-align:top;">${renderColumn(columnFragments)}</td>`).join("");
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:${gap}px 0;table-layout:fixed;width:100%;"><tr>${cells}</tr></table>`;
      }
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
    return {top, bottom, combined};
  }

  private salutationHtml(): string {
    const placeholder = this.addresseePlaceholder();
    return placeholder ? `<p>${placeholder}</p>` : "";
  }

  sendDisabled(): boolean {
    return this.sendInProgress || !this.canAccessStep(EmailComposerStepKey.SEND);
  }

  sendDisabledReason(): string {
    if (this.sendInProgress) {
      return "Sending in progress";
    } else {
      if (this.unbrandedListSendBlocked()) {
        return `Unbranded sends to more than ${UNBRANDED_HARD_CAP_RECIPIENTS} recipients are blocked - switch to Branded mode or reduce the recipient count.`;
      } else {
        if (!this.recipientsStepValid()) {
          return this.recipientsStepValidationMessage();
        } else {
          if (!this.templateStepValid()) {
            return this.templateStepValidationMessage();
          } else {
            if (!this.composeStepValid()) {
              return this.composeStepValidationMessage();
            } else {
              return "";
            }
          }
        }
      }
    }
  }

  protected subjectStartsWithCopyOf(): boolean {
    return !!this.session.state.subject?.trim().toLowerCase().startsWith("copy of ");
  }

  protected subjectUnchangedFromDefault(): boolean {
    const subjectConfig = this.session.state.notificationConfig?.subject;
    if (!subjectConfig?.placeholder) {
      return false;
    } else {
      return subjectStillDefault(this.session.state.subject ?? "", subjectConfig.text ?? "", this.automaticGeneratedSubjects());
    }
  }

  protected hasSendBlockers(): boolean {
    return !this.composeStepValid() || this.unbrandedListSendBlocked() || !!this.sendRefusalMessage();
    }

  protected recipientAddressesArePrivate(): boolean {
    return !this.session.inboxReplyContext && composerRecipientAddressesArePrivate(this.recipientResolution.totalRecipientCount(), this.recipientResolution.committeeOnlyAudience());
  }

  private canShareRecipientAddressesOnTo(): boolean {
    return !this.contentIsPersonalised() && !this.recipientAddressesArePrivate() && this.visibleToRecipientCount() > 1;
  }

  protected sendRefusalMessage(): string | null {
    const useCampaign = this.recipientResolution.sendingAsCampaign();
    const decision = useCampaign ? this.sendStatus?.campaign : this.sendStatus?.transactional;
    return decision && !decision.allowed ? decision.message : null;
  }

  private async loadSendStatus(): Promise<void> {
    try {
      this.sendStatus = await this.mailService.sendStatus();
    } catch (error) {
      this.logger.error("failed to load send status", error);
      this.sendStatus = null;
    }
    this.changeDetector.markForCheck();
  }

  protected unbrandedListSendBlocked(): boolean {
    return this.session.state.brandingMode === BrandingMode.UNBRANDED
      && this.recipientResolution.totalRecipientCount() > UNBRANDED_HARD_CAP_RECIPIENTS;
  }

  protected unbrandedListSendSignals(): {
    pulledFromList: boolean;
    notAReply: boolean;
    longBody: boolean;
    promotionalLanguage: boolean;
  } {
    const pulledFromListRuleEnabled = false;
    const notAReplyRuleEnabled = false;
    const longBodyRuleEnabled = false;
    const pulledFromList = pulledFromListRuleEnabled && ((this.session.state.selectedMemberIds?.length ?? 0) > 0
      || !!this.session.state.preFilterKey
      || !!this.session.state.narrowListId);
    const subject = this.session.state.subject ?? "";
    const subjectIsAReplyOrForward = subject.trim().length > 0 && REPLY_OR_FORWARD_SUBJECT_PATTERN.test(subject);
    const bodyText = `${this.session.state.introMarkdown ?? ""}\n${this.session.state.signoffTextMarkdown ?? ""}`;
    const bodyIsLong = bodyText.length >= UNBRANDED_LONG_BODY_CHAR_THRESHOLD;
    const promotionalLanguage = PROMOTIONAL_LANGUAGE_PATTERN.test(bodyText);
    const notAReply = notAReplyRuleEnabled && !subjectIsAReplyOrForward;
    const longBody = longBodyRuleEnabled && bodyIsLong;
    return {pulledFromList, notAReply, longBody, promotionalLanguage};
  }

  protected unbrandedListSendWarningReasons(): string[] {
    const signals = this.unbrandedListSendSignals();
    const reasons: string[] = [];
    if (signals.notAReply) {
      reasons.push("Subject does not start with \"Re:\" or \"Fwd:\", so this is not a reply or forward");
    }
    if (signals.longBody) {
      reasons.push(`Body is ${this.unbrandedBodyTextLength()} characters - longer than the ${UNBRANDED_LONG_BODY_CHAR_THRESHOLD}-character threshold for a short reply`);
    }
    if (signals.promotionalLanguage) {
      reasons.push("Body contains marketing-style language (e.g. donate, fundraise, charity, appeal, sponsor, volunteer, register)");
    }
    return reasons;
  }

  private unbrandedBodyTextLength(): number {
    return (this.session.state.introMarkdown ?? "").length + 1 + (this.session.state.signoffTextMarkdown ?? "").length;
  }

  protected showUnbrandedListSendWarning(): boolean {
    if (this.recipientSources.mailMessagingConfig?.mailConfig?.showUnbrandedBroadcastWarning !== true) {
      return false;
    } else if (this.session.state.brandingMode !== BrandingMode.UNBRANDED) {
      return false;
    } else if (this.unbrandedListSendBlocked()) {
      return false;
    } else if (this.unbrandedListSendWarningDismissed) {
      return false;
    } else {
      const trimmedBody = (this.session.state.introMarkdown ?? "").trim();
      if (trimmedBody.length < 50) {
        return false;
      } else {
        const signals = this.unbrandedListSendSignals();
        const triggered = [signals.pulledFromList, signals.notAReply, signals.longBody, signals.promotionalLanguage].filter(Boolean).length;
        return triggered >= 2;
      }
    }
  }

  protected dismissUnbrandedListSendWarning(): void {
    this.unbrandedListSendWarningDismissed = true;
  }

  protected dismissUnbrandedSenderAlert(): void {
    this.unbrandedSenderAlertDismissed = true;
  }

  protected dismissRecipientsChosenAlert(): void {
    this.recipientsChosenAlertDismissed = true;
  }

  protected dismissRecipientAddressesPrivateAlert(): void {
    this.recipientAddressesPrivateAlertDismissed = true;
  }

  protected switchToBrandedFromWarning(): void {
    this.setBrandingMode(BrandingMode.BRANDED);
  }

  protected goToCompose(): void {
    this.sendConfirm.clear();
    this.pendingIntroFocus = false;
    this.pendingSubjectFocus = true;
    this.goToStepKey(EmailComposerStepKey.COMPOSE, false);
  }

  protected armSend(): void {
    if (!this.hasSendBlockers()) {
      this.sendConfirm.as(ConfirmType.SEND_NOTIFICATION);
    }
  }

  protected cancelSendConfirm(): void {
    this.sendConfirm.clear();
  }

  async confirmAndSend(): Promise<void> {
    if (this.hasSendBlockers()) {
      this.sendConfirm.clear();
    } else {
      if (!this.sendConfirm.notificationsOutstanding()) {
        this.armSend();
      } else {
        this.sendConfirm.clear();
        this.goToStepKey(EmailComposerStepKey.SEND);
        this.sendInProgress = true;
        try {
          this.session.state.brandedSenderEmail = this.sender.resolvedBrandedSenderEmail() || null;
          const useCampaign = this.recipientResolution.sendingAsCampaign();
          if (useCampaign) {
            await this.sendCampaign();
          } else {
            await this.startBatchTransactionalSend(this.sendMemberIds());
          }
        } catch (error) {
          this.logger.error("send failed", error);
          this.session.notify.error({title: "Send failed", message: this.session.errorMessage(error)});
          this.sendInProgress = false;
        }
      }
    }
  }

  private async sendCampaign(): Promise<void> {
    await this.loadCampaignReleaseTaskState();
    const groupMembers = await this.memberService.privilegedFields(this.memberService.filterFor.GROUP_MEMBERS);
    await this.mailListUpdaterService.updateMailLists(this.session.notify, groupMembers);
    const member = await this.memberService.getById(this.memberLoginService.loggedInMember().memberId);
    await this.documents.resolveCommitteeFileLinksForSend();
    const {top, bottom, combined} = this.composedBodyParts();
    const campaignTop = toCampaignContactTokens(top);
    const campaignBottom = toCampaignContactTokens(bottom);
    const campaignCombined = toCampaignContactTokens(combined);
    const overflowNotice = this.campaignQueueNotice();
    const params = this.mailMessagingService.createSendSmtpEmailParams(member, this.session.state.notificationConfig!, campaignCombined, this.session.state.subject, "", campaignTop, campaignBottom);
    const roleMembers = this.recipientResolution.useCommitteeRoleAddresses() ? this.recipients.campaignRoleAddressMembers() : [];
    const exclusionListId = await this.campaignExclusionListId(roleMembers.map(member => member.email).filter((email): email is string => !!email));
    const request: CreateCampaignRequest = {
      createAsDraft: false,
      templateName: this.session.state.notificationConfig!.templateName,
      templateOverrides: this.session.state.notificationConfig!.templateOverrides,
      body: this.editableBodyForSend(),
      showTitle: this.session.state.showTitle,
      htmlContent: campaignCombined,
      attachmentUrl: this.session.state.attachments?.[0]?.url,
      inlineImageActivation: false,
      mirrorActive: false,
      name: this.session.state.subject,
      tag: NGX_BREVO_CAMPAIGN_TAG,
      params,
      recipients: {
        listIds: [this.session.state.selectedListId!],
        ...(exclusionListId !== null ? {exclusionListIds: [exclusionListId]} : {})
      },
      replyTo: this.session.state.notificationConfig!.replyToRole?.trim()
        ? this.recipientSources.committeeReferenceData?.contactUsField(this.session.state.notificationConfig!.replyToRole, "email") || ""
        : "",
      sender: {
        email: this.sender.resolvedBrandedSenderIdentity()?.email
          || this.recipientSources.committeeReferenceData?.contactUsField(this.session.state.notificationConfig!.senderRole, "email")
          || "",
        name: this.sender.resolvedBrandedSenderIdentity()?.name
          || this.recipientSources.committeeReferenceData?.contactUsField(this.session.state.notificationConfig!.senderRole, "fullName")
          || ""
      },
      subject: this.session.state.subject
    };
    const created: StatusMappedResponseSingleInput = await this.mailService.createCampaign(request);
    const campaignId: number = created?.responseBody?.id;
    if (!created?.success || !isNumber(campaignId)) {
      throw new Error(`Brevo did not create the campaign${created?.message ? `: ${created.message}` : ""}`);
    }
    const sent: StatusMappedResponseSingleInput = await this.mailService.sendCampaign({campaignId});
    if (!sent?.success) {
      throw new Error(`Brevo did not accept campaign ${campaignId} for sending${sent?.message ? `: ${sent.message}` : ""}`);
    }
    const postSendSummary = await this.applyCampaignPostSendActions();
    const roleMemberIds = roleMembers.map(member => member.id).filter((id): id is string => !!id);
    if (roleMemberIds.length > 0) {
      await this.startBatchTransactionalSend(roleMemberIds);
    } else {
      this.campaignSendComplete = true;
      this.offerNextConfigAfterSend();
      this.sendInProgress = false;
      await this.recordSentToHistory();
      this.session.notify.hide();
      this.session.notify.success({
        title: "Campaign sent",
        message: (overflowNotice ? `Campaign submitted to Brevo. ${overflowNotice.title} ${overflowNotice.message}` : `successfully to ${this.recipientCountSummary(false)}`) + postSendSummary
      });
    }
  }

  private async applyCampaignPostSendActions(): Promise<string> {
    const postSendActions = this.session.state.notificationConfig?.postSendActions ?? [];
    if (postSendActions.length === 0 || this.session.state.selectedListId === null) {
      return "";
    } else {
      const listMemberIds = this.recipientSources.members
        .filter(this.memberService.filterFor.GROUP_MEMBERS)
        .filter(member => this.mailListUpdaterService.memberSubscribed(member, this.session.state.selectedListId!))
        .map(member => member.id)
        .filter((id): id is string => !!id);
      this.logger.info("applyCampaignPostSendActions: resolved", listMemberIds.length, "list members subscribed to list", this.session.state.selectedListId, "for post-send actions", postSendActions);
      if (listMemberIds.length === 0) {
        this.session.notify.warning({
          title: "Post-send actions",
          message: `The campaign was sent, but no members were found subscribed to the list for the configured post-send action - nothing was deleted or disabled.`
        });
        return "";
      } else {
        try {
          const result = await this.memberService.applyPostSendActions(listMemberIds, postSendActions);
          await this.refreshMembersAfterPostSendActions();
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
          this.session.notify.warning({
            title: "Post-send actions",
            message: `The campaign was sent, but applying post-send actions failed: ${this.session.errorMessage(error)}`
          });
          return "";
        }
      }
    }
  }

  private async recordSentToHistory(recipientCount?: number): Promise<void> {
    try {
      this.recipients.syncSelectedMembersToHeaders();
      const saved = await this.compositionsService.save(this.session.state, this.session.currentDraftId, this.composeShared);
      this.session.currentDraftId = saved.id;
      this.lastSavedAt = saved.savedAt;
      await this.compositionsService.markSent(saved.id, recipientCount);
    } catch (error) {
      this.logger.error("recordSentToHistory failed:", error);
    }
    if (this.session.state.brandingMode === BrandingMode.UNBRANDED && this.session.state.externalRecipients?.length) {
      void this.loadSavedExternalRecipients();
    }
  }

  private sendMemberIds(): string[] {
    if (this.session.state.recipientMode === RecipientMode.ENTIRE_LIST && this.session.state.selectedListId !== null && !this.recipientResolution.unbrandedListExpanded()) {
      return this.recipientSources.members
        .filter(member => this.mailListUpdaterService.memberSubscribed(member, this.session.state.selectedListId!) && !!member.id && !!(member.email || "").trim())
        .map(member => member.id as string);
    } else {
      return this.session.state.selectedMemberIds;
        }
  }

  private async startBatchTransactionalSend(memberIds: string[] = this.sendMemberIds()): Promise<void> {
    await this.documents.resolveCommitteeFileLinksForSend();
    const {top, bottom, combined} = this.composedBodyParts();
    const isUnbranded = this.session.state.brandingMode === BrandingMode.UNBRANDED;
    const unbrandedSender = this.sender.unbrandedSenderInfo();
    const brandedSender = this.sender.resolvedBrandedSenderIdentity();
    const senderEmail = isUnbranded ? unbrandedSender.email : brandedSender?.email;
    const senderName = isUnbranded ? unbrandedSender.name || unbrandedSender.description : brandedSender?.name;
    const expandedTo = this.recipientResolution.expandedHeaderRecipients(this.session.state.externalRecipients ?? []);
    const toRecipients = expandedTo.length > 0
      ? expandedTo
      : (senderEmail
        ? [{email: senderEmail, name: senderName, saveForReuse: false}]
        : []);
    const ccRecipients = this.recipientResolution.expandedHeaderRecipients(this.session.state.ccRecipients ?? []);
    const bccRecipients = this.recipientResolution.expandedHeaderRecipients(this.session.state.bccRecipients ?? []);
    const splitTo = batchSendRecipientSplit(toRecipients);
    const headerRouting = toRecipients.length > 0 || ccRecipients.length > 0 || bccRecipients.length > 0;
    const brandedMemberIds = splitTo.memberIds.length > 0
      ? splitTo.memberIds
      : (headerRouting ? [] : memberIds);
    const brandedExternal = splitTo.externalRecipients;
    const request: BatchTransactionalSendRequest = {
      notificationConfigId: isUnbranded ? undefined : this.session.state.notificationConfig!.id!,
      bannerId: isUnbranded ? null : this.session.state.bannerId,
      subject: this.session.state.subject,
      showTitle: this.session.state.showTitle,
      addresseeType: AddresseeType.NONE,
      signoffRoles: isUnbranded ? [] : this.session.state.signoffRoles,
      htmlBody: combined,
      htmlBodyTop: top,
      htmlBodyBottom: bottom,
      memberIds: isUnbranded ? [] : brandedMemberIds,
      narrowListId: this.session.state.narrowListId,
      externalRecipients: (isUnbranded ? toRecipients : brandedExternal).length
        ? (isUnbranded ? toRecipients : brandedExternal)
        : undefined,
      ccRecipients: ccRecipients.length ? ccRecipients : undefined,
      bccRecipients: bccRecipients.length ? bccRecipients : undefined,
      senderRoleOverride: isUnbranded ? undefined : this.session.state.notificationConfig!.senderRole,
      replyToRoleOverride: isUnbranded ? undefined : this.session.state.notificationConfig!.replyToRole,
      bccRolesOverride: isUnbranded ? [] : this.recipients.remainingNotificationBccRoleTypes(),
      brandingMode: this.session.state.brandingMode,
      unbrandedSenderRoleType: isUnbranded ? this.sender.resolvedUnbrandedRole()?.type : undefined,
      unbrandedSenderEmail: isUnbranded ? this.sender.resolvedUnbrandedSenderEmail() || undefined : undefined,
      senderEmailOverride: isUnbranded ? undefined : this.sender.resolvedBrandedSenderIdentity()?.email,
      senderNameOverride: isUnbranded ? undefined : this.sender.resolvedBrandedSenderIdentity()?.name,
      useCommitteeRoleAddresses: this.recipientResolution.useCommitteeRoleAddresses(),
      sharedToRecipients: this.canShareRecipientAddressesOnTo(),
      sharedMemberRecipientsAsBcc: isUnbranded
        && this.session.state.recipientMode === RecipientMode.ENTIRE_LIST
        && !this.recipientResolution.allSelectedMembersHoldCommitteeRoles(),
      inboxReplyContext: this.session.inboxReplyContext ?? undefined,
      attachments: this.session.state.attachments?.length ? this.session.state.attachments : undefined
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
            this.userHasEditedComposer = progress.status === BatchSendStatus.COMPLETED ? false : this.userHasEditedComposer;
            this.pollSubscription?.unsubscribe();
            this.pollSubscription = null;
            this.session.notify.hide();
            void this.recordSentToHistory(this.batchProgress?.totalRecipients);
            this.postSendRefresh = this.refreshMembersAfterPostSendActions();
            if (progress.status === BatchSendStatus.COMPLETED || progress.status === BatchSendStatus.COMPLETED_WITH_ERRORS) {
              this.offerNextConfigAfterSend();
            }
          }
        },
        error: error => {
          this.logger.error("batch poll failed", error);
          this.sendInProgress = false;
        }
      });
  }

  batchProgressPercent(): number {
    if (!this.batchProgress || this.batchProgress.totalRecipients === 0) {
      return 0;
    } else {
      return Math.round(this.batchProcessedCount() * 100 / this.batchProgress.totalRecipients);
    }
  }

  batchProcessedCount(): number {
    if (!this.batchProgress) {
      return 0;
    } else {
      return this.batchProgress.sentCount + this.batchProgress.failedCount + (this.batchProgress.skippedCount ?? 0);
    }
  }

  sendProgressDescription(): string {
    const oneEmail = this.session.state.brandingMode === BrandingMode.UNBRANDED
      || (this.session.state.externalRecipients?.length ?? 0) > 0
      || (this.session.state.ccRecipients?.length ?? 0) > 0
      || (this.session.state.bccRecipients?.length ?? 0) > 0;
    if (!this.batchProgress) {
      if (this.recipientResolution.sendingAsCampaign()) {
        return "Preparing campaign for Brevo…";
      } else if (oneEmail) {
        return "Preparing one email…";
      } else {
        return "Preparing personalised emails…";
      }
    } else if (oneEmail) {
      return `Sending one email to ${this.stringUtils.pluraliseWithCount(this.batchProgress.totalRecipients, "recipient")}`;
    } else {
      const currentEntry = this.batchProgress.entries.find(entry => entry.status === BatchSendEntryStatus.Pending);
      const currentNumber = Math.min(this.batchProcessedCount() + 1, this.batchProgress.totalRecipients);
      const recipient = currentEntry?.fullName || currentEntry?.email || "recipient";
      return `Sending ${currentNumber} of ${this.batchProgress.totalRecipients} - ${recipient}`;
    }
  }

  batchProgressBarClass(): string {
    if (this.batchProgress?.status === BatchSendStatus.FAILED) {
      return "bg-danger";
    } else {
      if (this.batchProgress?.status === BatchSendStatus.COMPLETED_WITH_ERRORS) {
        return "bg-warning";
      } else {
        return "bg-success";
      }
    }
  }

  batchSendComplete(): boolean {
    if (!this.batchProgress) {
      return false;
    } else {
      return [BatchSendStatus.COMPLETED, BatchSendStatus.COMPLETED_WITH_ERRORS, BatchSendStatus.FAILED, BatchSendStatus.CANCELLED].includes(this.batchProgress.status);
    }
  }

  sendComplete(): boolean {
    return this.campaignSendComplete || this.batchSendComplete();
  }

  closeAfterSend(): void {
    this.leaveComposer();
  }


}
