import { Component, inject, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { kebabCase } from "es-toolkit/compat";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCalendarDays, faFileLines, faRightToBracket, faRotateRight, faTrash, faVideo } from "@fortawesome/free-solid-svg-icons";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { CommitteeMeetingFormat } from "../../models/committee.model";
import { MemberLoginService } from "../../services/member/member-login.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { UiActionsService } from "../../services/ui-actions.service";
import { PageComponent } from "../../page/page.component";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { NextCommitteeMeetingBannerComponent } from "./next-committee-meeting-banner";
import { ThumbnailHeadingFrameComponent } from "../../modules/common/thumbnail-heading-frame/thumbnail-heading-frame";
import { SortableTableComponent } from "../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableAlignment, SortableTableColumn, SortableTableSortState } from "../../modules/common/sortable-table/sortable-table.model";
import { MEETING_MINUTES_TEMPLATE_ID, MeetingMinutesSummary, MeetingMinutesTableColumn, MeetingTranscriptRoomSummary, RecentVideoCall, UpcomingBookedMeeting, VideoMeetingRuntimeConfig } from "../../models/video-meeting.model";
import { meetingMinutesDocumentSlug } from "../../functions/committee-documents-page";
import { AdminPath, AdminSettingsPath } from "../../models/admin-route-paths.model";
import { SystemSettingsTab } from "../../models/system.model";
import { StoredValue } from "../../models/ui-actions";
import { UIDateFormat } from "../../models/date-format.model";
import { SortDirection } from "../../models/sort.model";
import { ASCENDING, DESCENDING } from "../../models/table-filtering.model";
import { suggestedVideoMeetingTitle, videoMeetingDateSlug } from "../../functions/video-meeting-join";
import { meetingMinutesDateLabel } from "../../functions/video-meeting-minutes";
import { rememberActiveMeetingRoom } from "../../functions/video-meeting-client";
import { recentVideoCalls } from "../../functions/upcoming-booked-meetings";
import { AlertPanelVariant } from "../../models/alert-panel.model";

