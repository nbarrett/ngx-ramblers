import { Component, inject, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCalendarDays, faCircleExclamation, faRightToBracket, faVideo } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { PageComponent } from "../../page/page.component";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { NextCommitteeMeetingBannerComponent } from "./next-committee-meeting-banner";
import { VideoMeetingRuntimeConfig } from "../../models/video-meeting.model";
import { AdminPath } from "../../models/admin-route-paths.model";
import { StoredValue } from "../../models/ui-actions";

@Component({
  selector: "app-video-meetings-page",
  imports: [FormsModule, FontAwesomeModule, PageComponent, AlertPanelComponent, NextCommitteeMeetingBannerComponent],
  styleUrls: ["./video-meetings-page.sass"],
  template: `
    <app-page pageTitle="Video meetings">
      @if (config && !config.enabled) {
        <app-alert-panel title="Video meetings are switched off">
          An administrator can enable them under System Settings → Video Meetings.
        </app-alert-panel>
      } @else {
        <app-next-committee-meeting-banner (plan)="planFromSuggestion($event)"/>
        <div class="video-meetings-intro">
          <div class="row g-3">
            <div class="col-12 col-md-6">
              <div class="row thumbnail-heading-frame h-100">
                <div class="thumbnail-heading">Start a meeting</div>
                <div class="col-sm-12">
                  <p>Spin up a private meeting room and share the link with your group. It runs in the browser, with
                    gallery view, screen sharing, chat and shared notes.</p>
                  <div class="d-flex flex-wrap gap-2">
                    <button type="button" class="btn btn-primary btn-sm flex-fill" (click)="startMeeting()">
                      <fa-icon [icon]="faVideo" class="me-2"/>Start a meeting now
                    </button>
                    <button type="button" class="btn btn-primary btn-sm flex-fill" (click)="planMeeting()">
                      <fa-icon [icon]="faCalendarDays" class="me-2"/>Plan a meeting for later
                    </button>
                  </div>
                  @if (config) {
                    <p class="text-muted small mt-3 mb-0">You will join as <strong>{{ displayName }}</strong>. Powered by
                      open-source Jitsi{{ config.jwtRequired ? " on our own server" : "" }}.</p>
                  }
                  @if (config?.publicHost) {
                    <div class="alert alert-warning mt-3 mb-0 d-flex align-items-start">
                      <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
                      <div>
                        <strong>Starting a room on the free public Jitsi service</strong>
                        <div>The first person has to sign in with Google or GitHub on Jitsi's own screen. That is not your NGX login, and being a committee member here does not make you a Jitsi moderator. Point Video Meetings at your own Jitsi host with JWT and committee members start the room automatically.</div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
            <div class="col-12 col-md-6">
              <div class="row thumbnail-heading-frame h-100">
                <div class="thumbnail-heading">Join a meeting</div>
                <div class="col-sm-12">
                  <label class="form-label" for="joinRoom">Paste a meeting link, or type a room name</label>
                  <input id="joinRoom" class="form-control" [(ngModel)]="joinRoom" (keydown.enter)="join()"
                         placeholder="e.g. ngx-abcd-efgh or a full invite link">
                  <button type="button" class="btn btn-primary btn-sm w-100 mt-2" (click)="join()">
                    <fa-icon [icon]="faRightToBracket" class="me-2"/>Join
                  </button>
                </div>
              </div>
            </div>
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

  protected readonly faVideo = faVideo;
  protected readonly faRightToBracket = faRightToBracket;
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly faCircleExclamation = faCircleExclamation;

  async ngOnInit(): Promise<void> {
    try {
      this.config = await this.videoMeetingsService.config();
    } catch (error) {
      this.logger.error("failed to load video meeting config", error);
    }
  }

  get displayName(): string {
    const member = this.memberLoginService.loggedInMember();
    return [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName || "Member";
  }

  startMeeting(): void {
    const room = this.videoMeetingsService.generateRoomName(this.config?.roomPrefix);
    this.router.navigate(["/admin/video-meetings/room", room]);
  }

  planMeeting(): void {
    this.planFromSuggestion(this.banner?.suggestedDateValue());
  }

  planFromSuggestion(dayValue: number): void {
    const date = dayValue ? this.dateUtils.yearMonthDayWithDashes(dayValue) : null;
    this.router.navigate(["/" + AdminPath.VIDEO_MEETING_PLAN], date ? {
      queryParams: {
        [StoredValue.PLAN_DATE]: date,
        [StoredValue.CALENDAR_DATE]: date
      }
    } : {});
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
