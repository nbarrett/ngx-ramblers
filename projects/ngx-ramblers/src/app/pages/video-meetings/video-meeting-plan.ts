import { AfterViewInit, Component, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faEllipsis, faFileLines, faFloppyDisk, faPaperPlane, faRightToBracket, faSpinner, faTrash } from "@fortawesome/free-solid-svg-icons";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { WalkProgrammeCalendarComponent } from "../walks/walk-programme-calendar/walk-programme-calendar";
import { CalendarEntry } from "../../models/walk-programme.model";
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
import { CommitteeFile, CommitteeFileMeeting, CommitteeFileMeetingRole, CommitteeFileType, CommitteeMeetingFormat, CommitteeMeetingType, CommitteeMember, OTHER_MEETING_CATEGORY, meetingHasVenue, meetingIsOnline } from "../../models/committee.model";
import { NextCommitteeMeetingBannerComponent } from "./next-committee-meeting-banner";
import { SortableTableComponent } from "../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../modules/common/sortable-table/sortable-table.model";
import { ThumbnailHeadingFrameComponent } from "../../modules/common/thumbnail-heading-frame/thumbnail-heading-frame";
import { LabelledFieldRowComponent } from "../../modules/common/labelled-field-row/labelled-field-row";
import { LabelledFieldComponent } from "../../modules/common/labelled-field-row/labelled-field";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { AlertPanelVariant } from "../../models/alert-panel.model";
import { RecipientFieldComponent } from "../../modules/common/recipient-field/recipient-field";
import { ExternalRecipientService } from "../../services/external-recipient/external-recipient.service";
import { ExternalRecipient } from "../../models/external-recipient.model";
import {
  AddresseeType,
  BrandingMode,
  ComposerExternalRecipient
} from "../../models/email-composer.model";
import { CommitteeDisplayService } from "../committee/committee-display.service";
import { Subscription } from "rxjs";
import {
  DEFAULT_GUEST_INSTRUCTIONS,
  UpcomingBookedMeeting,
  VideoMeetingCancellationPerson,
  VideoMeetingInviteHandoff,
  VideoMeetingInviteRecipient,
  VideoMeetingPlanAction,
  VideoMeetingRsvpPerson,
  VideoMeetingRsvpTableColumn
} from "../../models/video-meeting.model";
import { AdminPath } from "../../models/admin-route-paths.model";
import { videoMeetingCancellationPeople } from "../../functions/video-meeting-cancellation";
import { videoMeetingRsvpLabel, videoMeetingRsvpPeople } from "../../functions/video-meeting-rsvp";
import { ASCENDING, DESCENDING } from "../../models/table-filtering.model";
import { SortDirection } from "../../models/sort.model";
import { StoredValue } from "../../models/ui-actions";
import { UiActionsService } from "../../services/ui-actions.service";
import { UIDateFormat } from "../../models/date-format.model";
import { suggestedVideoMeetingTitle, videoMeetingDateSlug } from "../../functions/video-meeting-join";
import { meetingInviteBodyMarkdown, personaliseJoinLinkHtml } from "../../functions/video-meeting-invite";
import { memberHoldsCommitteeRole } from "../../functions/committee-members";
import { EmailComposerSendService } from "../../services/email-composer/email-composer-send.service";
import { EmailComposerRenderingService } from "../../services/email-composer/email-composer-rendering.service";
import { MailListUpdaterService } from "../../services/mail/mail-list-updater.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { extractErrorMessage } from "../../functions/strings";
import { isString } from "es-toolkit/compat";
import { committeeMeetingAgendaMarkdown, committeeMeetingLocationLine, numberedAgendaItemsFromGenerated, withCommitteeMeetingDateLine, withCommitteeMeetingLink, withCommitteeMeetingLocationLine } from "../../functions/committee-meeting-agenda";