@Component({
  selector: "app-video-meetings-page",
  imports: [FormsModule, FontAwesomeModule, TooltipModule, PageComponent, AlertPanelComponent, NextCommitteeMeetingBannerComponent, RouterLink, ThumbnailHeadingFrameComponent, SortableTableComponent, SortableTableCellDirective],
  template: `
    <app-page pageTitle="Meetings">
      <app-next-committee-meeting-banner (plan)="openPlannedMeeting($event)"/>
      <div class="row align-items-start mb-4">
        <div class="col-sm-6">
          <app-thumbnail-heading-frame heading="Plan a committee meeting">
            <p>Book a meeting on the calendar - in person, online or hybrid - with an agenda, an email invite and a
              calendar attachment. Pick a date to get started.</p>
            <button type="button" class="btn btn-primary" (click)="planMeeting()">
              <fa-icon [icon]="faCalendarDays" class="me-2"/>Plan a meeting
            </button>
          </app-thumbnail-heading-frame>
          <app-thumbnail-heading-frame heading="Video call" class="d-block mt-4">
            @if (config && !config.enabled) {
              <app-alert-panel title="Video meetings are switched off">
                An administrator can enable them in
                <a [routerLink]="'/' + systemSettingsPath" [queryParams]="{tab: videoMeetingsTab}">System Settings</a>.
              </app-alert-panel>
            } @else {
              <p>Spin up a private meeting room now and share the link, or join one. It runs in the browser, with
                gallery view, screen sharing, chat and shared notes.</p>
              <div class="form-group">
                <label for="start-title">Meeting name</label>
                <input id="start-title" class="form-control input-sm" [(ngModel)]="meetingTitle"
                       placeholder="e.g. August committee meeting">
              </div>
              <button type="button" class="btn btn-primary mb-3" [disabled]="starting" (click)="startMeeting()">
                @if (starting) {
                  <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Starting your meeting…
                } @else {
                  <fa-icon [icon]="faVideo" class="me-2"/>Start a video call now
                }
              </button>
              <div class="form-group">
                <label for="joinRoom">Paste a meeting link, or type a room name</label>
                <input id="joinRoom" class="form-control input-sm" [(ngModel)]="joinRoom" (keydown.enter)="join()"
                       placeholder="Paste a meeting link">
              </div>
              <button type="button" class="btn btn-primary" [disabled]="!canJoin" (click)="join()">
                <fa-icon [icon]="faRightToBracket" class="me-2"/>Join
              </button>
              @if (config) {
                <p class="form-text text-muted mt-3 mb-0">You will join as <strong>{{ displayName }}</strong>.</p>
              }
              @if (config?.publicHost) {
                <app-alert-panel class="mt-3" title="Meetings open in a public room">
                  The first person signs in to start the room. To keep meetings on this site, set a host in
                  <a [routerLink]="'/' + systemSettingsPath" [queryParams]="{tab: videoMeetingsTab}">System Settings</a>.
                </app-alert-panel>
              }
            }
          </app-thumbnail-heading-frame>
        </div>
        <div class="col-sm-6">
          @if (videoCalls.length) {
            <app-thumbnail-heading-frame heading="Recent video calls">
              <p class="text-muted small">Rooms started from this page, rather than booked on the calendar. Join one again, or delete a call you no longer need.</p>
              @if (deletingVideoCall) {
                <app-alert-panel class="mb-3"
                                 [title]="deleteError ? deleteErrorTitle : 'Delete this video call?'"
                                 [variant]="deleteError ? alertDanger : alertWarning" actionsEnd>
                  @if (deleteError) {
                    {{ deleteError }}
                  } @else {
                    This removes {{ deletingVideoCall.title }} from Meetings. The room will no longer appear here.
                  }
                  <button alertActions type="button" class="btn btn-quiet" [disabled]="deleting"
                          (click)="cancelDeleteVideoCall()">Cancel</button>
                  <button alertActions type="button" class="btn"
                          [class.btn-primary]="!!deleteError"
                          [class.btn-danger]="!deleteError"
                          [disabled]="deleting"
                          (click)="deleteVideoCall()">
                    @if (deleteError) {
                      <fa-icon [icon]="faRotateRight" class="me-2"/>{{ deleting ? "Trying…" : "Try again" }}
                    } @else {
                      <fa-icon [icon]="faTrash" class="me-2"/>{{ deleting ? "Deleting…" : "Delete video call" }}
                    }
                  </button>
                </app-alert-panel>
              }
              <app-sortable-table
                [columns]="videoCallColumns"
                [rows]="videoCalls"
                [defaultSortKey]="videoCallsSortKey"
                [defaultSortDirection]="videoCallsSortDirection"
                [trackBy]="trackVideoCall"
                emptyMessage="No recent video calls"
                (sortChange)="onVideoCallsSortChange($event)">
                <ng-template [appSortableTableCell]="minutesTableColumn.TITLE" let-item>{{ item.title }}</ng-template>
                <ng-template [appSortableTableCell]="minutesTableColumn.STARTED_AT" let-item>{{ videoCallWhen(item) }}</ng-template>
                <ng-template [appSortableTableCell]="minutesTableColumn.ACTIONS" let-item>
                  <div class="d-flex justify-content-end gap-1">
                    <button type="button" class="btn btn-primary btn-icon"
                            [disabled]="deleting"
                            (click)="joinVideoCall(item)"
                            tooltip="Join" container="body"
                            [attr.aria-label]="'Join ' + item.title">
                      <fa-icon [icon]="faRightToBracket"/>
                    </button>
                    <button type="button" class="btn btn-quiet btn-icon"
                            [disabled]="deleting"
                            (click)="confirmDeleteVideoCall(item)"
                            tooltip="Delete" container="body"
                            [attr.aria-label]="'Delete ' + item.title">
                      <fa-icon [icon]="faTrash"/>
                    </button>
                  </div>
                </ng-template>
              </app-sortable-table>
            </app-thumbnail-heading-frame>
          }
          @if (recordingsNeedingMinutes.length) {
            <app-thumbnail-heading-frame heading="Calls that still need minutes" [class.mt-4]="videoCalls.length > 0">
              <p class="text-muted small">These calls have a recording but no minutes file yet. You can write the draft from what was said.</p>
              @if (discardingRecording) {
                <app-alert-panel class="mb-3"
                                 [title]="writeError ? writeErrorTitle : 'Discard this recording?'"
                                 [variant]="writeError ? alertDanger : alertWarning" actionsEnd>
                  @if (writeError) {
                    {{ writeError }}
                  } @else {
                    This removes the stored recording for {{ discardingRecording.title }}. Minutes cannot be written from it afterwards.
                  }
                  <button alertActions type="button" class="btn btn-quiet" [disabled]="discarding"
                          (click)="cancelDiscardRecording()">Cancel</button>
                  <button alertActions type="button" class="btn"
                          [class.btn-primary]="!!writeError"
                          [class.btn-danger]="!writeError"
                          [disabled]="discarding"
                          (click)="discardRecording()">
                    @if (writeError) {
                      <fa-icon [icon]="faRotateRight" class="me-2"/>{{ discarding ? "Trying…" : "Try again" }}
                    } @else {
                      <fa-icon [icon]="faTrash" class="me-2"/>{{ discarding ? "Discarding…" : "Discard recording" }}
                    }
                  </button>
                </app-alert-panel>
              } @else if (writeError) {
                <app-alert-panel class="mb-3" [title]="writeErrorTitle" [variant]="alertDanger">
                  {{ writeError }}
                </app-alert-panel>
              }
              <app-sortable-table
                [columns]="minutesColumns"
                [rows]="recordingsNeedingMinutes"
                [defaultSortKey]="recordingsSortKey"
                [defaultSortDirection]="recordingsSortDirection"
                [trackBy]="trackMinutes"
                emptyMessage="No recordings waiting for minutes"
                (sortChange)="onRecordingsSortChange($event)">
                <ng-template [appSortableTableCell]="minutesTableColumn.TITLE" let-item>{{ item.title }}</ng-template>
                <ng-template [appSortableTableCell]="minutesTableColumn.STARTED_AT" let-item>{{ item.dateLabel }}</ng-template>
                <ng-template [appSortableTableCell]="minutesTableColumn.ACTIONS" let-item>
                  <div class="d-flex justify-content-end gap-1">
                    <button type="button" class="btn btn-primary btn-icon"
                            [disabled]="writingRoom === item.room || discarding"
                            (click)="writeMinutesFromRecording(item)"
                            tooltip="Write minutes" container="body"
                            [attr.aria-label]="'Write minutes for ' + item.title">
                      @if (writingRoom === item.room) {
                        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      } @else {
                        <fa-icon [icon]="faRotateRight"/>
                      }
                    </button>
                    <button type="button" class="btn btn-quiet btn-icon"
                            [disabled]="writingRoom === item.room || discarding"
                            (click)="confirmDiscardRecording(item)"
                            tooltip="Discard recording" container="body"
                            [attr.aria-label]="'Discard recording for ' + item.title">
                      <fa-icon [icon]="faTrash"/>
                    </button>
                  </div>
                </ng-template>
              </app-sortable-table>
            </app-thumbnail-heading-frame>
          }
          @if (recentMinutes.length) {
            <app-thumbnail-heading-frame heading="Recent meeting minutes" class="d-block mt-4">
              <app-sortable-table
                [columns]="minutesColumns"
                [rows]="recentMinutes"
                [defaultSortKey]="minutesSortKey"
                [defaultSortDirection]="minutesSortDirection"
                [trackBy]="trackMinutes"
                emptyMessage="No meeting minutes yet"
                (sortChange)="onMinutesSortChange($event)">
                <ng-template [appSortableTableCell]="minutesTableColumn.TITLE" let-item>{{ item.title }}</ng-template>
                <ng-template [appSortableTableCell]="minutesTableColumn.STARTED_AT" let-item>{{ item.dateLabel }}</ng-template>
                <ng-template [appSortableTableCell]="minutesTableColumn.ACTIONS" let-item>
                  <a class="btn btn-quiet btn-icon" [routerLink]="'/' + minutesPath + '/' + item.room"
                     tooltip="View minutes" aria-label="View minutes">
                    <fa-icon [icon]="faFileLines"/>
                  </a>
                </ng-template>
              </app-sortable-table>
            </app-thumbnail-heading-frame>
          }
        </div>
      </div>
    </app-page>`
})
export class VideoMeetingsPageComponent implements OnInit {

