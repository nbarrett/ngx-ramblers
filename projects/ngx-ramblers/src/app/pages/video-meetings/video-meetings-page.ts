import { Component, inject, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { kebabCase } from "es-toolkit/compat";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCalendarDays, faFileLines, faRightToBracket, faVideo } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { CommitteeMeetingFormat } from "../../models/committee.model";
import { MemberLoginService } from "../../services/member/member-login.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { PageComponent } from "../../page/page.component";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { NextCommitteeMeetingBannerComponent } from "./next-committee-meeting-banner";
import { ThumbnailHeadingFrameComponent } from "../../modules/common/thumbnail-heading-frame/thumbnail-heading-frame";
import { MEETING_MINUTES_TEMPLATE_ID, MeetingMinutesSummary, UpcomingBookedMeeting, VideoMeetingRuntimeConfig } from "../../models/video-meeting.model";
import { meetingMinutesDocumentSlug } from "../../functions/committee-documents-page";
import { AdminPath, AdminSettingsPath } from "../../models/admin-route-paths.model";
import { SystemSettingsTab } from "../../models/system.model";
import { StoredValue } from "../../models/ui-actions";
import { UIDateFormat } from "../../models/date-format.model";
import { suggestedVideoMeetingTitle, videoMeetingDateSlug } from "../../functions/video-meeting-join";
import { meetingMinutesDateLabel } from "../../functions/video-meeting-minutes";
import { rememberActiveMeetingRoom } from "../../functions/video-meeting-client";

@Component({
  selector: "app-video-meetings-page",
  imports: [FormsModule, FontAwesomeModule, PageComponent, AlertPanelComponent, NextCommitteeMeetingBannerComponent, RouterLink, ThumbnailHeadingFrameComponent],
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
          @if (recentMinutes.length) {
            <app-thumbnail-heading-frame heading="Recent meeting minutes" class="d-block">
              @for (item of recentMinutes; track item.room; let first = $first) {
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 py-2"
                     [class.border-top]="!first">
                  <div>
                    <div>{{ item.title }}</div>
                    @if (item.dateLabel) {
                      <div class="small text-muted">{{ item.dateLabel }}</div>
                    }
                  </div>
                  <a class="btn btn-quiet" [routerLink]="'/' + minutesPath + '/' + item.room">
                    <fa-icon [icon]="faFileLines" class="me-2"/>View minutes
                  </a>
                </div>
              }
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

  config: VideoMeetingRuntimeConfig;
  joinRoom = "";
  meetingTitle = "";
  starting = false;
  recentMinutes: MeetingMinutesSummary[] = [];

  protected readonly faVideo = faVideo;
  protected readonly faRightToBracket = faRightToBracket;
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly faFileLines = faFileLines;
  protected readonly systemSettingsPath = AdminSettingsPath.SYSTEM_SETTINGS;
  protected readonly videoMeetingsTab = kebabCase(SystemSettingsTab.VIDEO_MEETINGS);
  protected readonly minutesPath = AdminPath.MEETING_MINUTES;

  async ngOnInit(): Promise<void> {
    this.meetingTitle = this.defaultMeetingTitle();
    void this.loadRecentMinutes();
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
          pagePath,
          slug: pagePath ? meetingMinutesDocumentSlug(file.meeting.room) : null
        };
      }));
    } catch (error) {
      this.logger.info("could not load recent meeting minutes", error);
    }
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