@Component({
  selector: "app-video-meeting-plan",
  imports: [FormsModule, FontAwesomeModule, RouterLink, WalkProgrammeCalendarComponent, DraggableModalComponent, TimePicker, ListSubscriberCountComponent, NextCommitteeMeetingBannerComponent, ThumbnailHeadingFrameComponent, RecipientFieldComponent, AlertPanelComponent, LabelledFieldRowComponent, LabelledFieldComponent, BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective, SortableTableComponent, SortableTableCellDirective],
  styleUrls: ["./video-meeting-plan.sass"],
  template: `
    @if (sendNotice) {
      <app-alert-panel class="mb-3" title="Invite sent" [variant]="AlertPanelVariant.SUCCESS" [icon]="faCircleCheck">
        {{ sendNotice }}
      </app-alert-panel>
    }
    <app-next-committee-meeting-banner (plan)="openBannerMeeting($event)"/>
    <app-walk-programme-calendar [selectMode]="true" [includeCommitteeEvents]="true"
                                 (dateSelected)="onDateSelected($event)"
                                 (committeeEventSelected)="onCommitteeEventSelected($event)"
                                 (committeeEventDeleted)="onCommitteeEventDeleted($event)"/>
    @if (pendingDeleteEntry) {
      <app-draggable-modal [open]="true" [showCloseButton]="false" (closed)="cancelDelete()">
        <span modalTitle>Delete this meeting?</span>
        <div modalBody>
          <app-alert-panel title="This cannot be undone">
            <p class="mb-2"><strong>{{ pendingDeleteEntry.title }}</strong> on
              <strong>{{ pendingDeleteWhen() }}</strong> will be removed from the calendar and the committee documents page.</p>
            @if (cancellationPeople.length > 0) {
              <div class="form-check mb-0">
                <input class="form-check-input" type="checkbox" id="email-invitees" [(ngModel)]="emailInviteesOnDelete">
                <label class="form-check-label" for="email-invitees">Also email the cancellation to the people who were invited</label>
              </div>
              @if (emailInviteesOnDelete) {
                <ul class="cancellation-people">
                  @for (person of cancellationPeople; track person.key) {
                    <li>{{ person.name }}</li>
                  }
                </ul>
              }
            }
          </app-alert-panel>
          @if (deleteError) {
            <app-alert-panel class="mt-3" title="Meeting not deleted" [variant]="AlertPanelVariant.DANGER">
              {{ deleteError }}
            </app-alert-panel>
          }
        </div>
        <button modalFooter type="button" class="btn btn-quiet btn-sm" [disabled]="working" (click)="cancelDelete()">
          Cancel
        </button>
        <button modalFooter type="button" class="btn btn-danger btn-sm" [disabled]="working" (click)="confirmDelete()">
          <fa-icon [icon]="deleteWorking() ? faSpinner : faTrash" [animation]="deleteWorking() ? 'spin' : null" class="me-2"/>
          {{ deleteWorking() ? workingMessage : "Delete meeting" }}
        </button>
      </app-draggable-modal>
    }

    @if (showInvite) {
    <app-draggable-modal [open]="true" [showCloseButton]="false" (closed)="cancel()">
      <span modalTitle>{{ isEditing() ? "Edit meeting" : "New meeting invite" }}</span>
      <div modalBody>
        <p class="fw-bold">{{ selectedDateLabel }}</p>

        @if (meetingTypes.length) {
          <app-thumbnail-heading-frame heading="Meeting type" [compact]="true">
            @for (type of meetingTypes; track type.description) {
              <div class="form-check">
                <input class="form-check-input" type="radio" name="plan-type" [id]="'plan-type-' + type.description"
                       [checked]="meetingType === type.description" (change)="onMeetingTypeChange(type.description)">
                <label class="form-check-label" [for]="'plan-type-' + type.description">{{ type.description }}</label>
              </div>
            }
            @if (selectedAgendaFileType() && !isEditing()) {
              <div class="form-check mt-1">
                <input class="form-check-input" type="checkbox" id="plan-generate-agenda"
                       [(ngModel)]="generateAgenda" [ngModelOptions]="{standalone: true}">
                <label class="form-check-label" for="plan-generate-agenda">Generate draft agenda</label>
              </div>
            }
          </app-thumbnail-heading-frame>
        }

        <app-thumbnail-heading-frame heading="Meeting details" [compact]="true">
          <div class="mb-2">
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="plan-format" id="plan-format-in-person"
                     [checked]="format === CommitteeMeetingFormat.IN_PERSON" (change)="format = CommitteeMeetingFormat.IN_PERSON">
              <label class="form-check-label" for="plan-format-in-person">In person</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="plan-format" id="plan-format-online"
                     [checked]="format === CommitteeMeetingFormat.ONLINE" (change)="format = CommitteeMeetingFormat.ONLINE">
              <label class="form-check-label" for="plan-format-online">Online</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="plan-format" id="plan-format-hybrid"
                     [checked]="format === CommitteeMeetingFormat.HYBRID" (change)="format = CommitteeMeetingFormat.HYBRID">
              <label class="form-check-label" for="plan-format-hybrid">Hybrid</label>
            </div>
          </div>
          <app-labelled-field-row>
            <app-labelled-field label="Time" controlId="plan-time">
              <div app-time-picker id="plan-time"
                   [value]="startDateTime" (timeChange)="onTimeChange($event)"></div>
            </app-labelled-field>
            <app-labelled-field label="Meeting title" controlId="plan-title" [grow]="true">
              <input id="plan-title" class="form-control input-sm flex-grow-1" [(ngModel)]="title"
                     placeholder="e.g. Committee meeting">
            </app-labelled-field>
          </app-labelled-field-row>
          <div class="mt-2">
            <label for="plan-invite-note">Invite note (optional)</label>
            <textarea id="plan-invite-note" class="form-control" rows="2" [(ngModel)]="inviteNote"
                      placeholder="A short note for the invite, if the title is not enough"></textarea>
          </div>
          @if (hasVenue()) {
            <div class="mt-2">
              <label for="plan-location">Location</label>
              <input id="plan-location" class="form-control input-sm" [(ngModel)]="location"
                     placeholder="e.g. Village Hall, High Street">
            </div>
          }
          @if (isOnline()) {
            <p class="small text-muted mb-0 mt-2">A video link is created and added to the agenda and invite.</p>
          }
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
          @if (committeeRoleSendOffered()) {
            <div class="form-check mt-2">
              <input class="form-check-input" type="checkbox" id="plan-send-to-role-addresses" [(ngModel)]="sendToRoleAddresses">
              <label class="form-check-label" for="plan-send-to-role-addresses">Send to committee role addresses</label>
            </div>
            <small class="text-muted">Leave this off to use personal addresses. Turn it on to send to each committee member's role address instead.</small>
          }
        </app-thumbnail-heading-frame>
        <app-thumbnail-heading-frame heading="External recipients (optional)" [compact]="true">
          <app-recipient-field [to]="guestRecipientsField" (toChange)="guestRecipientsField = $event"
                               [savedRecipients]="previousRecipients" [plain]="true"/>
        </app-thumbnail-heading-frame>
        @if (isEditing() && rsvpPeople().length) {
          <app-thumbnail-heading-frame heading="Replies" [compact]="true">
            <app-sortable-table
              [columns]="rsvpColumns"
              [rows]="rsvpPeople()"
              [defaultSortKey]="rsvpSortKey"
              [defaultSortDirection]="rsvpSortDirection"
              [trackBy]="trackRsvpPerson"
              emptyMessage="No invitations sent yet"
              (sortChange)="onRsvpSortChange($event)">
              <ng-template [appSortableTableCell]="VideoMeetingRsvpTableColumn.NAME" let-row>{{ row.name }}</ng-template>
              <ng-template [appSortableTableCell]="VideoMeetingRsvpTableColumn.EMAIL" let-row>{{ row.email }}</ng-template>
              <ng-template [appSortableTableCell]="VideoMeetingRsvpTableColumn.REPLY" let-row>{{ rsvpLabel(row.status) }}</ng-template>
            </app-sortable-table>
          </app-thumbnail-heading-frame>
        }
        @if (existingLoadError) {
          <app-alert-panel class="mt-3" title="Could not load this meeting" [variant]="AlertPanelVariant.DANGER">
            {{ existingLoadError }}
          </app-alert-panel>
        }
        @if (sendError) {
          <app-alert-panel class="mt-3" [title]="isEditing() ? 'Meeting not saved' : 'Invite not sent'">
            {{ sendError }}
          </app-alert-panel>
        }
        @if (editingCreatedByName) {
          <p class="small text-muted mb-0 mt-2">Planned by {{ editingCreatedByName }}</p>
        }
      </div>
      <button modalFooter type="button" class="btn btn-quiet btn-sm" [disabled]="working" (click)="cancel()">
        Close
      </button>
      <div modalFooter dropdown [dropup]="true" class="btn-group" [class.d-none]="!isEditing()">
        <button dropdownToggle type="button" class="btn btn-quiet btn-sm dropdown-toggle" [disabled]="working">
          <fa-icon [icon]="faEllipsis" class="me-2"/>More actions
        </button>
        <ul *dropdownMenu class="dropdown-menu dropdown-menu-end" role="menu">
          @if (editingMeetingRoom) {
            <li>
              <a class="dropdown-item" role="button" (click)="joinFromInvite()">
                <fa-icon [icon]="faRightToBracket" class="me-2"/>Join
              </a>
            </li>
          }
          @if (editingCommitteePath) {
            <li>
              <a class="dropdown-item" [routerLink]="'/' + editingCommitteePath" [queryParams]="existingCommitteeQuery()">
                <fa-icon [icon]="faFileLines" class="me-2"/>Committee page
              </a>
            </li>
          }
          <li>
            <a class="dropdown-item text-danger" role="button" (click)="deleteFromInvite()">
              <fa-icon [icon]="faTrash" class="me-2"/>Delete meeting
            </a>
          </li>
        </ul>
      </div>
      <button modalFooter type="button" class="btn btn-primary btn-sm" [class.d-none]="!isEditing()"
              [disabled]="working || !existingReady" (click)="saveChanges()">
        <fa-icon [icon]="saveWorking() ? faSpinner : faFloppyDisk" [animation]="saveWorking() ? 'spin' : null" class="me-2"/>
        {{ saveWorking() ? workingMessage : "Save changes" }}
      </button>
      <button modalFooter type="button" class="btn btn-quiet btn-sm" [class.d-none]="!confirmingSend"
              [disabled]="working" (click)="cancelSend()">Cancel</button>
      <button modalFooter type="button" class="btn btn-sunset btn-sm" [class.d-none]="!confirmingSend"
              [disabled]="working" (click)="sendNow()">
        <fa-icon [icon]="sendWorking() ? faSpinner : faPaperPlane" [animation]="sendWorking() ? 'spin' : null" class="me-2"/>
        {{ sendWorking() ? workingMessage : "Confirm send" }}
      </button>
      <button modalFooter type="button" class="btn btn-primary btn-sm" [class.d-none]="confirmingSend"
              [disabled]="working || !canSendNow()" (click)="requestSend()">
        <fa-icon [icon]="faPaperPlane" class="me-2"/>
        Send now
      </button>
    </app-draggable-modal>
    }`
})
export class VideoMeetingPlanComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild(WalkProgrammeCalendarComponent) calendar: WalkProgrammeCalendarComponent;
  @ViewChild(NextCommitteeMeetingBannerComponent) banner: NextCommitteeMeetingBannerComponent;
  @ViewChild(TimePicker) timePicker: TimePicker;

  private logger: Logger = inject(LoggerFactory).createLogger("VideoMeetingPlanComponent", NgxLoggerLevel.ERROR);
  private router = inject(Router);
  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  private videoMeetingsService = inject(VideoMeetingsService);
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
  private guestInstructions = DEFAULT_GUEST_INSTRUCTIONS;

  showInvite = false;
  confirmingSend = false;
  existingLoadError: string | null = null;
  existingReady = true;
  editingCreatedByName: string | null = null;
  editingCommitteePath: string | null = null;
  editingMeetingRoom: string | null = null;
  pendingDeleteEntry: CalendarEntry | null = null;
  emailInviteesOnDelete = false;
  cancellationPeople: VideoMeetingCancellationPerson[] = [];
  selectedDate: number;
  selectedDateLabel = "";
  startDateTime: string;
  title = "";
  inviteNote = "";
  format: CommitteeMeetingFormat = CommitteeMeetingFormat.IN_PERSON;
  location = "";
  guestRecipientsField: ComposerExternalRecipient[] = [];
  lists: ListInfo[] = [];
  selectedListId: number | null = null;
  sendToRoleAddresses = false;
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
  deleteError: string | null = null;

  private generatedTitle = "";
  private committeeRoles: CommitteeMember[] = [];
  private fileTypes: CommitteeFileType[] = [];
  private aiConnected = false;
  private pendingPlanDate: number | null = null;
  private pendingMeetingType: string | null = null;
  private pendingCommitteeFileId: string | null = null;

  private editingFile: CommitteeFile | null = null;
  private editingCommitteeSlug: string | null = null;
  private editingComposedDocument = false;
  private loadingEntryId: string | null = null;

  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faEllipsis = faEllipsis;
  protected readonly faFileLines = faFileLines;
  protected readonly faFloppyDisk = faFloppyDisk;
  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faRightToBracket = faRightToBracket;
  protected readonly faSpinner = faSpinner;
  protected readonly faTrash = faTrash;
  protected readonly AlertPanelVariant = AlertPanelVariant;
  protected readonly CommitteeMeetingFormat = CommitteeMeetingFormat;
  protected readonly VideoMeetingRsvpTableColumn = VideoMeetingRsvpTableColumn;
  protected readonly rsvpColumns: SortableTableColumn<VideoMeetingRsvpPerson>[] = [
    {key: VideoMeetingRsvpTableColumn.NAME, label: "Name", sortKey: VideoMeetingRsvpTableColumn.NAME, cellGetter: row => row.name},
    {key: VideoMeetingRsvpTableColumn.EMAIL, label: "Email", sortKey: VideoMeetingRsvpTableColumn.EMAIL, cellGetter: row => row.email},
    {key: VideoMeetingRsvpTableColumn.REPLY, label: "Reply", sortKey: VideoMeetingRsvpTableColumn.REPLY, cellGetter: row => this.rsvpLabel(row.status)}
  ];
  rsvpSortKey: string = VideoMeetingRsvpTableColumn.NAME;
  rsvpSortDirection = ASCENDING;

  isOnline(): boolean {
    return meetingIsOnline(this.format);
  }

  hasVenue(): boolean {
    return meetingHasVenue(this.format);
  }

  async ngOnInit(): Promise<void> {
    this.videoMeetingsService.config()
      .then(config => this.guestInstructions = config?.guestInstructions || DEFAULT_GUEST_INSTRUCTIONS)
      .catch(() => this.guestInstructions = DEFAULT_GUEST_INSTRUCTIONS);
    const planDate = this.uiActions.queryParameter(StoredValue.PLAN_DATE);
    const meetingType = this.uiActions.queryParameter(StoredValue.MEETING_TYPE);
    const committeeFileId = this.uiActions.queryParameter(StoredValue.COMMITTEE_FILE_ID);
    if (planDate) {
      this.pendingPlanDate = this.dateUtils.asValueNoTime(planDate);
    }
    if (meetingType) {
      this.pendingMeetingType = meetingType;
    }
    if (committeeFileId) {
      this.pendingCommitteeFileId = committeeFileId;
    }
    this.applyRsvpSortFromUrl(
      this.uiActions.queryParameter(StoredValue.MEETING_RSVP_SORT),
      this.uiActions.queryParameter(StoredValue.MEETING_RSVP_SORT_ORDER)
    );
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
      this.aiConnected = (await this.aiService.status())?.connected === true;
    } catch (error) {
      this.aiConnected = false;
    }
  }

  ngAfterViewInit(): void {
    if (this.pendingPlanDate) {
      this.openBannerMeeting({
        title: this.pendingMeetingType,
        startTime: this.pendingPlanDate,
        committeeFileId: this.pendingCommitteeFileId || undefined
      });
      this.pendingPlanDate = null;
      this.pendingMeetingType = null;
      this.pendingCommitteeFileId = null;
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onDateSelected(value: number): void {
    this.clearEditing();
    this.generateAgenda = true;
    this.format = CommitteeMeetingFormat.IN_PERSON;
    this.location = "";
    this.selectedDate = value;
    this.selectedDateLabel = this.dateUtils.asString(value, null, UIDateFormat.DISPLAY_DATE_NO_COMMA);
    this.startDateTime = this.dateUtils.isoDateTime(this.dateUtils.asDateTime(value).plus({hours: 19}).toMillis());
    this.title = this.suggestedTitle();
    this.generatedTitle = this.title;
    this.inviteNote = "";
    this.sendError = null;
    this.applyMailLists(this.mailMessagingService.currentConfig());
    void this.mailMessagingService.refreshBrevoLists();
    this.showInvite = true;
  }

  onCommitteeEventSelected(entry: CalendarEntry): void {
    this.pendingDeleteEntry = null;
    this.existingLoadError = null;
    this.confirmingSend = false;
    this.generateAgenda = false;
    this.existingReady = false;
    this.loadingEntryId = entry.id;
    this.applyCalendarEntryToForm(entry);
    this.showInvite = true;
    void this.loadExistingMeetingIntoForm(entry);
  }

  onTimeChange(isoDateTime: string): void {
    if (isString(isoDateTime)) {
      this.startDateTime = isoDateTime;
    }
  }

  onCommitteeEventDeleted(entry: CalendarEntry): void {
    this.clearEditing();
    this.showInvite = false;
    this.pendingDeleteEntry = entry;
    this.emailInviteesOnDelete = false;
    this.cancellationPeople = [];
    this.deleteError = null;
    void this.loadCancellationPeople(entry);
  }

  pendingDeleteWhen(): string {
    return this.pendingDeleteEntry ? this.dateUtils.asString(this.pendingDeleteEntry.dateValue, null, UIDateFormat.DISPLAY_DATE_AT_TIME) : "";
  }

  cancelDelete(): void {
    this.pendingDeleteEntry = null;
    this.emailInviteesOnDelete = false;
    this.cancellationPeople = [];
    this.deleteError = null;
  }

  async confirmDelete(): Promise<void> {
    const entry = this.pendingDeleteEntry;
    const committeeFileId = entry?.id;
    if (committeeFileId) {
      this.working = true;
      this.workingAction = VideoMeetingPlanAction.DELETE;
      this.workingMessage = "Deleting meeting…";
      this.deleteError = null;
      try {
        const file = await this.committeeFileService.getById(committeeFileId).catch((error): CommitteeFile | null => {
          this.logger.error("no committee file for calendar entry", error);
          return null;
        });
        if (this.emailInviteesOnDelete && file) {
          await this.sendCancellation(file);
        }
        if (file) {
          await this.committeeFileService.removeFromCommitteeDocumentsPage(file);
          await this.committeeFileService.delete(file);
        }
        await this.calendar?.reloadEntries();
        await this.banner?.reload();
        this.pendingDeleteEntry = null;
        this.emailInviteesOnDelete = false;
        this.cancellationPeople = [];
      } catch (error) {
        this.logger.error("failed to delete committee event", error);
        this.deleteError = extractErrorMessage(error) || "The meeting could not be deleted.";
      } finally {
        this.working = false;
        this.workingAction = null;
        this.workingMessage = "";
      }
    } else {
      this.pendingDeleteEntry = null;
      this.emailInviteesOnDelete = false;
      this.cancellationPeople = [];
    }
  }

  private async loadCancellationPeople(entry: CalendarEntry): Promise<void> {
    try {
      if (!this.members.length) {
        this.members = await this.memberService.privilegedFields(this.memberService.filterFor.GROUP_MEMBERS);
      }
      const file = await this.committeeFileService.getById(entry.id).catch((): CommitteeFile | null => null);
      if (this.pendingDeleteEntry?.id === entry.id) {
        this.cancellationPeople = file ? this.peopleWhoWouldReceiveCancellation(file) : [];
      }
    } catch (error) {
      this.logger.error("failed to load meeting invitees for cancellation", error);
      if (this.pendingDeleteEntry?.id === entry.id) {
        this.cancellationPeople = [];
      }
    }
  }

  private peopleWhoWouldReceiveCancellation(file: CommitteeFile): VideoMeetingCancellationPerson[] {
    const listMembers = file.meeting?.invitedListId == null
      ? []
      : this.mailListUpdaterService.subscribedMembers(this.members, file.meeting.invitedListId);
    return videoMeetingCancellationPeople(listMembers, file.meeting?.invitedRecipients || []);
  }

  private async sendCancellation(file: CommitteeFile): Promise<void> {
    const role = this.senderRole();
    const people = this.peopleWhoWouldReceiveCancellation(file);
    const memberIds = people.map(person => person.memberId).filter((id): id is string => !!id);
    const externalRecipients = people
      .filter(person => !person.memberId)
      .map(person => ({
        email: person.email,
        name: person.name
      }));
    if (role && people.length > 0) {
      const meetingTitle = file.document?.title || file.meeting?.title || "Committee meeting";
      const timeLabel = this.dateUtils.asString(file.eventDate, null, UIDateFormat.RAMBLERS_TIME);
      const dateLabel = this.dateUtils.asString(file.eventDate, null, UIDateFormat.DISPLAY_DATE_NO_DAY);
      const body = `The meeting "${meetingTitle}" on ${dateLabel} at ${timeLabel} has been cancelled.\n\n`
        + `Apologies for any inconvenience.`;
      const htmlBody = this.rendering.markdownToHtml(body);
      const start = await this.sendService.startBatch({
        bannerId: null,
        subject: `Cancelled: ${meetingTitle}`,
        addresseeType: AddresseeType.NONE,
        signoffRoles: [],
        htmlBody,
        htmlBodyTop: htmlBody,
        htmlBodyBottom: "",
        memberIds,
        externalRecipients,
        attachments: [],
        brandingMode: BrandingMode.UNBRANDED,
        unbrandedSenderRoleType: role.type
      });
      this.sendNotice = `A cancellation has been sent to ${this.stringUtils.pluraliseWithCount(start.totalRecipients, "recipient")}.`;
    }
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
    return this.meetingType || "Committee meeting";
  }

  private agendaLocationLine(venue: string): string {
    return committeeMeetingLocationLine(this.format, venue);
  }

  private suggestedTitle(): string {
    return suggestedVideoMeetingTitle(this.meetingKind(), this.selectedDateLabel);
  }

  private applySuggestedTitle(): void {
    const suggested = this.suggestedTitle();
    if (!this.title.trim() || this.title === this.generatedTitle) {
      this.title = suggested;
    }
    this.generatedTitle = suggested;
  }

  openBannerMeeting(meeting: UpcomingBookedMeeting): void {
    this.calendar?.showDate(this.dateUtils.asValueNoTime(meeting.startTime));
  }

  cancel(): void {
    this.showInvite = false;
    this.clearEditing();
    this.generateAgenda = true;
  }

  isEditing(): boolean {
    return !!(this.editingFile || this.loadingEntryId);
  }

  existingCommitteeQuery(): Record<string, string> {
    if (!this.editingCommitteeSlug) {
      return {};
    } else if (this.editingComposedDocument) {
      return {[StoredValue.DOCUMENT]: this.editingCommitteeSlug};
    } else {
      return {[StoredValue.FILE]: this.editingCommitteeSlug};
    }
  }

  deleteFromInvite(): void {
    const committeeFileId = this.editingFile?.id;
    const title = this.title;
    const startTime = this.editingFile?.eventDate || this.startTimeValue();
    this.cancel();
    if (committeeFileId) {
      this.onCommitteeEventDeleted({
        id: committeeFileId,
        title,
        isGroupEvent: false,
        isCommitteeEvent: true,
        colour: "",
        time: "",
        dateValue: startTime
      });
    }
  }

  joinFromInvite(): void {
    if (this.editingMeetingRoom) {
      this.router.navigate(["/" + AdminPath.MEETING_ROOM, this.editingMeetingRoom], {
        queryParams: {[StoredValue.MEETING_TITLE]: this.title}
      });
    }
  }

  private clearEditing(): void {
    this.confirmingSend = false;
    this.editingFile = null;
    this.editingCreatedByName = null;
    this.editingCommitteePath = null;
    this.editingCommitteeSlug = null;
    this.editingComposedDocument = false;
    this.editingMeetingRoom = null;
    this.loadingEntryId = null;
    this.existingLoadError = null;
    this.existingReady = true;
  }

  private applyCalendarEntryToForm(entry: CalendarEntry): void {
    this.selectedDate = this.dateUtils.asValueNoTime(entry.dateValue);
    this.selectedDateLabel = this.dateUtils.asString(entry.dateValue, null, UIDateFormat.DISPLAY_DATE_NO_COMMA);
    this.startDateTime = this.dateUtils.isoDateTime(entry.dateValue);
    this.title = entry.title;
    this.generatedTitle = this.title;
    this.inviteNote = "";
    this.selectedListId = null;
    this.guestRecipientsField = [];
    this.sendError = null;
    this.applyMailLists(this.mailMessagingService.currentConfig());
  }

  private meetingTypeFromFile(file: CommitteeFile | null): string | null {
    const matched = this.meetingTypes.find(type => type.agendaFileType === file?.fileType || type.minutesFileType === file?.fileType);
    if (matched) {
      return matched.description;
    } else if (file?.fileType === OTHER_MEETING_CATEGORY) {
      return OTHER_MEETING_CATEGORY;
    } else {
      return null;
    }
  }

  private async loadExistingMeetingIntoForm(entry: CalendarEntry): Promise<void> {
    try {
      if (!this.members.length) {
        this.members = await this.memberService.privilegedFields(this.memberService.filterFor.GROUP_MEMBERS);
      }
      const file = await this.committeeFileService.getById(entry.id).catch((error): CommitteeFile | null => {
        this.logger.error("failed to load committee file for meeting", error);
        return null;
      });
      if (this.loadingEntryId === entry.id && this.showInvite) {
        const meeting = file?.meeting;
        const start = file?.eventDate || entry.dateValue;
        this.editingFile = file;
        this.editingCreatedByName = meeting?.createdByName || null;
        this.editingMeetingRoom = meeting?.room || null;
        this.selectedDate = this.dateUtils.asValueNoTime(start);
        this.selectedDateLabel = this.dateUtils.asString(start, null, UIDateFormat.DISPLAY_DATE_NO_COMMA);
        this.startDateTime = this.dateUtils.isoDateTime(start);
        this.title = file?.document?.title || meeting?.title || entry.title;
        this.generatedTitle = this.title;
        this.inviteNote = meeting?.inviteNote || "";
        this.meetingType = this.meetingTypeFromFile(file) || this.meetingType;
        this.format = meeting?.format || CommitteeMeetingFormat.IN_PERSON;
        this.location = meeting?.location || "";
        this.selectedListId = meeting?.invitedListId ?? null;
        this.sendToRoleAddresses = meeting?.useCommitteeRoleAddresses ?? false;
        this.guestRecipientsField = (meeting?.invitedRecipients || []).map(recipient => ({
          email: recipient.email,
          name: recipient.name
        }));
        this.editingCommitteePath = file ? await this.committeeFileService.documentsPagePathFor(file) : null;
        this.editingCommitteeSlug = file ? this.committeeDisplayService.committeeFileSlug(file) : null;
        this.editingComposedDocument = !!(file && this.committeeDisplayService.isComposedDocument(file));
        this.existingReady = true;
      }
    } catch (error) {
      this.logger.error("failed to load existing meeting", error);
      if (this.loadingEntryId === entry.id) {
        this.existingLoadError = extractErrorMessage(error) || "This meeting could not be loaded.";
        this.existingReady = true;
      }
    }
  }

  private guestRecipients(): VideoMeetingInviteRecipient[] {
    return this.guestRecipientsField.map(recipient => ({email: recipient.email, name: recipient.name}));
  }

  rsvpPeople(): VideoMeetingRsvpPerson[] {
    const listMembers = this.selectedListId === null
      ? []
      : this.mailListUpdaterService.subscribedMembers(this.members, this.selectedListId);
    return videoMeetingRsvpPeople(listMembers, this.guestRecipients(), this.editingFile?.meeting?.rsvps || []);
  }

  rsvpLabel(status: VideoMeetingRsvpPerson["status"]): string {
    return videoMeetingRsvpLabel(status);
  }

  trackRsvpPerson(_index: number, person: VideoMeetingRsvpPerson): string {
    return person.key;
  }

  onRsvpSortChange(state: SortableTableSortState): void {
    this.rsvpSortKey = state.key || VideoMeetingRsvpTableColumn.NAME;
    this.rsvpSortDirection = state.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.uiActions.updateQueryParameters({
      [StoredValue.MEETING_RSVP_SORT]: this.rsvpSortKey ? this.stringUtils.kebabCase(this.rsvpSortKey) : null,
      [StoredValue.MEETING_RSVP_SORT_ORDER]: this.rsvpSortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC
    });
  }

  private applyRsvpSortFromUrl(sortParam: string | null, sortOrderParam: string | null): void {
    const matchedSortKey = this.rsvpColumns
      .map(column => column.sortKey)
      .filter(Boolean)
      .find(key => this.stringUtils.kebabCase(key) === sortParam);
    if (matchedSortKey) {
      this.rsvpSortKey = matchedSortKey;
    }
    if (sortOrderParam === SortDirection.DESC) {
      this.rsvpSortDirection = DESCENDING;
    } else if (sortOrderParam === SortDirection.ASC) {
      this.rsvpSortDirection = ASCENDING;
    }
  }

  private applyMailLists(config: MailMessagingConfig): void {
    this.lists = config?.brevo?.lists?.lists ?? [];
  }

  canSendNow(): boolean {
    return this.sendRecipientCount() > 0;
  }

  sendWorking(): boolean {
    return this.working && this.workingAction === VideoMeetingPlanAction.SEND;
  }

  saveWorking(): boolean {
    return this.working && this.workingAction === VideoMeetingPlanAction.SAVE;
  }

  deleteWorking(): boolean {
    return this.working && this.workingAction === VideoMeetingPlanAction.DELETE;
  }

  async saveChanges(): Promise<void> {
    this.sendError = null;
    this.sendNotice = null;
    this.working = true;
    this.workingAction = VideoMeetingPlanAction.SAVE;
    this.workingMessage = "Saving meeting…";
    try {
      const persisted = await this.persistMeeting();
      if (persisted) {
        await this.refreshPlanView();
        this.sendNotice = "Meeting updated.";
        this.showInvite = false;
        this.clearEditing();
        this.generateAgenda = true;
      }
    } catch (error) {
      this.logger.error("failed to save meeting", error);
      this.sendError = extractErrorMessage(error) || "The meeting could not be saved.";
    } finally {
      this.working = false;
      this.workingAction = null;
    }
  }

  requestSend(): void {
    this.sendNotice = null;
    if (!this.senderRole()) {
      this.confirmingSend = false;
      this.sendError = "Sending needs you to be linked to a committee role with an email address. Ask a site administrator if you are not.";
    } else if (!this.canSendNow()) {
      this.confirmingSend = false;
      this.sendError = "Add guests or include a list before sending.";
    } else {
      this.sendError = null;
      this.confirmingSend = true;
    }
  }

  cancelSend(): void {
    this.confirmingSend = false;
  }

  async sendNow(): Promise<void> {
    this.sendError = null;
    this.sendNotice = null;
    this.confirmingSend = false;
    this.working = true;
    this.workingAction = VideoMeetingPlanAction.SEND;
    const invite = await this.createMeetingAndInvite();
    if (invite) {
      await this.sendInviteNow(invite);
      await this.refreshPlanView();
    }
    this.working = false;
    this.workingAction = null;
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

  committeeRoleSendOffered(): boolean {
    const listMembers = this.selectedListId === null
      ? []
      : this.mailListUpdaterService.subscribedMembers(this.members, this.selectedListId);
    return listMembers.length > 0
      && this.guestRecipientsField.length === 0
      && listMembers.every(member => memberHoldsCommitteeRole(member, this.committeeRoles));
  }

  private useCommitteeRoleAddresses(): boolean {
    return this.committeeRoleSendOffered() && this.sendToRoleAddresses;
  }

  private async createMeetingAndInvite(): Promise<VideoMeetingInviteHandoff | null> {
    this.workingMessage = this.isEditing() ? "Saving meeting…" : "Creating meeting…";
    const persisted = await this.persistMeeting();
    if (!persisted) {
      return null;
    } else {
      return {
        subject: persisted.meetingTitle,
        body: this.inviteMarkdown(persisted.startTime, persisted.joinUrl, persisted.location, this.inviteNote),
        joinUrl: persisted.joinUrl || undefined,
        externalRecipients: this.guestRecipients(),
        selectedListId: this.selectedListId ?? undefined,
        useCommitteeRoleAddresses: this.useCommitteeRoleAddresses(),
        attachments: persisted.committeeFileId
          ? [{name: "meeting.ics", url: this.videoMeetingsService.calendarUrl(persisted.committeeFileId)}]
          : [],
        committeeFileSlug: persisted.savedFile ? this.committeeDisplayService.committeeFileSlug(persisted.savedFile) : undefined,
        committeePagePath: persisted.committeePagePath || undefined
      };
    }
  }

  private inviteMarkdown(startTime: number, joinUrl: string, location: string, note: string): string {
    const timeLabel = this.dateUtils.asString(startTime, null, UIDateFormat.RAMBLERS_TIME);
    return meetingInviteBodyMarkdown({
      dateLabel: this.selectedDateLabel,
      timeLabel,
      joinUrl,
      location,
      note,
      guestInstructions: this.guestInstructions,
      signoff: this.inviteSignoff()
    });
  }

  private inviteSignoff(): string {
    const role = this.senderRole();
    const name = role?.fullName || role?.description;
    const roleLine = role?.fullName && role?.description && role.description !== role.fullName
      ? `\n${role.description}`
      : "";
    return name ? `Kind regards\n\n${name}${roleLine}` : "";
  }

  private async persistMeeting(): Promise<{
    startTime: number;
    meetingTitle: string;
    committeeFileId: string | null;
    joinUrl: string;
    location: string;
    savedFile: CommitteeFile | null;
    committeePagePath: string | null;
  } | null> {
    this.timePicker?.commitDisplayedTime();
    const meetingTitle = this.title.trim() || this.suggestedTitle();
    const startTime = this.startTimeValue();
    const dateSlug = videoMeetingDateSlug(this.dateUtils.asString(startTime, null, UIDateFormat.DISPLAY_DATE_NO_DAY));
    const room = this.isOnline()
      ? (this.editingFile?.meeting?.room || this.videoMeetingsService.generateRoomName(meetingTitle, dateSlug))
      : undefined;
    const joinUrl = room ? this.videoMeetingsService.guestUrl(room) : "";
    const venue = this.hasVenue() ? this.location.trim() : "";
    const createdFile = !this.editingFile;
    const member = this.memberLoginService.loggedInMember();
    const existing = this.editingFile?.meeting;
    const role = this.senderRole();
    const meeting: CommitteeFileMeeting = {
      ...(existing || {}),
      format: this.format,
      room,
      location: venue || undefined,
      inviteNote: this.inviteNote.trim() || undefined,
      invited: this.guestRecipients().length > 0 || this.selectedListId != null,
      invitedRecipients: this.guestRecipients(),
      invitedListId: this.selectedListId ?? undefined,
      useCommitteeRoleAddresses: this.useCommitteeRoleAddresses(),
      durationMinutes: existing?.durationMinutes,
      createdBy: existing?.createdBy ?? member?.memberId,
      createdByName: existing?.createdByName
        ?? ([member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName),
      organiserEmail: role?.email || existing?.organiserEmail,
      organiserName: role?.fullName || existing?.organiserName,
      rsvps: existing?.rsvps
    };
    const savedFile = this.editingFile
      ? await this.updateCommitteeCalendarEvent(this.editingFile, startTime, meetingTitle, joinUrl, venue, meeting)
      : await this.createCommitteeCalendarEvent(startTime, meetingTitle, joinUrl, venue, meeting);
    if (savedFile && createdFile) {
      this.workingMessage = "Adding agenda to committee events…";
    }
    const committeePagePath = savedFile && createdFile
      ? await this.committeeFileService.addToCommitteeDocumentsPage(savedFile)
      : this.editingCommitteePath;
    this.editingFile = savedFile || this.editingFile;
    this.editingCreatedByName = this.editingFile?.meeting?.createdByName || this.editingCreatedByName;
    this.editingMeetingRoom = this.editingFile?.meeting?.room || null;
    return {startTime, meetingTitle, committeeFileId: this.editingFile?.id || null, joinUrl, location: venue, savedFile, committeePagePath: committeePagePath || null};
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
        const htmlBody = personaliseJoinLinkHtml(this.rendering.markdownToHtml(invite.body), invite.joinUrl || "");
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
          unbrandedSenderRoleType: role.type,
          useCommitteeRoleAddresses: invite.useCommitteeRoleAddresses === true
        });
        this.sendNotice = `The invite is being sent to ${this.stringUtils.pluraliseWithCount(start.totalRecipients, "recipient")}.`;
        this.showInvite = false;
        this.clearEditing();
        this.generateAgenda = true;
      } catch (error) {
        this.logger.error("failed to send meeting invite", error);
        this.sendError = extractErrorMessage(error) || "The invite could not be sent.";
      }
    }
  }

  private async refreshPlanView(): Promise<void> {
    await this.calendar?.reloadEntries();
    await this.banner?.reload();
  }

  private async updateCommitteeCalendarEvent(
    file: CommitteeFile,
    startTime: number,
    meetingTitle: string,
    joinUrl: string,
    venue: string,
    meeting: CommitteeFileMeeting
  ): Promise<CommitteeFile | null> {
    this.workingMessage = "Saving meeting…";
    try {
      const timeLabel = this.dateUtils.asString(startTime, null, UIDateFormat.DISPLAY_TIME);
      const dateLine = `${this.selectedDateLabel}, ${timeLabel}`;
      const withDate = withCommitteeMeetingDateLine(file.document?.markdown || "", dateLine);
      const withLocation = withCommitteeMeetingLocationLine(withDate, this.agendaLocationLine(venue));
      const markdown = withCommitteeMeetingLink(withLocation, joinUrl);
      const saved = await this.committeeFileService.createOrUpdate({
        ...file,
        fileType: this.selectedAgendaFileType() || file.fileType,
        eventDate: startTime,
        meeting,
        document: {
          ...(file.document || {}),
          title: meetingTitle,
          markdown
        }
      });
      return saved || null;
    } catch (error) {
      this.logger.error("failed to update committee event", error);
      return null;
    }
  }

  private async createCommitteeCalendarEvent(startTime: number, meetingTitle: string, joinUrl: string, venue: string, meeting: CommitteeFileMeeting): Promise<CommitteeFile | null> {
    const fileType = this.selectedAgendaFileType() || this.meetingKind();
    this.workingMessage = this.generateAgenda ? "Drafting agenda…" : "Saving meeting…";
    try {
      const timeLabel = this.dateUtils.asString(this.startTimeValue(), null, UIDateFormat.DISPLAY_TIME);
      const markdown = this.generateAgenda
        ? await this.buildAgendaMarkdown(fileType, joinUrl, venue)
        : committeeMeetingAgendaMarkdown({
          heading: this.meetingKind(),
          dateLine: `${this.selectedDateLabel}, ${timeLabel}`,
          location: this.agendaLocationLine(venue),
          joinUrl: joinUrl || undefined,
          itemsMarkdown: ""
        });
      const saved = await this.committeeFileService.createOrUpdate({
        id: null,
        fileType,
        eventDate: startTime,
        createdDate: this.dateUtils.nowAsValue(),
        meeting,
        document: {title: meetingTitle, markdown}
      });
      return saved || null;
    } catch (error) {
      this.logger.error("failed to create committee event", error);
      return null;
    }
  }

  private async buildAgendaMarkdown(agendaType: string, joinUrl: string, venue: string): Promise<string> {
    const previousMinutes = await this.latestMinutesMarkdown(agendaType);
    const generated = (previousMinutes && this.aiConnected)
      ? await this.generateAgendaFromMinutes(agendaType, previousMinutes)
      : null;
    const timeLabel = this.dateUtils.asString(this.startTimeValue(), null, UIDateFormat.DISPLAY_TIME);
    return committeeMeetingAgendaMarkdown({
      heading: this.meetingKind(),
      dateLine: `${this.selectedDateLabel}, ${timeLabel}`,
      location: this.agendaLocationLine(venue),
      joinUrl: joinUrl || undefined,
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
    const category = this.meetingTypes.find(type => type.agendaFileType === agendaType);
    const anyMinutes = this.fileTypes.find(fileType => fileType.meetingRole === CommitteeFileMeetingRole.MINUTES);
    return category?.minutesFileType || anyMinutes?.description || "Minutes";
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
    const day = this.dateUtils.asDateTime(this.selectedDate).startOf("day");
    const time = this.startDateTime ? this.dateUtils.asDateTime(this.startDateTime) : day.plus({hours: 19});
    return day.set({
      hour: time.hour,
      minute: time.minute,
      second: 0,
      millisecond: 0
    }).toMillis();
  }
}