  @ViewChild(NextCommitteeMeetingBannerComponent) banner: NextCommitteeMeetingBannerComponent;

  private logger: Logger = inject(LoggerFactory).createLogger("VideoMeetingsPageComponent", NgxLoggerLevel.ERROR);
  private router = inject(Router);
  private videoMeetingsService = inject(VideoMeetingsService);
  private committeeFileService = inject(CommitteeFileService);
  private memberLoginService = inject(MemberLoginService);
  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  private stringUtils = inject(StringUtilsService);

  config: VideoMeetingRuntimeConfig;
  joinRoom = "";
  meetingTitle = "";
  starting = false;
  recentMinutes: MeetingMinutesSummary[] = [];
  recordingsNeedingMinutes: MeetingMinutesSummary[] = [];
  videoCalls: RecentVideoCall[] = [];
  writingRoom: string | null = null;
  writeError = "";
  writeErrorTitle = "Could not write minutes";
  discardingRecording: MeetingMinutesSummary | null = null;
  discarding = false;
  deletingVideoCall: RecentVideoCall | null = null;
  deleting = false;
  deleteError = "";
  deleteErrorTitle = "Could not delete video call";
  protected readonly alertDanger = AlertPanelVariant.DANGER;
  protected readonly alertWarning = AlertPanelVariant.WARNING;

