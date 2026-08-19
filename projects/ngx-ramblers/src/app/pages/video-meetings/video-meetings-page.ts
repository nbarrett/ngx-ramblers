import { Component, inject, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { kebabCase } from "es-toolkit/compat";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCalendarDays, faRightToBracket, faVideo } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { PageComponent } from "../../page/page.component";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { NextCommitteeMeetingBannerComponent } from "./next-committee-meeting-banner";
import { ThumbnailHeadingFrameComponent } from "../../modules/common/thumbnail-heading-frame/thumbnail-heading-frame";
import { UpcomingBookedMeeting, VideoMeetingRuntimeConfig } from "../../models/video-meeting.model";
import { AdminPath, AdminSettingsPath } from "../../models/admin-route-paths.model";
import { SystemSettingsTab } from "../../models/system.model";
import { StoredValue } from "../../models/ui-actions";
import { UIDateFormat } from "../../models/date-format.model";
import { suggestedVideoMeetingTitle, videoMeetingDateSlug } from "../../functions/video-meeting-join";

@Component({
  selector: "app-video-meetings-page",
  imports: [FormsModule, FontAwesomeModule, PageComponent, AlertPanelComponent, NextCommitteeMeetingBannerComponent, RouterLink, ThumbnailHeadingFrameComponent],
  template: `
    <app-page pageTitle="Video meetings">
      @if (config && !config.enabled) {
        <app-alert-panel title="Video meetings are switched off">
          An administrator can enable them in
          <a [routerLink]="'/' + systemSettingsPath" [queryParams]="{tab: videoMeetingsTab}">System Settings</a>.
        </app-alert-panel>
      } @else {
        <app-next-committee-meeting-banner (plan)="openPlannedMeeting($event)"/>
        <div class="row">
          <div class="col-sm-6">
            <app-thumbnail-heading-frame heading="Start a meeting">
              <p>Spin up a private meeting room and share the link with your group. It runs in the browser, with
                gallery view, screen sharing, chat and shared notes.</p>
              <div class="form-group">
                <label for="start-title">Meeting name</label>
                <input id="start-title" class="form-control input-sm" [(ngModel)]="meetingTitle"
                       placeholder="e.g. August committee meeting">
              </div>
              <div class="d-flex flex-wrap gap-2">
                <button type="button" class="btn btn-primary flex-fill" (click)="startMeeting()">
                  <fa-icon [icon]="faVideo" class="me-2"/>Start a meeting now
                </button>
                <button type="button" class="btn btn-primary flex-fill" (click)="planMeeting()">
                  <fa-icon [icon]="faCalendarDays" class="me-2"/>Plan a meeting for later
                </button>
              </div>
              @if (config) {
                <p class="form-text text-muted mt-3 mb-0">You will join as <strong>{{ displayName }}</strong>.</p>
              }
              @if (config?.publicHost) {
                <app-alert-panel class="mt-3" title="Meetings open in a public room">
                  The first person signs in to start the room. To keep meetings on this site, set a host in
                  <a [routerLink]="'/' + systemSettingsPath" [queryParams]="{tab: videoMeetingsTab}">System Settings</a>.
                </app-alert-panel>
              }
            </app-thumbnail-heading-frame>
          </div>
          <div class="col-sm-6">
            <app-thumbnail-heading-frame heading="Join a meeting">
              <div class="form-group">
                <label for="joinRoom">Paste a meeting link, or type a room name</label>
                <input id="joinRoom" class="form-control input-sm" [(ngModel)]="joinRoom" (keydown.enter)="join()"
                       placeholder="Paste a meeting link">
              </div>
              <button type="button" class="btn btn-primary" [disabled]="!canJoin" (click)="join()">
                <fa-icon [icon]="faRightToBracket" class="me-2"/>Join
              </button>
            </app-thumbnail-heading-frame>
          </div>
        </div>
      }
    </app-page>`
})
export class VideoMeetingsPageComponent implements OnInit {

  @ViewChild(NextCommitteeMeetingBannerComponent) banner: NextCommitteeMeetingBannerComponent;

  private logger: Logger = inject(LoggerFactory).createLogger("VideoMeetingsPageComponent", NgxLoggerLevel.ERROR);
  private router = inject(Router);
  private videoMeetingsService = inject(VideoMeetingsService);
  private memberLoginService = inject(MemberLoginService);
  private dateUtils = inject(DateUtilsService);

  config: VideoMeetingRuntimeConfig;
  joinRoom = "";
  meetingTitle = "";

  protected readonly faVideo = faVideo;
  protected readonly faRightToBracket = faRightToBracket;
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly systemSettingsPath = AdminSettingsPath.SYSTEM_SETTINGS;
  protected readonly videoMeetingsTab = kebabCase(SystemSettingsTab.VIDEO_MEETINGS);

  async ngOnInit(): Promise<void> {
    this.meetingTitle = this.defaultMeetingTitle();
    try {
      this.config = await this.videoMeetingsService.config();
    } catch (error) {
      this.logger.error("failed to load video meeting config", error);
    }
  }

  private defaultMeetingTitle(): string {
    const today = this.dateUtils.asString(this.dateUtils.nowAsValue(), null, UIDateFormat.DISPLAY_DATE_NO_COMMA);
    return suggestedVideoMeetingTitle("Video meeting", today);
  }

  get displayName(): string {
    const member = this.memberLoginService.loggedInMember();
    return [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName || "Member";
  }

  async startMeeting(): Promise<void> {
    const title = this.meetingTitle.trim() || this.defaultMeetingTitle();
    const now = this.dateUtils.nowAsValue();
    const dateSlug = videoMeetingDateSlug(this.dateUtils.asString(now, null, UIDateFormat.DISPLAY_DATE_NO_DAY));
    const room = this.videoMeetingsService.generateRoomName(title, dateSlug);
    const member = this.memberLoginService.loggedInMember();
    try {
      await this.videoMeetingsService.createPlannedMeeting({
        room,
        title,
        startTime: now,
        createdAt: now,
        createdBy: member?.memberId,
        createdByName: [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName
      });
    } catch (error) {
      this.logger.error("failed to save meeting title", error);
    }
    this.router.navigate(["/admin/video-meetings/room", room], {
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
      ...(meeting.title ? {[StoredValue.MEETING_TYPE]: meeting.title} : {})
    } : {};
    this.router.navigate(["/" + AdminPath.VIDEO_MEETING_PLAN], date ? {queryParams} : {});
  }

  get canJoin(): boolean {
    return !!this.extractRoom(this.joinRoom);
  }

  join(): void {
    const room = this.extractRoom(this.joinRoom);
    if (room) {
      this.router.navigate(["/admin/video-meetings/room", room]);
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
