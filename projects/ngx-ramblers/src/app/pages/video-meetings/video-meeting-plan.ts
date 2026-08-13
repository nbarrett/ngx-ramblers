import { AfterViewInit, Component, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faCircleExclamation, faEnvelope, faPaperPlane, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { VideoMeetingInviteHandoffService } from "../../services/video-meetings/video-meeting-invite-handoff.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { WalkProgrammeCalendarComponent } from "../walks/walk-programme-calendar/walk-programme-calendar";
import { DraggableModalComponent } from "../../modules/common/draggable-modal/draggable-modal";
import { TimePicker } from "../../date-and-time/time-picker";
import { ListSubscriberCountComponent } from "../../modules/common/mail/list-subscriber-count";
import { MailMessagingService } from "../../services/mail/mail-messaging.service";
import { MemberService } from "../../services/member/member.service";
import { AiService } from "../../services/ai/ai.service";
import { CommitteeConfigService } from "../../services/committee/commitee-config.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { DocumentConversionService } from "../../services/committee/document-conversion.service";
import { ListInfo, MailMessagingConfig } from "../../models/mail.model";
import { Member } from "../../models/member.model";
import { CommitteeFile, CommitteeFileType, CommitteeMeetingType, CommitteeMember } from "../../models/committee.model";
import { NextCommitteeMeetingBannerComponent } from "./next-committee-meeting-banner";
import { ThumbnailHeadingFrameComponent } from "../../modules/common/thumbnail-heading-frame/thumbnail-heading-frame";
import { RecipientFieldComponent } from "../../modules/common/recipient-field/recipient-field";
import { ExternalRecipientService } from "../../services/external-recipient/external-recipient.service";
import { ExternalRecipient } from "../../models/external-recipient.model";
import {
  AddresseeType,
  BrandingMode,
  ComposerExternalRecipient,
  RecipientMode
} from "../../models/email-composer.model";
import { CommitteeDisplayService } from "../committee/committee-display.service";
import { Subscription } from "rxjs";
import {
  VideoMeetingInviteHandoff,
  VideoMeetingInviteRecipient,
  VideoMeetingPlanAction,
  VideoMeetingRuntimeConfig
} from "../../models/video-meeting.model";
import { StoredValue } from "../../models/ui-actions";
import { UiActionsService } from "../../services/ui-actions.service";
import { UIDateFormat } from "../../models/date-format.model";
import { EmailComposerSendService } from "../../services/email-composer/email-composer-send.service";
import { EmailComposerRenderingService } from "../../services/email-composer/email-composer-rendering.service";
import { MailListUpdaterService } from "../../services/mail/mail-list-updater.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { extractErrorMessage } from "../../functions/strings";
import { committeeMeetingAgendaMarkdown, numberedAgendaItemsFromGenerated } from "../../functions/committee-meeting-agenda";

@Component({
  selector: "app-video-meeting-plan",
  imports: [FormsModule, FontAwesomeModule, WalkProgrammeCalendarComponent, DraggableModalComponent, TimePicker, ListSubscriberCountComponent, NextCommitteeMeetingBannerComponent, ThumbnailHeadingFrameComponent, RecipientFieldComponent],
  styles: [`
    :host ::ng-deep .thumbnail-heading-frame-compact
      margin: 18px 0 6px 0
      padding: 8px 12px 6px 12px
    .invite-date
      margin-bottom: 0.25rem
    .meeting-details-row
      display: grid
      grid-template-columns: auto minmax(0, 1fr)
      grid-template-rows: auto auto
      column-gap: 1.25rem
      row-gap: 0.15rem
      align-items: start
    .meeting-details-label
      margin: 0
      line-height: 1.5
    .meeting-details-label-time
      grid-column: 1
      grid-row: 1
    .meeting-details-time
      grid-column: 1
      grid-row: 2
    .meeting-details-title-stack
      grid-column: 2
      grid-row: 2
      display: flex
      flex-direction: column
      row-gap: 0.15rem
      align-self: start
      padding-top: 4px
    .meeting-details-label-title
      line-height: 1.25
    .meeting-details-title
      min-height: var(--btn-min-height)
      height: var(--btn-min-height)
    .meeting-details-row ::ng-deep timepicker table
      margin: 0 !important
    .meeting-details-row ::ng-deep timepicker .btn,
    .meeting-details-row ::ng-deep timepicker button
      min-height: 0
      height: auto
      padding: 0.15rem 0.35rem
  `],
  template: `
    @if (sendNotice) {
      <div class="alert alert-success d-flex align-items-start">
        <fa-icon [icon]="faCircleCheck" class="me-2 mt-1"/>
        <div>
          <strong class="d-block">Invite sent</strong>
          {{ sendNotice }}
        </div>
      </div>
    }
    <app-next-committee-meeting-banner (plan)="planSuggestedMeeting($event)"/>
    <app-walk-programme-calendar [selectMode]="true" [includeCommitteeEvents]="true"
                                 (dateSelected)="onDateSelected($event)"/>

    <app-draggable-modal [open]="showInvite" [showCloseButton]="false" (closed)="cancel()">
      <span modalTitle>New meeting invite</span>
      <div modalBody>
        <p class="fw-bold invite-date">{{ selectedDateLabel }}</p>

        @if (meetingTypes.length) {
          <app-thumbnail-heading-frame heading="Meeting type" [compact]="true">
            @for (type of meetingTypes; track type.description) {
              <div class="form-check">
                <input class="form-check-input" type="radio" name="plan-type" [id]="'plan-type-' + type.description"
                       [checked]="meetingType === type.description" (change)="onMeetingTypeChange(type.description)">
                <label class="form-check-label" [for]="'plan-type-' + type.description">{{ type.description }}</label>
              </div>
            }
            @if (selectedAgendaFileType()) {
              <div class="form-check mt-1">
                <input class="form-check-input" type="checkbox" id="plan-generate-agenda"
                       [(ngModel)]="generateAgenda" [ngModelOptions]="{standalone: true}">
                <label class="form-check-label" for="plan-generate-agenda">Generate draft agenda</label>
              </div>
            }
          </app-thumbnail-heading-frame>
        }

        <app-thumbnail-heading-frame heading="Meeting details" [compact]="true">
          <div class="meeting-details-row">
            <label class="meeting-details-label meeting-details-label-time" for="plan-time">Time</label>
            <div class="meeting-details-time form-group mb-0" app-time-picker id="plan-time"
                 [value]="startDateTime" (change)="onTimeChange($event)"></div>
            <div class="meeting-details-title-stack">
              <label class="meeting-details-label meeting-details-label-title" for="plan-title">Meeting title</label>
              <input id="plan-title" class="form-control meeting-details-title" [(ngModel)]="title"
                     placeholder="e.g. Committee meeting">
            </div>
          </div>
        </app-thumbnail-heading-frame>

        <app-thumbnail-heading-frame heading="External recipients (optional)" [compact]="true">
          <app-recipient-field [to]="guestRecipientsField" (toChange)="guestRecipientsField = $event"
                               [savedRecipients]="previousRecipients" [plain]="true"/>
        </app-thumbnail-heading-frame>
        <app-thumbnail-heading-frame heading="Include a list (optional)" [compact]="true">
          <div class="form-check">
            <input class="form-check-input" type="radio" name="plan-list" id="plan-list-none"
                   [checked]="selectedListId === null" (change)="selectedListId = null">
            <label class="form-check-label" for="plan-list-none">No list</label>
          </div>
          @for (list of lists; track list.id) {
            <div class="form-check">
              <input class="form-check-input" type="radio" name="plan-list" [id]="'plan-list-' + list.id"
                     [checked]="selectedListId === list.id" (change)="selectedListId = list.id">
              <label class="form-check-label" [for]="'plan-list-' + list.id">
                {{ list.name }}
                <app-list-subscriber-count [list]="list" [members]="members"/>
              </label>
            </div>
          }
        </app-thumbnail-heading-frame>
        @if (sendError) {
          <div class="alert alert-danger d-flex align-items-start mt-3 mb-0">
            <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
            <div>
              <strong class="d-block">Invite not sent</strong>
              {{ sendError }}
            </div>
          </div>
        }
      </div>
      <button modalFooter type="button" class="btn btn-quiet btn-sm" [disabled]="working" (click)="cancel()">
        Close
      </button>
      <button modalFooter type="button" class="btn btn-quiet btn-sm" [disabled]="working" (click)="continueToComposer()">
        <fa-icon [icon]="composeWorking() ? faSpinner : faEnvelope" [animation]="composeWorking() ? 'spin' : null" class="me-2"/>
        {{ composeWorking() ? workingMessage : "Continue in email composer" }}
      </button>
      <button modalFooter type="button" class="btn btn-primary btn-sm" [disabled]="working || !canSendNow()"
              (click)="sendNow()">
        <fa-icon [icon]="sendWorking() ? faSpinner : faPaperPlane" [animation]="sendWorking() ? 'spin' : null" class="me-2"/>
        {{ sendWorking() ? workingMessage : "Send now" }}
      </button>
    </app-draggable-modal>`
})
export class VideoMeetingPlanComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild(WalkProgrammeCalendarComponent) calendar: WalkProgrammeCalendarComponent;

  private logger: Logger = inject(LoggerFactory).createLogger("VideoMeetingPlanComponent", NgxLoggerLevel.ERROR);
  private router = inject(Router);
  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  private videoMeetingsService = inject(VideoMeetingsService);
  private inviteHandoff = inject(VideoMeetingInviteHandoffService);
  private memberLoginService = inject(MemberLoginService);
  private mailMessagingService = inject(MailMessagingService);
  private memberService = inject(MemberService);
  private aiService = inject(AiService);
  private committeeConfigService = inject(CommitteeConfigService);
  private committeeFileService = inject(CommitteeFileService);
  private committeeDisplayService = inject(CommitteeDisplayService);
  private documentConversionService = inject(DocumentConversionService);
  private externalRecipientService = inject(ExternalRecipientService);
  private sendService = inject(EmailComposerSendService);
  private rendering = inject(EmailComposerRenderingService);
  private mailListUpdaterService = inject(MailListUpdaterService);
  private stringUtils = inject(StringUtilsService);
  private subscriptions: Subscription[] = [];

  showInvite = false;
  selectedDate: number;
  selectedDateLabel = "";
  startDateTime: string;
  title = "";
  guestRecipientsField: ComposerExternalRecipient[] = [];
  lists: ListInfo[] = [];
  selectedListId: number | null = null;
  members: Member[] = [];
  previousRecipients: ExternalRecipient[] = [];
  meetingTypes: CommitteeMeetingType[] = [];
  meetingType: string | null = null;
  generateAgenda = true;
  working = false;
  workingAction: VideoMeetingPlanAction | null = null;
  workingMessage = "Working…";
  sendNotice: string | null = null;
  sendError: string | null = null;

  private generatedTitle = "";
  private committeeRoles: CommitteeMember[] = [];
  private fileTypes: CommitteeFileType[] = [];
  private aiConnected = false;
  private pendingPlanDate: number | null = null;
  private config: VideoMeetingRuntimeConfig;

  protected readonly faEnvelope = faEnvelope;
  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faSpinner = faSpinner;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;

  async ngOnInit(): Promise<void> {
    const planDate = this.uiActions.queryParameter(StoredValue.PLAN_DATE);
    if (planDate) {
      this.pendingPlanDate = this.dateUtils.asValueNoTime(planDate);
    }
    this.applyMailLists(this.mailMessagingService.currentConfig());
    this.subscriptions.push(this.mailMessagingService.events().subscribe(config => {
      this.applyMailLists(config);
    }));
    this.subscriptions.push(this.committeeConfigService.committeeConfigEvents().subscribe(committeeConfig => {
      this.fileTypes = committeeConfig?.fileTypes ?? [];
      this.committeeRoles = committeeConfig?.roles ?? [];
      this.meetingTypes = committeeConfig?.meetingTypes ?? [];
      if (!this.meetingType && this.meetingTypes.length) {
        this.meetingType = this.defaultMeetingType();
        if (this.selectedDateLabel) {
          this.applySuggestedTitle();
        }
      }
    }));
    try {
      this.members = await this.memberService.privilegedFields(this.memberService.filterFor.GROUP_MEMBERS);
    } catch (error) {
      this.logger.error("failed to load members for list preview", error);
    }
    try {
      this.previousRecipients = await this.externalRecipientService.list();
    } catch (error) {
      this.logger.error("failed to load previous guest recipients", error);
    }
    try {
      this.config = await this.videoMeetingsService.config();
    } catch (error) {
      this.logger.error("failed to load video meeting config", error);
    }
    try {
      this.aiConnected = (await this.aiService.status())?.connected === true;
    } catch (error) {
      this.aiConnected = false;
    }
  }

  ngAfterViewInit(): void {
    if (this.pendingPlanDate) {
      this.planSuggestedMeeting(this.pendingPlanDate);
      this.pendingPlanDate = null;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onDateSelected(value: number): void {
    this.selectedDate = value;
    this.selectedDateLabel = this.dateUtils.asString(value, null, UIDateFormat.DISPLAY_DATE_NO_COMMA);
    this.startDateTime = this.dateUtils.isoDateTime(this.dateUtils.asDateTime(value).plus({hours: 19}).toMillis());
    this.title = this.suggestedTitle();
    this.generatedTitle = this.title;
    this.sendError = null;
    this.applyMailLists(this.mailMessagingService.currentConfig());
    void this.mailMessagingService.refreshBrevoLists();
    this.showInvite = true;
  }

  onTimeChange(isoDateTime: string): void {
    this.startDateTime = isoDateTime;
  }

  onMeetingTypeChange(meetingType: string): void {
    this.meetingType = meetingType;
    this.applySuggestedTitle();
  }

  selectedAgendaFileType(): string | null {
    return this.meetingTypes.find(type => type.description === this.meetingType)?.agendaFileType || null;
  }

  private defaultMeetingType(): string | null {
    return this.meetingTypes.find(type => /committee meeting/i.test(type.description))?.description
      || this.meetingTypes[0]?.description
      || null;
  }

  private meetingKind(): string {
    return this.meetingType || "Video meeting";
  }

  private suggestedTitle(): string {
    return this.selectedDateLabel ? `${this.meetingKind()}, ${this.selectedDateLabel}` : this.meetingKind();
  }

  private applySuggestedTitle(): void {
    const suggested = this.suggestedTitle();
    if (!this.title.trim() || this.title === this.generatedTitle) {
      this.title = suggested;
    }
    this.generatedTitle = suggested;
  }

  planSuggestedMeeting(dayValue: number): void {
    this.calendar?.showDate(dayValue);
  }

  cancel(): void {
    this.showInvite = false;
  }

  private guestRecipients(): VideoMeetingInviteRecipient[] {
    return this.guestRecipientsField.map(recipient => ({email: recipient.email, name: recipient.name}));
  }

  private applyMailLists(config: MailMessagingConfig): void {
    this.lists = config?.brevo?.lists?.lists ?? [];
  }

  canSendNow(): boolean {
    return this.sendRecipientCount() > 0;
  }

  composeWorking(): boolean {
    return this.working && this.workingAction === VideoMeetingPlanAction.COMPOSE;
  }

  sendWorking(): boolean {
    return this.working && this.workingAction === VideoMeetingPlanAction.SEND;
  }

  async continueToComposer(): Promise<void> {
    this.working = true;
    this.workingAction = VideoMeetingPlanAction.COMPOSE;
    this.sendError = null;
    try {
      const invite = await this.createMeetingAndInvite();
      if (invite) {
        this.inviteHandoff.queue(invite);
        this.router.navigate(["/admin/email-composer"], {queryParams: this.composerQueryParams(invite)});
      }
    } catch (error) {
      this.logger.error("failed to continue to composer", error);
      this.sendError = extractErrorMessage(error) || "The meeting invite could not be created.";
    } finally {
      this.working = false;
      this.workingAction = null;
    }
  }

  async sendNow(): Promise<void> {
    this.sendError = null;
    this.sendNotice = null;
    if (!this.senderRole()) {
      this.sendError = "Send now needs you to be linked to a committee role with an email address. Continue in the email composer instead, or ask a site administrator.";
    } else if (!this.canSendNow()) {
      this.sendError = "Add guests or include a list before sending.";
    } else {
      this.working = true;
      this.workingAction = VideoMeetingPlanAction.SEND;
      const invite = await this.createMeetingAndInvite();
      if (invite) {
        await this.sendInviteNow(invite);
      }
      this.working = false;
      this.workingAction = null;
    }
  }

  private sendRecipientCount(): number {
    const guests = this.guestRecipientsField.length;
    const listMembers = this.selectedListId === null
      ? 0
      : this.mailListUpdaterService.subscribedMembers(this.members, this.selectedListId).length;
    return guests + listMembers;
  }

  private senderRole(): CommitteeMember | null {
    const memberId = this.memberLoginService.loggedInMember()?.memberId;
    return this.committeeRoles.find(role => role.memberId === memberId && !!role.email) || null;
  }

  private async createMeetingAndInvite(): Promise<VideoMeetingInviteHandoff | null> {
    this.workingMessage = "Creating meeting…";
    const room = this.videoMeetingsService.generateRoomName(this.config?.roomPrefix);
    const member = this.memberLoginService.loggedInMember();
    const meetingTitle = this.title.trim() || this.suggestedTitle();
    const startTime = this.startTimeValue();
    const agendaFileType = this.selectedAgendaFileType();
    const joinUrl = this.videoMeetingsService.guestUrl(room);
    const savedFile = (this.generateAgenda && agendaFileType)
      ? await this.createCommitteeEventWithAgenda(agendaFileType, startTime, meetingTitle, joinUrl)
      : null;
    if (savedFile) {
      this.workingMessage = "Adding agenda to committee events…";
    }
    const committeePagePath = savedFile
      ? await this.committeeFileService.addToCommitteeDocumentsPage(savedFile)
      : null;
    const committeeFileId = savedFile?.id;
    try {
      await this.videoMeetingsService.createPlannedMeeting({
        room,
        title: meetingTitle,
        startTime,
        meetingType: this.meetingType ?? undefined,
        committeeFileId,
        createdAt: this.dateUtils.nowAsValue(),
        createdBy: member?.memberId,
        createdByName: [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName
      });
    } catch (error) {
      this.logger.error("failed to persist planned meeting", error);
    }
    const timeLabel = this.dateUtils.asString(startTime, null, UIDateFormat.RAMBLERS_TIME);
    const body = `You are invited to a video meeting.\n\n`
      + `**When:** ${this.selectedDateLabel} at ${timeLabel}\n\n`
      + `**Join:** ${joinUrl}\n\n`
      + `No account is needed — click the link, allow your camera and microphone, and you are in.`;
    return {
      subject: meetingTitle,
      body,
      externalRecipients: this.guestRecipients(),
      selectedListId: this.selectedListId ?? undefined,
      attachments: [{name: "meeting.ics", url: this.videoMeetingsService.calendarUrl(room)}],
      committeeFileSlug: savedFile ? this.committeeDisplayService.committeeFileSlug(savedFile) : undefined,
      committeePagePath: committeePagePath || undefined
    };
  }

  private composerQueryParams(invite: VideoMeetingInviteHandoff): Record<string, string> {
    const queryParams: Record<string, string> = {};
    if (invite.committeeFileSlug) {
      queryParams[StoredValue.COMMITTEE_FILE] = invite.committeeFileSlug;
    }
    if (invite.committeePagePath) {
      queryParams[StoredValue.SOURCE_PAGE] = invite.committeePagePath;
    }
    if (invite.selectedListId != null) {
      queryParams[StoredValue.LIST_ID] = String(invite.selectedListId);
      queryParams[StoredValue.EMAIL_TYPE] = RecipientMode.ENTIRE_LIST;
    }
    return queryParams;
  }

  private async sendInviteNow(invite: VideoMeetingInviteHandoff): Promise<void> {
    const role = this.senderRole();
    const memberIds = invite.selectedListId == null
      ? []
      : this.mailListUpdaterService.subscribedMembers(this.members, invite.selectedListId)
        .map(member => member.id)
        .filter((id): id is string => !!id);
    const externalRecipients = (invite.externalRecipients || []).map(recipient => ({
      email: recipient.email,
      name: recipient.name
    }));
    if (!role) {
      this.sendError = "Send now needs you to be linked to a committee role with an email address. Continue in the email composer instead, or ask a site administrator.";
    } else if (memberIds.length === 0 && externalRecipients.length === 0) {
      this.sendError = "Add guests or include a list before sending.";
    } else {
      this.workingMessage = "Sending invite…";
      try {
        const htmlBody = this.rendering.markdownToHtml(invite.body);
        const start = await this.sendService.startBatch({
          bannerId: null,
          subject: invite.subject,
          addresseeType: AddresseeType.NONE,
          signoffRoles: [],
          htmlBody,
          htmlBodyTop: htmlBody,
          htmlBodyBottom: "",
          memberIds,
          externalRecipients,
          attachments: invite.attachments,
          brandingMode: BrandingMode.UNBRANDED,
          unbrandedSenderRoleType: role.type
        });
        this.sendNotice = `The invite is being sent to ${this.stringUtils.pluraliseWithCount(start.totalRecipients, "recipient")}.`;
        this.showInvite = false;
      } catch (error) {
        this.logger.error("failed to send meeting invite", error);
        this.sendError = extractErrorMessage(error) || "The invite could not be sent.";
      }
    }
  }

  private async createCommitteeEventWithAgenda(agendaType: string, startTime: number, meetingTitle: string, joinUrl: string): Promise<CommitteeFile | null> {
    this.workingMessage = "Drafting agenda…";
    try {
      const markdown = await this.buildAgendaMarkdown(agendaType, joinUrl);
      const committeeFile: CommitteeFile = {
        id: null,
        fileType: agendaType,
        eventDate: startTime,
        createdDate: this.dateUtils.nowAsValue(),
        document: {title: meetingTitle, markdown}
      };
      const saved = await this.committeeFileService.createOrUpdate(committeeFile);
      return saved || null;
    } catch (error) {
      this.logger.error("failed to create committee event", error);
      return null;
    }
  }

  private async buildAgendaMarkdown(agendaType: string, joinUrl: string): Promise<string> {
    const previousMinutes = await this.latestMinutesMarkdown(agendaType);
    const generated = (previousMinutes && this.aiConnected)
      ? await this.generateAgendaFromMinutes(agendaType, previousMinutes)
      : null;
    const timeLabel = this.dateUtils.asString(this.startTimeValue(), null, UIDateFormat.DISPLAY_TIME);
    return committeeMeetingAgendaMarkdown({
      heading: this.meetingKind(),
      dateLine: `${this.selectedDateLabel}, ${timeLabel}`,
      joinUrl,
      itemsMarkdown: numberedAgendaItemsFromGenerated(generated || "") || this.standardAgendaItemsMarkdown(agendaType)
    });
  }

  private async generateAgendaFromMinutes(agendaType: string, previousMinutes: string): Promise<string | null> {
    try {
      const agenda = (await this.aiService.rewrite(previousMinutes, this.agendaSystemPrompt(agendaType)))?.trim();
      return agenda && agenda !== previousMinutes.trim() ? agenda : null;
    } catch (error) {
      this.logger.error("agenda generation failed, using standard agenda", error);
      return null;
    }
  }

  private async latestMinutesMarkdown(agendaType: string): Promise<string | null> {
    try {
      const minutesType = this.minutesTypeFor(agendaType);
      const latest = await this.committeeFileService.all({criteria: {fileType: minutesType}, sort: {eventDate: -1}, limit: 1});
      const minutesFile = latest?.[0];
      if (!minutesFile) {
        return null;
      } else if (minutesFile.document?.markdown?.trim()) {
        return minutesFile.document.markdown;
      } else {
        const converted = await this.documentConversionService.convertCommitteeFile(minutesFile.id);
        return converted?.markdown?.trim() ? converted.markdown : null;
      }
    } catch (error) {
      this.logger.error("failed to read previous minutes", error);
      return null;
    }
  }

  private minutesTypeFor(agendaType: string): string {
    const candidate = agendaType.replace(/agenda/i, "Minutes").trim();
    const exact = this.fileTypes.find(fileType => fileType.description.toLowerCase() === candidate.toLowerCase());
    const anyMinutes = this.fileTypes.find(fileType => /minutes/i.test(fileType.description));
    return exact?.description || anyMinutes?.description || "Minutes";
  }

  private agendaSystemPrompt(agendaType: string): string {
    return [
      `You are the secretary of a Ramblers group committee, preparing the agenda for the forthcoming ${agendaType.replace(/\s*agenda\s*$/i, "").trim()} meeting on ${this.selectedDateLabel}.`,
      "The user message contains the markdown minutes of the previous meeting.",
      "Produce only a numbered list of agenda items in GitHub-flavoured markdown.",
      "Do not include a title, date, location or meeting link — those are added separately.",
      "Use standard committee order: apologies for absence; minutes of the previous meeting; matters arising; officer reports; specific topics; any other business; date of next meeting.",
      "Include a 'Matters arising' item listing, as bullet points, any action points, unresolved items or decisions carried over from the previous minutes that need follow-up.",
      "Do not invent items that are not implied by the minutes."
    ].join(" ");
  }

  private standardAgendaItemsMarkdown(agendaType: string): string {
    const items = /agm/i.test(agendaType)
      ? [
        "Welcome and apologies for absence",
        "Minutes of the previous AGM",
        "Matters arising",
        "Chair's annual report",
        "Treasurer's report and adoption of accounts",
        "Election of officers and committee",
        "Any proposals from members",
        "Any other business",
        "Date of next AGM"
      ]
      : [
        "Apologies for absence",
        "Minutes of the previous meeting",
        "Matters arising",
        "Chair's report",
        "Treasurer's report",
        "Walks report",
        "Social report",
        "Membership report",
        "Any other business",
        "Date of next meeting"
      ];
    return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
  }

  private startTimeValue(): number {
    return this.dateUtils.asDateTime(this.startDateTime).toMillis();
  }
}