  protected readonly faVideo = faVideo;
  protected readonly faRightToBracket = faRightToBracket;
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly faFileLines = faFileLines;
  protected readonly faRotateRight = faRotateRight;
  protected readonly faTrash = faTrash;
  protected readonly systemSettingsPath = AdminSettingsPath.SYSTEM_SETTINGS;
  protected readonly videoMeetingsTab = kebabCase(SystemSettingsTab.VIDEO_MEETINGS);
  protected readonly minutesPath = AdminPath.MEETING_MINUTES;
  protected readonly minutesTableColumn = MeetingMinutesTableColumn;
  protected readonly minutesColumns: SortableTableColumn<MeetingMinutesSummary>[] = [
    {
      key: MeetingMinutesTableColumn.TITLE,
      label: "Meeting",
      sortKey: MeetingMinutesTableColumn.TITLE,
      cellGetter: row => row.title
    },
    {
      key: MeetingMinutesTableColumn.STARTED_AT,
      label: "When",
      sortKey: MeetingMinutesTableColumn.STARTED_AT,
      cellGetter: row => row.startedAt
    },
    {
      key: MeetingMinutesTableColumn.ACTIONS,
      label: "",
      align: SortableTableAlignment.RIGHT,
      cellClass: "nowrap"
    }
  ];
  protected readonly videoCallColumns: SortableTableColumn<RecentVideoCall>[] = [
    {
      key: MeetingMinutesTableColumn.TITLE,
      label: "Meeting",
      sortKey: MeetingMinutesTableColumn.TITLE,
      cellGetter: row => row.title
    },
    {
      key: MeetingMinutesTableColumn.STARTED_AT,
      label: "When",
      sortKey: MeetingMinutesTableColumn.STARTED_AT,
      cellGetter: row => row.startedAt
    },
    {
      key: MeetingMinutesTableColumn.ACTIONS,
      label: "",
      align: SortableTableAlignment.RIGHT,
      cellClass: "nowrap"
    }
  ];
  minutesSortKey: string = MeetingMinutesTableColumn.STARTED_AT;
  minutesSortDirection = DESCENDING;
  recordingsSortKey: string = MeetingMinutesTableColumn.STARTED_AT;
  recordingsSortDirection = DESCENDING;
  videoCallsSortKey: string = MeetingMinutesTableColumn.STARTED_AT;
  videoCallsSortDirection = DESCENDING;

