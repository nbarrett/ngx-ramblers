import { AfterViewInit, Component, ElementRef, inject, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCompress, faComments, faExpand, faPaperPlane, faRightFromBracket, faUserPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { VideoMeetingNotesComponent } from "./video-meeting-notes";
import { JitsiJoinMode, MeetingSpeechCapture, VideoMeetingRuntimeConfig } from "../../models/video-meeting.model";
import { jitsiHostPageUrl, jitsiJoinMode } from "../../functions/video-meeting-join";
import { StoredValue } from "../../models/ui-actions";
import { AdminPath } from "../../models/admin-route-paths.model";
import { appendUniqueLine, lineFromJitsiChat, lineFromJitsiTranscription } from "../../functions/video-meeting-minutes";

declare const JitsiMeetExternalAPI: any;

const TEAMS_LIKE_TOOLBAR = [
  "microphone", "camera", "desktop", "chat", "raisehand", "reactions",
  "participants-pane", "tileview", "settings", "videoquality", "fullscreen", "hangup"
];

@Component({
  selector: "app-video-meeting-room",
  imports: [FormsModule, FontAwesomeModule, AlertPanelComponent, VideoMeetingNotesComponent],
  styleUrls: ["./video-meeting-room.sass"],
  template: `
    <div class="meeting-shell" [class.fullscreen]="fullscreen">
      @if (error) {
        <div class="meeting-message">
          <app-alert-panel title="Video meeting unavailable">{{ error }}</app-alert-panel>
        </div>
      }
      <header class="meeting-bar">
        <button type="button" class="meeting-bar-btn leave" (click)="leave()">
          <fa-icon [icon]="faRightFromBracket"/>
          <span class="meeting-bar-label">Leave</span>
        </button>
        <span class="meeting-bar-room">{{ displayTitle }}</span>
        <span class="meeting-bar-spacer"></span>
        <button type="button" class="meeting-bar-btn" (click)="toggleFullscreen()">
          <fa-icon [icon]="fullscreen ? faCompress : faExpand"/>
          <span class="meeting-bar-label">{{ fullscreen ? "Restore" : "Full screen" }}</span>
        </button>
        @if (!guest) {
          <button type="button" class="meeting-bar-btn" [class.active]="showInvite" (click)="toggleInvite()">
            <fa-icon [icon]="faUserPlus"/>
            <span class="meeting-bar-label">Invite</span>
          </button>
        }
        @if (notesEnabled) {
          <button type="button" class="meeting-bar-btn" [class.active]="showNotes" (click)="toggleNotes()">
            <fa-icon [icon]="faComments"/>
            <span class="meeting-bar-label">Notes</span>
          </button>
        }
      </header>

      <div class="meeting-body">
        <div #jitsiContainer class="meeting-frame" [class.cover-host-branding]="coverHostBranding"></div>

        @if (connecting && !error) {
          <div class="meeting-connecting">
            <div class="meeting-connecting-spinner"></div>
            <span>{{ connectingMessage }}</span>
          </div>
        }

        @if (showInvite || (showNotes && notesEnabled)) {
          <div class="meeting-dialog-scrim" (click)="closePanels()"></div>
        }

        @if (!guest && showInvite) {
          <div class="meeting-dialog">
            <div class="meeting-dialog-head">
              <span>Invite a guest by email</span>
              <button type="button" class="meeting-dialog-close" aria-label="Close" (click)="toggleInvite()">
                <fa-icon [icon]="faXmark"/>
              </button>
            </div>
            <div class="meeting-dialog-body">
              <label class="form-label" for="guest-email">Guest email</label>
              <input id="guest-email" class="form-control" type="email" [(ngModel)]="inviteEmail"
                     placeholder="name@example.com">
              <label class="form-label mt-2" for="guest-name">Guest name (optional)</label>
              <input id="guest-name" class="form-control" type="text" [(ngModel)]="inviteName" placeholder="Their name">
              <button type="button" class="btn btn-primary btn-sm w-100 mt-3" (click)="sendInvite()">
                <fa-icon [icon]="faPaperPlane" class="me-2"/>Send invite
              </button>
              @if (inviteStatus) {
                <p class="text-muted small mt-2 mb-0">{{ inviteStatus }}</p>
              }
              @if (inviteLink) {
                <label class="form-label mt-2" for="guest-link">Invite link</label>
                <input id="guest-link" class="form-control" [value]="inviteLink" readonly (focus)="selectAll($event)">
              }
            </div>
          </div>
        }

        @if (notesEnabled && showNotes) {
          <div class="meeting-dialog notes">
            <button type="button" class="meeting-dialog-close floating" aria-label="Close" (click)="toggleNotes()">
              <fa-icon [icon]="faXmark"/>
            </button>
            <app-video-meeting-notes [room]="room" [guest]="guest" [capture]="speechCapture"/>
          </div>
        }
      </div>
    </div>`
})
export class VideoMeetingRoomComponent implements OnInit, AfterViewInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("VideoMeetingRoomComponent", NgxLoggerLevel.ERROR);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private videoMeetingsService = inject(VideoMeetingsService);
  private committeeFileService = inject(CommitteeFileService);
  private memberLoginService = inject(MemberLoginService);
  private zone = inject(NgZone);

  @ViewChild("jitsiContainer") private jitsiContainer: ElementRef<HTMLDivElement>;

  room: string;
  displayTitle = "";
  guest = false;
  error: string;
  notesEnabled = false;
  showNotes = false;
  showInvite = false;
  inviteEmail = "";
  inviteName = "";
  inviteStatus = "";
  inviteLink = "";
  connecting = false;
  connectingMessage = "Connecting to your meeting…";
  fullscreen = false;
  coverHostBranding = false;
  speechCapture: MeetingSpeechCapture = {transcript: "", chat: ""};

  private config: VideoMeetingRuntimeConfig;
  private api: any;
  private transcriptLines: string[] = [];
  private chatLines: string[] = [];
  private connectingTimers: number[] = [];

  protected readonly faComments = faComments;
  protected readonly faRightFromBracket = faRightFromBracket;
  protected readonly faUserPlus = faUserPlus;
  protected readonly faXmark = faXmark;
  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faExpand = faExpand;
  protected readonly faCompress = faCompress;

  ngOnInit(): void {
    this.room = this.route.snapshot.paramMap.get("room");
    this.displayTitle = (this.room || "").replace(/-/g, " ");
    this.guest = !!this.route.snapshot.data?.["guest"];
  }

  async ngAfterViewInit(): Promise<void> {
    await this.start();
  }

  private async start(): Promise<void> {
    try {
      this.showConnecting();
      this.config = await this.videoMeetingsService.config();
      if (this.config.enabled) {
        this.notesEnabled = this.config.enableNotes && !this.config.publicHost;
        if (jitsiJoinMode(this.config.publicHost) === JitsiJoinMode.HOST_PAGE) {
          window.location.assign(jitsiHostPageUrl(this.config.host, this.room, await this.meetingSubject()));
        } else {
          const token = await this.resolveToken();
          await this.videoMeetingsService.loadExternalApi(this.config.host);
          await this.mountMeeting(token);
        }
      } else {
        this.hideConnecting();
        this.error = "Video meetings are switched off for this site.";
      }
    } catch (error) {
      this.logger.error("failed to start meeting", error);
      this.hideConnecting();
      this.error = "We could not start the meeting. Please try again, or contact an administrator if it keeps happening.";
    }
  }

  private showConnecting(): void {
    this.connecting = true;
    this.connectingMessage = "Connecting to your meeting…";
    this.connectingTimers.push(window.setTimeout(() => this.zone.run(() => {
      if (this.connecting) {
        this.connectingMessage = "Starting the meeting server — this can take up to a minute…";
      }
    }), 8000));
    this.connectingTimers.push(window.setTimeout(() => this.zone.run(() => this.hideConnecting()), 90000));
  }

  private hideConnecting(): void {
    this.connecting = false;
    this.connectingTimers.forEach(timer => window.clearTimeout(timer));
    this.connectingTimers = [];
  }

  private async meetingSubject(): Promise<string> {
    const fromQuery = this.route.snapshot.queryParamMap.get(StoredValue.MEETING_TITLE)?.trim();
    if (fromQuery) {
      this.displayTitle = fromQuery;
      return fromQuery;
    } else {
      try {
        const planned = await this.committeeFileService.meetingFileByRoom(this.room);
        const title = (planned?.document?.title || planned?.meeting?.title)?.trim() || this.config.brandName || "Ramblers video meeting";
        this.displayTitle = title;
        return title;
      } catch (error) {
        this.logger.info("no planned meeting title for room", this.room, error);
        const title = this.config.brandName || "Ramblers video meeting";
        this.displayTitle = title;
        return title;
      }
    }
  }

  private async resolveToken(): Promise<string> {
    const urlToken = this.route.snapshot.queryParamMap.get("t");
    if (this.guest && urlToken) {
      return urlToken;
    } else if (this.guest && this.config.jwtRequired) {
      return this.videoMeetingsService.guestToken(this.room);
    } else if (!this.guest && this.config.jwtRequired) {
      return (await this.videoMeetingsService.requestToken(this.room)).token;
    } else {
      return undefined;
    }
  }

  private async mountMeeting(token: string): Promise<void> {
    const domain = new URL(this.config.host).host;
    const subject = await this.meetingSubject();
    const options: any = {
      roomName: this.room,
      parentNode: this.jitsiContainer.nativeElement,
      width: "100%",
      height: "100%",
      jwt: token || undefined,
      configOverwrite: {
        prejoinPageEnabled: this.guest && this.config.enableLobby,
        prejoinConfig: {enabled: this.guest && this.config.enableLobby},
        startWithAudioMuted: this.config.startWithAudioMuted,
        startWithVideoMuted: this.config.startWithVideoMuted,
        disableDeepLinking: true,
        defaultLogoUrl: "",
        toolbarButtons: TEAMS_LIKE_TOOLBAR,
        transcription: {enabled: true},
        transcribingEnabled: true,
        subject
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        SHOW_POWERED_BY: false,
        SHOW_CHROME_EXTENSION_BANNER: false,
        HIDE_DEEP_LINKING_LOGO: true,
        DEFAULT_LOGO_URL: "",
        DEFAULT_WELCOME_PAGE_LOGO_URL: "",
        JITSI_WATERMARK_LINK: "",
        MOBILE_APP_PROMO: false,
        TILE_VIEW_MAX_COLUMNS: 3,
        DEFAULT_BACKGROUND: "#1a1a1a"
      }
    };
    if (!this.guest) {
      const member = this.memberLoginService.loggedInMember();
      options.userInfo = {
        displayName: [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName || "Member"
      };
    }
    this.api = new JitsiMeetExternalAPI(domain, options);
    const iframe = this.api.getIFrame?.() as HTMLIFrameElement;
    iframe?.addEventListener("load", () => this.zone.run(() => {
      this.hideConnecting();
      this.hideHostBranding();
    }));
    this.api.addEventListener("videoConferenceJoined", () => this.zone.run(() => {
      this.hideConnecting();
      this.hideHostBranding();
      this.startCaptions();
    }));
    this.api.addEventListener("readyToClose", () => this.zone.run(() => this.leave()));
    this.api.addEventListener("transcriptionChunkReceived", (payload: unknown) => this.zone.run(() => {
      this.recordTranscript(lineFromJitsiTranscription(payload));
    }));
    this.api.addEventListener("incomingMessage", (payload: unknown) => this.zone.run(() => {
      this.recordChat(lineFromJitsiChat(payload));
    }));
    this.api.addEventListener("outgoingMessage", (payload: unknown) => this.zone.run(() => {
      this.recordChat(lineFromJitsiChat(payload));
    }));
    this.hideHostBranding();
  }

  private startCaptions(): void {
    try {
      this.api?.executeCommand?.("setSubtitles", true);
    } catch (error) {
      this.logger.info("could not start meeting captions", error);
    }
  }

  private recordTranscript(line: string | null): void {
    this.transcriptLines = appendUniqueLine(this.transcriptLines, line);
    this.speechCapture = {transcript: this.transcriptLines.join("\n"), chat: this.chatLines.join("\n")};
  }

  private recordChat(line: string | null): void {
    this.chatLines = appendUniqueLine(this.chatLines, line);
    this.speechCapture = {transcript: this.transcriptLines.join("\n"), chat: this.chatLines.join("\n")};
  }

  private hideHostBranding(): void {
    try {
      const iframe = this.api?.getIFrame?.() as HTMLIFrameElement;
      const head = iframe?.contentDocument?.head;
      if (head) {
        const style = iframe.contentDocument.createElement("style");
        style.textContent = ".leftwatermark,.rightwatermark,.watermark,#new-watermark{display:none!important}";
        head.appendChild(style);
        this.coverHostBranding = false;
      } else {
        this.coverHostBranding = true;
      }
    } catch (error) {
      this.logger.info("host branding is not writable from the parent page", error);
      this.coverHostBranding = true;
    }
  }

  toggleNotes(): void {
    this.showNotes = !this.showNotes;
    if (this.showNotes) {
      this.showInvite = false;
    }
  }

  toggleInvite(): void {
    this.showInvite = !this.showInvite;
    if (this.showInvite) {
      this.showNotes = false;
    }
  }

  closePanels(): void {
    this.showNotes = false;
    this.showInvite = false;
  }

  toggleFullscreen(): void {
    this.fullscreen = !this.fullscreen;
  }

  selectAll(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  async sendInvite(): Promise<void> {
    const email = this.inviteEmail.trim();
    if (email) {
      this.inviteStatus = "Sending…";
      this.inviteLink = "";
      try {
        const response = await this.videoMeetingsService.inviteGuest(this.room, email, this.inviteName.trim());
        if (response.sent) {
          this.inviteStatus = `Invite sent to ${email}.`;
          this.inviteEmail = "";
          this.inviteName = "";
        } else {
          this.inviteStatus = "We could not send that automatically — copy the link below and send it yourself.";
          this.inviteLink = response.link;
        }
      } catch (error) {
        this.logger.error("failed to send guest invite", error);
        this.inviteStatus = "We could not send that invite. Please check the email address and try again.";
      }
    } else {
      this.inviteStatus = "Please enter the guest's email address.";
    }
  }

  leave(): void {
    this.disposeApi();
    this.router.navigate([this.guest ? "/" : "/" + AdminPath.MEETINGS]);
  }

  private disposeApi(): void {
    if (this.api) {
      this.api.dispose();
      this.api = undefined;
    }
  }

  ngOnDestroy(): void {
    this.hideConnecting();
    this.disposeApi();
  }
}