  async ngOnInit(): Promise<void> {
    this.applyMinutesSortFromUrl(
      this.uiActions.queryParameter(StoredValue.MEETING_MINUTES_SORT),
      this.uiActions.queryParameter(StoredValue.MEETING_MINUTES_SORT_ORDER)
    );
    this.applyRecordingsSortFromUrl(
      this.uiActions.queryParameter(StoredValue.MEETING_RECORDINGS_SORT),
      this.uiActions.queryParameter(StoredValue.MEETING_RECORDINGS_SORT_ORDER)
    );
    this.applyVideoCallsSortFromUrl(
      this.uiActions.queryParameter(StoredValue.MEETING_VIDEO_CALLS_SORT),
      this.uiActions.queryParameter(StoredValue.MEETING_VIDEO_CALLS_SORT_ORDER)
    );
    this.meetingTitle = this.defaultMeetingTitle();
    void this.loadRecentMinutes();
    void this.loadRecordingsNeedingMinutes();
    void this.loadRecentVideoCalls();
    try {
      this.config = await this.videoMeetingsService.config();
      if (this.config?.enabled && !this.config.publicHost) {
        this.videoMeetingsService.loadExternalApi(this.config.host)
          .catch(error => this.logger.info("could not warm up the meeting server", error));
      }
    } catch (error) {
      this.logger.error("failed to load video meeting config", error);
    }
  }

  private async loadRecentMinutes(): Promise<void> {
    try {
      const files = await this.committeeFileService.all({criteria: {"document.templateId": MEETING_MINUTES_TEMPLATE_ID}});
      const listed = (files || [])
        .filter(file => !!file.meeting?.room)
        .sort((left, right) => (right.eventDate || 0) - (left.eventDate || 0))
        .slice(0, 12);
      this.recentMinutes = await Promise.all(listed.map(async file => {
        const storedStart = file.meeting?.startedAt || file.eventDate || null;
        const storedEnd = file.meeting?.endedAt || null;
        const span = storedStart && storedEnd
          ? {startedAt: storedStart, endedAt: storedEnd}
          : await this.videoMeetingsService.transcriptForRoom(file.meeting.room)
            .catch(() => ({startedAt: null, endedAt: null, transcript: "", lines: 0}));
        const startedAt = storedStart || span?.startedAt || file.eventDate || null;
        const endedAt = storedEnd || span?.endedAt || null;
        const title = file.document?.title || file.meeting?.title || "Meeting minutes";
        const pagePath = file.meeting?.committeePagePath
          || await this.committeeFileService.documentsPagePathFor(file);
        return {
          room: file.meeting.room,
          title,
          dateLabel: meetingMinutesDateLabel(
            startedAt,
            endedAt,
            value => this.dateUtils.asString(value, null, UIDateFormat.DISPLAY_DATE_NO_DAY),
            value => this.dateUtils.displayTime(value)
          ),
          startedAt,
          pagePath,
          slug: pagePath ? meetingMinutesDocumentSlug(file.meeting.room) : null
        };
      }));
    } catch (error) {
      this.logger.info("could not load recent meeting minutes", error);
    }
  }

  private async loadRecordingsNeedingMinutes(): Promise<void> {
    try {
      const rooms = await this.videoMeetingsService.transcriptRooms();
      this.recordingsNeedingMinutes = (rooms || [])
        .filter(room => !room.hasMinutes)
        .map(room => this.transcriptRoomSummary(room));
    } catch (error) {
      this.logger.info("could not load recordings that still need minutes", error);
      this.recordingsNeedingMinutes = [];
    }
  }

  private async loadRecentVideoCalls(): Promise<void> {
    try {
      const files = await this.committeeFileService.all({
        criteria: {"meeting.room": {$exists: true, $ne: ""}},
        sort: {eventDate: -1}
      });
      this.videoCalls = recentVideoCalls(files).slice(0, 12);
    } catch (error) {
      this.logger.info("could not load recent video calls", error);
      this.videoCalls = [];
    }
  }

  private transcriptRoomSummary(room: MeetingTranscriptRoomSummary): MeetingMinutesSummary {
    return {
      room: room.room,
      title: room.title || "Meeting recording",
      dateLabel: meetingMinutesDateLabel(
        room.startedAt,
        room.endedAt,
        value => this.dateUtils.asString(value, null, UIDateFormat.DISPLAY_DATE_NO_DAY),
        value => this.dateUtils.displayTime(value)
      ),
      startedAt: room.startedAt || null,
      pagePath: null,
      slug: null
    };
  }

  trackMinutes(_index: number, item: MeetingMinutesSummary): string {
    return item.room;
  }

  trackVideoCall(_index: number, item: RecentVideoCall): string {
    return item.id;
  }

  videoCallWhen(item: RecentVideoCall): string {
    return meetingMinutesDateLabel(
      item.startedAt,
      null,
      value => this.dateUtils.asString(value, null, UIDateFormat.DISPLAY_DATE_NO_DAY),
      value => this.dateUtils.displayTime(value)
    );
  }

  onMinutesSortChange(state: SortableTableSortState): void {
    this.minutesSortKey = state.key || MeetingMinutesTableColumn.STARTED_AT;
    this.minutesSortDirection = state.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.uiActions.updateQueryParameters({
      [StoredValue.MEETING_MINUTES_SORT]: this.minutesSortKey ? this.stringUtils.kebabCase(this.minutesSortKey) : null,
      [StoredValue.MEETING_MINUTES_SORT_ORDER]: this.minutesSortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC
    });
  }

  onRecordingsSortChange(state: SortableTableSortState): void {
    this.recordingsSortKey = state.key || MeetingMinutesTableColumn.STARTED_AT;
    this.recordingsSortDirection = state.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.uiActions.updateQueryParameters({
      [StoredValue.MEETING_RECORDINGS_SORT]: this.recordingsSortKey ? this.stringUtils.kebabCase(this.recordingsSortKey) : null,
      [StoredValue.MEETING_RECORDINGS_SORT_ORDER]: this.recordingsSortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC
    });
  }

  onVideoCallsSortChange(state: SortableTableSortState): void {
    this.videoCallsSortKey = state.key || MeetingMinutesTableColumn.STARTED_AT;
    this.videoCallsSortDirection = state.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.uiActions.updateQueryParameters({
      [StoredValue.MEETING_VIDEO_CALLS_SORT]: this.videoCallsSortKey ? this.stringUtils.kebabCase(this.videoCallsSortKey) : null,
      [StoredValue.MEETING_VIDEO_CALLS_SORT_ORDER]: this.videoCallsSortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC
    });
  }

  private applyMinutesSortFromUrl(sortParam: string | null, sortOrderParam: string | null): void {
    const matchedSortKey = this.minutesColumns
      .map(column => column.sortKey)
      .filter(Boolean)
      .find(key => this.stringUtils.kebabCase(key) === sortParam);
    if (matchedSortKey) {
      this.minutesSortKey = matchedSortKey;
    }
    if (sortOrderParam === SortDirection.DESC) {
      this.minutesSortDirection = DESCENDING;
    } else if (sortOrderParam === SortDirection.ASC) {
      this.minutesSortDirection = ASCENDING;
    }
  }

  private applyRecordingsSortFromUrl(sortParam: string | null, sortOrderParam: string | null): void {
    const matchedSortKey = this.minutesColumns
      .map(column => column.sortKey)
      .filter(Boolean)
      .find(key => this.stringUtils.kebabCase(key) === sortParam);
    if (matchedSortKey) {
      this.recordingsSortKey = matchedSortKey;
    }
    if (sortOrderParam === SortDirection.DESC) {
      this.recordingsSortDirection = DESCENDING;
    } else if (sortOrderParam === SortDirection.ASC) {
      this.recordingsSortDirection = ASCENDING;
    }
  }

  private applyVideoCallsSortFromUrl(sortParam: string | null, sortOrderParam: string | null): void {
    const matchedSortKey = this.videoCallColumns
      .map(column => column.sortKey)
      .filter(Boolean)
      .find(key => this.stringUtils.kebabCase(key) === sortParam);
    if (matchedSortKey) {
      this.videoCallsSortKey = matchedSortKey;
    }
    if (sortOrderParam === SortDirection.DESC) {
      this.videoCallsSortDirection = DESCENDING;
    } else if (sortOrderParam === SortDirection.ASC) {
      this.videoCallsSortDirection = ASCENDING;
    }
  }

  joinVideoCall(item: RecentVideoCall): void {
    if (item.room) {
      this.rememberRoom(item.room);
      this.router.navigate(["/" + AdminPath.MEETING_ROOM, item.room]);
    } else {
      this.logger.info("video call has no room to join", item.id);
    }
  }

  confirmDeleteVideoCall(item: RecentVideoCall): void {
    this.deletingVideoCall = item;
    this.deleteError = "";
  }

  cancelDeleteVideoCall(): void {
    this.deletingVideoCall = null;
    this.deleteError = "";
  }

  async deleteVideoCall(): Promise<void> {
    const item = this.deletingVideoCall;
    if (!item) {
      this.logger.info("no video call selected to delete");
    } else {
      this.deleting = true;
      this.deleteError = "";
      try {
        const file = await this.committeeFileService.getById(item.id);
        await this.committeeFileService.removeFromCommitteeDocumentsPage(file);
        await this.committeeFileService.delete(file);
        this.deletingVideoCall = null;
        await this.loadRecentVideoCalls();
      } catch (error) {
        this.logger.error("failed to delete video call", item.id, error);
        await this.loadRecentVideoCalls();
        if (!this.videoCalls.some(row => row.id === item.id)) {
          this.deletingVideoCall = null;
          this.deleteError = "";
        } else {
          this.deleteErrorTitle = "Could not delete video call";
          this.deleteError = "Please try again in a moment.";
        }
      }
      this.deleting = false;
    }
  }

  confirmDiscardRecording(item: MeetingMinutesSummary): void {
    this.discardingRecording = item;
    this.writeError = "";
  }

  cancelDiscardRecording(): void {
    this.discardingRecording = null;
    this.writeError = "";
  }

  async discardRecording(): Promise<void> {
    const item = this.discardingRecording;
    if (!item) {
      this.logger.info("no recording selected to discard");
    } else {
      this.discarding = true;
      this.writeError = "";
      try {
        await this.videoMeetingsService.deleteTranscript(item.room);
        this.discardingRecording = null;
        await this.loadRecordingsNeedingMinutes();
      } catch (error) {
        this.logger.error("failed to discard recording", item.room, error);
        await this.loadRecordingsNeedingMinutes();
        if (!this.recordingsNeedingMinutes.some(row => row.room === item.room)) {
          this.discardingRecording = null;
          this.writeError = "";
        } else {
          this.writeErrorTitle = "Could not discard recording";
          this.writeError = "Please try again in a moment.";
        }
      }
      this.discarding = false;
    }
  }

  async writeMinutesFromRecording(item: MeetingMinutesSummary): Promise<void> {
    this.writingRoom = item.room;
    this.writeError = "";
    try {
      await this.videoMeetingsService.writeMinutes(item.room, {transcript: "", chat: "", startedAt: null}, "", false);
      await this.loadRecentMinutes();
      await this.loadRecordingsNeedingMinutes();
      this.router.navigate(["/" + this.minutesPath, item.room]);
    } catch (error) {
      this.logger.error("failed to write minutes from recording", item.room, error);
      this.writeErrorTitle = "Could not write minutes";
      this.writeError = "Please try again in a moment.";
    }
    this.writingRoom = null;
  }

  private defaultMeetingTitle(): string {
    const today = this.dateUtils.asString(this.dateUtils.nowAsValue(), null, UIDateFormat.DISPLAY_DATE_NO_COMMA);
    return suggestedVideoMeetingTitle("Video call", today);
  }

  get displayName(): string {
    const member = this.memberLoginService.loggedInMember();
    return [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName || "Member";
  }

  async startMeeting(): Promise<void> {
    this.starting = true;
    const title = this.meetingTitle.trim() || this.defaultMeetingTitle();
    const now = this.dateUtils.nowAsValue();
    const dateSlug = videoMeetingDateSlug(this.dateUtils.asString(now, null, UIDateFormat.DISPLAY_DATE_NO_DAY));
    const room = this.videoMeetingsService.generateRoomName(title, dateSlug);
    const member = this.memberLoginService.loggedInMember();
    try {
      await this.committeeFileService.createOrUpdate({
        id: null,
        fileType: "",
        eventDate: now,
        createdDate: now,
        meeting: {
          format: CommitteeMeetingFormat.ONLINE,
          room,
          title,
          createdBy: member?.memberId,
          createdByName: [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName
        }
      });
    } catch (error) {
      this.logger.error("failed to save meeting title", error);
    }
    this.rememberRoom(room);
    this.router.navigate(["/" + AdminPath.MEETING_ROOM, room], {
      queryParams: {[StoredValue.MEETING_TITLE]: title}
    });
  }

  planMeeting(): void {
    this.openPlannedMeeting({
      title: null,
      startTime: this.banner?.suggestedDateValue()
    });
  }

  openPlannedMeeting(meeting: UpcomingBookedMeeting): void {
    const date = meeting?.startTime ? this.dateUtils.yearMonthDayWithDashes(meeting.startTime) : null;
    const queryParams = date ? {
      [StoredValue.PLAN_DATE]: date,
      [StoredValue.CALENDAR_DATE]: date,
      ...(meeting.title ? {[StoredValue.MEETING_TYPE]: meeting.title} : {}),
      ...(meeting.committeeFileId ? {[StoredValue.COMMITTEE_FILE_ID]: meeting.committeeFileId} : {})
    } : {};
    this.router.navigate(["/" + AdminPath.MEETING_PLAN], date ? {queryParams} : {});
  }

  get canJoin(): boolean {
    return !!this.extractRoom(this.joinRoom);
  }

  join(): void {
    const room = this.extractRoom(this.joinRoom);
    if (room) {
      this.rememberRoom(room);
      this.router.navigate(["/" + AdminPath.MEETING_ROOM, room]);
    }
  }

  private rememberRoom(room: string): void {
    try {
      rememberActiveMeetingRoom(room, window.sessionStorage);
    } catch (error) {
      this.logger.info("could not remember the meeting room", error);
    }
  }

  private extractRoom(input: string): string {
    const trimmed = (input || "").trim();
    const roomPathMatch = trimmed.match(/\/room\/([^/?#]+)/);
    if (!trimmed) {
      return "";
    } else if (roomPathMatch) {
      return decodeURIComponent(roomPathMatch[1]);
    } else if (/^https?:\/\//i.test(trimmed)) {
      const segments = trimmed.split(/[?#]/)[0].split("/").filter(Boolean);
      return decodeURIComponent(segments[segments.length - 1] || "");
    } else {
      return trimmed.replace(/\s+/g, "-");
    }
  }
}
