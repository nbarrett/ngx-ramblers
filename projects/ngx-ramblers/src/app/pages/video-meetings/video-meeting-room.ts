import { AfterViewInit, Component, ElementRef, inject, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faArrowUpRightFromSquare,
  faCompress,
  faComments,
  faCopy,
  faExpand,
  faPaperPlane,
  faRightFromBracket,
  faUserPlus,
  faVideo,
  faVolumeHigh,
  faVolumeXmark,
  faXmark
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { ClipboardService } from "../../services/clipboard.service";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { VideoMeetingNotesComponent } from "./video-meeting-notes";
import {
  JitsiJoinMode,
  MeetingSpeechCapture,
  MeetingSpeechRecognition,
  SameRoomDetector,
  VideoMeetingClient,
  VideoMeetingMediaAction,
  VideoMeetingMediaHelp,
  VideoMeetingMediaIssue,
  VideoMeetingRoomPhase,
  VideoMeetingRuntimeConfig
} from "../../models/video-meeting.model";
import { AlertPanelVariant } from "../../models/alert-panel.model";
import { applyJitsiIframeAllow, jitsiEmbedConfigOverwrite, jitsiHostPageUrl, jitsiJoinMode } from "../../functions/video-meeting-join";
import { createSameRoomDetector } from "../../functions/same-room-detector";
import {
  activeMeetingRoom,
  clientHintsFromWindow,
  forgetActiveMeetingRoom,
  forgetMeetingNotesStartedAt,
  meetingNotesStartedAt,
  rememberActiveMeetingRoom,
  rememberMeetingNotesStartedAt,
  shouldAutoJoinMeeting,
  videoMeetingClient,
  videoMeetingJoinActionLabel,
  videoMeetingJoinGuidance,
  videoMeetingJoinTitle,
  videoMeetingMediaHelp
} from "../../functions/video-meeting-client";
import { StoredValue } from "../../models/ui-actions";
import { AdminPath } from "../../models/admin-route-paths.model";
import { appendUniqueLine, lineFromJitsiChat, lineFromJitsiTranscription } from "../../functions/video-meeting-minutes";
import { createMeetingSpeechRecognition, finalSpeechLines } from "../../functions/video-meeting-speech";

declare const JitsiMeetExternalAPI: any;

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
        @if (!guest && inMeeting) {
          <button type="button" class="meeting-bar-btn" [class.active]="showInvite" (click)="toggleInvite()">
            <fa-icon [icon]="faUserPlus"/>
            <span class="meeting-bar-label">Invite</span>
          </button>
        }
        @if (notesEnabled && inMeeting) {
          <button type="button" class="meeting-bar-btn notes-bar-btn" #notesButton
                  [class.active]="showNotes || notesCapturing"
                  [class.capturing]="notesCapturing" (click)="toggleNotes()">
            <span class="notes-bar-icon">
              <fa-icon [icon]="faComments"/>
            </span>
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

        @if (phase === roomPhase.READY && !error) {
          <div class="meeting-dialog-scrim"></div>
          <div class="meeting-dialog join">
            <div class="meeting-dialog-head">
              <span>{{ joinTitle }}</span>
            </div>
            <div class="meeting-dialog-body">
              <p class="meeting-join-lead">{{ joinGuidance }}</p>
              @if (client.inAppBrowser) {
                <button type="button" class="btn btn-primary w-100 meeting-join-action" (click)="copyMeetingLink()">
                  <fa-icon [icon]="faCopy" class="me-2"/>{{ joinActionLabel }}
                </button>
                <button type="button" class="btn btn-quiet w-100 meeting-join-action mt-2" (click)="openInRecommendedBrowser()">
                  <fa-icon [icon]="faArrowUpRightFromSquare" class="me-2"/>Open in {{ client.recommendedBrowserLabel }}
                </button>
              } @else {
                <button type="button" class="btn btn-primary w-100 meeting-join-action" (click)="joinMeeting()">
                  <fa-icon [icon]="faVideo" class="me-2"/>{{ joinActionLabel }}
                </button>
                <button type="button" class="btn btn-quiet w-100 meeting-join-action mt-2" (click)="joinSilent()">
                  <fa-icon [icon]="faVolumeXmark" class="me-2"/>Join without sound
                </button>
                <p class="meeting-same-room-note">
                  Already in the same room as someone who has joined? Join without sound so the audio stays on one
                  device in the room. You will still see everyone and can type in chat, without adding to the echo.
                </p>
              }
              @if (copyStatus) {
                <p class="meeting-copy-status">{{ copyStatus }}</p>
              }
            </div>
          </div>
        }

        @if (hearBanner) {
          <div class="meeting-help-banner">
            <app-alert-panel [title]="hearBanner.title" [icon]="faVolumeHigh" [variant]="alertWarning" actionsEnd>
              {{ hearBanner.body }}
              <button alertActions type="button" class="btn btn-quiet"
                      (click)="runMediaAction(hearBanner.primaryAction)">
                {{ hearBanner.primaryLabel }}
              </button>
            </app-alert-panel>
          </div>
        }

        @if (sameRoomPrompt) {
          <div class="meeting-help-banner">
            <app-alert-panel title="Another device in this room?" [icon]="faVolumeXmark" [variant]="alertWarning"
                             actionsEnd>
              It sounds like another device in this room is in the call, which is what causes the echo. Silence this
              device to fix it - the audio stays on the other device, and you can still see everyone and use chat.
              <button alertActions type="button" class="btn btn-quiet" (click)="dismissSameRoom()">Keep sound</button>
              <button alertActions type="button" class="btn btn-quiet" (click)="switchToSilent()">Silence this device
              </button>
            </app-alert-panel>
          </div>
        }

        @if (showInvite || mediaDialog) {
          <div class="meeting-dialog-scrim" (click)="closePanels()"></div>
        }

        @if (mediaDialog) {
          <div class="meeting-dialog">
            <div class="meeting-dialog-body">
              <app-alert-panel [title]="mediaDialog.title" [variant]="alertWarning">
                {{ mediaDialog.body }}
              </app-alert-panel>
              <button type="button" class="btn btn-primary w-100 meeting-join-action mt-3"
                      (click)="runMediaAction(mediaDialog.primaryAction)">
                {{ mediaDialog.primaryLabel }}
              </button>
              @if (mediaDialog.secondaryAction) {
                <button type="button" class="btn btn-quiet w-100 meeting-join-action mt-2"
                        (click)="runMediaAction(mediaDialog.secondaryAction)">
                  {{ mediaDialog.secondaryLabel }}
                </button>
              }
              @if (copyStatus) {
                <p class="meeting-copy-status">{{ copyStatus }}</p>
              }
            </div>
          </div>
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

      </div>
      @if (notesEnabled) {
        <app-video-meeting-notes [open]="showNotes" [room]="room" [guest]="guest" [capture]="speechCapture"
                                 [minimiseTarget]="notesButton?.nativeElement || null"
                                 (capturing)="notesCapturing = $event"
                                 (dismiss)="closeNotes()"/>
      }
    </div>`
})
export class VideoMeetingRoomComponent implements OnInit, AfterViewInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("VideoMeetingRoomComponent", NgxLoggerLevel.DEBUG);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private videoMeetingsService = inject(VideoMeetingsService);
  private committeeFileService = inject(CommitteeFileService);
  private memberLoginService = inject(MemberLoginService);
  private clipboardService = inject(ClipboardService);
  private dateUtils = inject(DateUtilsService);
  private zone = inject(NgZone);

  @ViewChild("jitsiContainer") private jitsiContainer: ElementRef<HTMLDivElement>;
  @ViewChild("notesButton") notesButton: ElementRef<HTMLButtonElement>;

  room: string;
  displayTitle = "";
  guest = false;
  error: string;
  notesEnabled = false;
  showNotes = false;
  notesCapturing = false;
  showInvite = false;
  inviteEmail = "";
  inviteName = "";
  inviteStatus = "";
  inviteLink = "";
  connecting = false;
  connectingMessage = "Preparing your meeting…";
  fullscreen = false;
  silentJoin = false;
  sameRoomPrompt = false;
  coverHostBranding = false;
  copyStatus = "";
  phase: VideoMeetingRoomPhase = VideoMeetingRoomPhase.PREPARING;
  client: VideoMeetingClient = videoMeetingClient({userAgent: ""});
  speechCapture: MeetingSpeechCapture = {transcript: "", chat: "", startedAt: null};

  private config: VideoMeetingRuntimeConfig;
  private api: any;
  private token: string;
  private transcriptLines: string[] = [];
  private chatLines: string[] = [];
  private connectingTimers: number[] = [];
  private mediaHelp: VideoMeetingMediaHelp | null = null;
  private audioAvailable: boolean | null = null;
  private videoAvailable: boolean | null = null;
  private audioMuted: boolean | null = null;
  private joinedMuted = false;
  private remoteParticipantCount = 0;
  private cannotHearDismissed = false;
  private microphoneOffDismissed = false;
  private leavingOnPurpose = false;
  private recovering = false;
  private speechRecognition: MeetingSpeechRecognition | null = null;
  private listenForSpeech = false;
  private captureStartedAt: number | null = null;
  private sameRoomDetector: SameRoomDetector | null = null;
  private localDisplayName = "";
  private pooledTranscript = "";
  private transcriptUploadBuffer: string[] = [];
  private transcriptUploadTimer: number | null = null;
  private transcriptPullTimer: number | null = null;

  protected readonly roomPhase = VideoMeetingRoomPhase;
  protected readonly alertWarning = AlertPanelVariant.WARNING;
  protected readonly faComments = faComments;
  protected readonly faRightFromBracket = faRightFromBracket;
  protected readonly faUserPlus = faUserPlus;
  protected readonly faXmark = faXmark;
  protected readonly faPaperPlane = faPaperPlane;
  protected readonly faExpand = faExpand;
  protected readonly faCompress = faCompress;
  protected readonly faVideo = faVideo;
  protected readonly faCopy = faCopy;
  protected readonly faArrowUpRightFromSquare = faArrowUpRightFromSquare;
  protected readonly faVolumeHigh = faVolumeHigh;
  protected readonly faVolumeXmark = faVolumeXmark;

  get inMeeting(): boolean {
    return this.phase === VideoMeetingRoomPhase.IN_MEETING;
  }

  get joinTitle(): string {
    return videoMeetingJoinTitle(this.client);
  }

  get joinGuidance(): string {
    return videoMeetingJoinGuidance(this.client);
  }

  get joinActionLabel(): string {
    return videoMeetingJoinActionLabel(this.client);
  }

  get hearBanner(): VideoMeetingMediaHelp | null {
    if (this.mediaHelp?.issue === VideoMeetingMediaIssue.CANNOT_HEAR) {
      return this.mediaHelp;
    } else {
      return null;
    }
  }

  get mediaDialog(): VideoMeetingMediaHelp | null {
    if (this.mediaHelp?.issue === VideoMeetingMediaIssue.MEDIA_BLOCKED
      || this.mediaHelp?.issue === VideoMeetingMediaIssue.MICROPHONE_OFF) {
      return this.mediaHelp;
    } else {
      return null;
    }
  }

  ngOnInit(): void {
    this.room = this.route.snapshot.paramMap.get("room");
    this.displayTitle = (this.room || "").replace(/-/g, " ");
    this.guest = !!this.route.snapshot.data?.["guest"];
    this.client = videoMeetingClient(clientHintsFromWindow(window));
    this.fullscreen = this.client.coarsePointer;
  }

  async ngAfterViewInit(): Promise<void> {
    await this.prepare();
  }

  private async prepare(): Promise<void> {
    try {
      this.phase = VideoMeetingRoomPhase.PREPARING;
      this.showConnecting("Preparing your meeting…");
      this.config = await this.videoMeetingsService.config();
      if (this.config.enabled) {
        this.notesEnabled = this.config.enableNotes && !this.config.publicHost;
        await this.meetingSubject();
        if (jitsiJoinMode(this.config.publicHost) === JitsiJoinMode.EMBED) {
          this.token = await this.resolveToken();
          await this.videoMeetingsService.loadExternalApi(this.config.host);
        }
        this.hideConnecting();
        if (this.shouldAutoJoin()) {
          this.joinMeeting();
        } else {
          this.phase = VideoMeetingRoomPhase.READY;
        }
      } else {
        this.hideConnecting();
        this.phase = VideoMeetingRoomPhase.UNAVAILABLE;
        this.error = "Video meetings are switched off for this site.";
      }
    } catch (error) {
      this.logger.error("failed to prepare meeting", error);
      this.hideConnecting();
      this.phase = VideoMeetingRoomPhase.UNAVAILABLE;
      this.error = "We could not start the meeting. Please try again, or contact an administrator if it keeps happening.";
    }
  }

  joinMeeting(): void {
    if (this.client.inAppBrowser) {
      this.copyMeetingLink();
    } else if (this.config && jitsiJoinMode(this.config.publicHost) === JitsiJoinMode.HOST_PAGE) {
      window.location.assign(jitsiHostPageUrl(this.config.host, this.room, this.displayTitle));
    } else {
      this.rememberThisRoom();
      this.phase = VideoMeetingRoomPhase.JOINING;
      this.showConnecting("Connecting to your meeting…");
      this.mountMeeting(this.token);
    }
  }

  joinSilent(): void {
    this.silentJoin = true;
    this.joinMeeting();
  }

  private showConnecting(message: string): void {
    this.hideConnecting();
    this.connecting = true;
    this.connectingMessage = message;
    this.connectingTimers.push(window.setTimeout(() => this.zone.run(() => {
      if (this.connecting) {
        this.connectingMessage = "Starting the meeting server - this can take up to a minute…";
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

  private mountMeeting(token: string): void {
    const domain = new URL(this.config.host).host;
    const options: any = {
      roomName: this.room,
      parentNode: this.jitsiContainer.nativeElement,
      width: "100%",
      height: "100%",
      jwt: token || undefined,
      configOverwrite: jitsiEmbedConfigOverwrite(this.config, this.displayTitle, this.client.coarsePointer, this.silentJoin),
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
        AUTO_PIN_LATEST_SCREEN_SHARE: "true",
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
    applyJitsiIframeAllow(iframe);
    iframe?.addEventListener("load", () => this.zone.run(() => {
      this.hideConnecting();
      this.hideHostBranding();
    }));
    this.api.addEventListener("videoConferenceJoined", (payload: { displayName?: string }) => this.zone.run(() => this.onConferenceJoined(payload)));
    this.api.addEventListener("videoConferenceLeft", () => this.zone.run(() => this.recoverMeeting()));
    this.api.addEventListener("readyToClose", () => this.zone.run(() => this.recoverMeeting()));
    this.api.addEventListener("audioAvailabilityChanged", (payload: { available?: boolean }) => this.zone.run(() => {
      if (payload?.available === false) {
        this.audioAvailable = false;
      } else if (payload?.available === true) {
        this.audioAvailable = true;
      }
      this.refreshMediaHelp();
    }));
    this.api.addEventListener("videoAvailabilityChanged", (payload: { available?: boolean }) => this.zone.run(() => {
      if (payload?.available === false) {
        this.videoAvailable = false;
      } else if (payload?.available === true) {
        this.videoAvailable = true;
      }
      this.refreshMediaHelp();
    }));
    this.api.addEventListener("audioMuteStatusChanged", (payload: { muted?: boolean }) => this.zone.run(() => {
      this.audioMuted = !!payload?.muted;
      if (!this.audioMuted) {
        this.microphoneOffDismissed = true;
      }
      this.refreshMediaHelp();
    }));
    this.api.addEventListener("micError", () => this.zone.run(() => {
      this.audioAvailable = false;
      this.refreshMediaHelp();
    }));
    this.api.addEventListener("cameraError", () => this.zone.run(() => {
      this.videoAvailable = false;
      this.refreshMediaHelp();
    }));
    this.api.addEventListener("participantJoined", () => this.zone.run(() => this.refreshParticipantCount()));
    this.api.addEventListener("participantLeft", () => this.zone.run(() => this.refreshParticipantCount()));
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

  private async onConferenceJoined(payload?: { displayName?: string }): Promise<void> {
    this.recovering = false;
    this.hideConnecting();
    this.hideHostBranding();
    this.phase = VideoMeetingRoomPhase.IN_MEETING;
    this.localDisplayName = (payload?.displayName || "").trim() || this.fallbackDisplayName();

    this.refreshParticipantCount();
    try {
      const muted = await this.api?.isAudioMuted?.();
      this.audioMuted = !!muted;
      this.joinedMuted = !!muted;
    } catch (error) {
      this.logger.info("could not read microphone state", error);
    }
    this.refreshMediaHelp();
    this.beginNotesCapture();
    this.startMeetingSpeechCapture();
    this.startTranscriptPull();
    void this.startSameRoomDetection();
  }

  private fallbackDisplayName(): string {
    if (this.guest) {
      return "Guest";
    } else {
      const member = this.memberLoginService.loggedInMember();
      return [member?.firstName, member?.lastName].filter(Boolean).join(" ") || member?.userName || "Member";
    }
  }

  private async startSameRoomDetection(): Promise<void> {
    this.stopSameRoomDetection();
    if (!this.silentJoin && !this.client.inAppBrowser) {
      const detector = createSameRoomDetector(window, {
        onDetected: () => this.zone.run(() => this.onSameRoomDetected())
      });
      const started = await detector.start();
      if (started) {
        this.sameRoomDetector = detector;
      }
    }
  }

  private onSameRoomDetected(): void {
    this.stopSameRoomDetection();
    this.sameRoomPrompt = true;
  }

  private stopSameRoomDetection(): void {
    if (this.sameRoomDetector) {
      this.sameRoomDetector.stop();
      this.sameRoomDetector = null;
    }
  }

  switchToSilent(): void {
    this.sameRoomPrompt = false;
    this.silentJoin = true;
    this.disposeApi();
    this.phase = VideoMeetingRoomPhase.JOINING;
    this.showConnecting("Switching to no sound…");
    this.mountMeeting(this.token);
  }

  dismissSameRoom(): void {
    this.sameRoomPrompt = false;
  }

  private refreshParticipantCount(): void {
    const count = this.api?.getNumberOfParticipants?.();
    if (count > 0) {
      this.remoteParticipantCount = Math.max(0, count - 1);
    } else {
      this.remoteParticipantCount = 0;
    }
    this.refreshMediaHelp();
  }

  private refreshMediaHelp(): void {
    this.mediaHelp = videoMeetingMediaHelp({
      inMeeting: this.phase === VideoMeetingRoomPhase.IN_MEETING,
      audioAvailable: this.audioAvailable,
      videoAvailable: this.videoAvailable,
      audioMuted: this.audioMuted,
      joinedMuted: this.joinedMuted,
      remoteParticipantCount: this.remoteParticipantCount,
      cannotHearDismissed: this.cannotHearDismissed,
      microphoneOffDismissed: this.microphoneOffDismissed,
      coarsePointer: this.client.coarsePointer
    }, this.client);
  }

  runMediaAction(action: VideoMeetingMediaAction): void {
    if (action === VideoMeetingMediaAction.TURN_ON_MICROPHONE) {
      this.turnOnMicrophone();
    } else if (action === VideoMeetingMediaAction.TRY_AGAIN) {
      this.tryAgain();
    } else if (action === VideoMeetingMediaAction.COPY_LINK) {
      this.copyMeetingLink();
    } else if (action === VideoMeetingMediaAction.STAY_MUTED) {
      this.microphoneOffDismissed = true;
      this.refreshMediaHelp();
    } else if (action === VideoMeetingMediaAction.DISMISS) {
      this.cannotHearDismissed = true;
      this.refreshMediaHelp();
    } else {
      this.logger.info("ignored meeting help action", action);
    }
  }

  private turnOnMicrophone(): void {
    try {
      this.api?.executeCommand?.("toggleAudio");
    } catch (error) {
      this.logger.info("could not turn the microphone on", error);
    }
  }

  private tryAgain(): void {
    this.disposeApi();
    this.audioAvailable = null;
    this.videoAvailable = null;
    this.audioMuted = null;
    this.joinedMuted = false;
    this.cannotHearDismissed = false;
    this.microphoneOffDismissed = false;
    this.mediaHelp = null;
    this.phase = VideoMeetingRoomPhase.JOINING;
    this.showConnecting("Connecting to your meeting…");
    this.mountMeeting(this.token);
  }

  copyMeetingLink(): void {
    const link = window.location.href;
    this.clipboardService.copyToClipboard(link).then(() => {
      if (this.clipboardService.clipboardText() === link) {
        this.copyStatus = "Link copied. Paste it into " + this.client.recommendedBrowserLabel + ".";
      } else {
        this.copyStatus = "Copy this address from the bar at the top and open it in " + this.client.recommendedBrowserLabel + ".";
      }
    });
  }

  openInRecommendedBrowser(): void {
    window.open(window.location.href, "_blank", "noopener");
  }

  private startMeetingSpeechCapture(): void {
    this.stopMeetingSpeechCapture();
    if (this.client.inAppBrowser) {
      this.logger.info("not capturing speech in an in-app browser");
    } else {
      const recognition = createMeetingSpeechRecognition(window);
      if (recognition) {
        this.listenForSpeech = true;
        this.speechRecognition = recognition;
        recognition.onresult = event => this.zone.run(() => {
          const lines = finalSpeechLines(event);
          this.logger.debug("meeting speech capture heard", lines);
          lines.forEach(line => this.recordTranscript(line));
        });
        recognition.onerror = event => this.zone.run(() => {
          this.logger.debug("meeting speech capture error", event?.error);
          if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
            this.listenForSpeech = false;
          }
        });
        recognition.onend = () => {
          if (this.listenForSpeech && this.speechRecognition) {
            try {
              this.speechRecognition.start();
            } catch (error) {
              this.logger.info("could not restart meeting speech capture", error);
            }
          }
        };
        try {
          recognition.start();
          this.logger.debug("meeting speech capture started");
        } catch (error) {
          this.logger.debug("could not start meeting speech capture", error);
          this.listenForSpeech = false;
        }
      }
    }
  }

  private stopMeetingSpeechCapture(): void {
    this.listenForSpeech = false;
    if (this.speechRecognition) {
      this.speechRecognition.onresult = null;
      this.speechRecognition.onerror = null;
      this.speechRecognition.onend = null;
      try {
        this.speechRecognition.stop();
      } catch (error) {
        this.logger.info("could not stop meeting speech capture", error);
      }
      this.speechRecognition = null;
    }
  }

  private beginNotesCapture(): void {
    const storage = this.meetingStorage();
    if (this.captureStartedAt === null) {
      this.captureStartedAt = (storage && meetingNotesStartedAt(this.room, storage))
        || this.dateUtils.dateTimeNowAsValue();
    }
    if (storage) {
      rememberMeetingNotesStartedAt(this.room, this.captureStartedAt, storage);
    }
    this.refreshSpeechCapture();
  }

  private refreshSpeechCapture(): void {
    this.speechCapture = {
      transcript: this.pooledTranscript.trim() || this.transcriptLines.join("\n"),
      chat: this.chatLines.join("\n"),
      startedAt: this.captureStartedAt
    };
  }

  private recordTranscript(line: string | null): void {
    this.transcriptLines = appendUniqueLine(this.transcriptLines, line);
    this.refreshSpeechCapture();
    this.queueTranscriptUpload(line);
  }

  private queueTranscriptUpload(line: string | null): void {
    const text = (line || "").trim();
    if (text) {
      this.transcriptUploadBuffer = [...this.transcriptUploadBuffer, text];
      if (this.transcriptUploadTimer === null) {
        this.transcriptUploadTimer = window.setTimeout(() => this.zone.run(() => this.flushTranscriptUpload()), 2000);
      }
    }
  }

  private flushTranscriptUpload(): void {
    if (this.transcriptUploadTimer !== null) {
      window.clearTimeout(this.transcriptUploadTimer);
      this.transcriptUploadTimer = null;
    }
    const pending = this.transcriptUploadBuffer;
    this.transcriptUploadBuffer = [];
    if (pending.length && this.room) {
      void this.videoMeetingsService.appendTranscript(this.room, this.localDisplayName, pending)
        .catch(error => this.logger.info("could not upload transcript lines", error));
    }
  }

  private startTranscriptPull(): void {
    this.stopTranscriptPull();
    if (!this.guest && this.notesEnabled) {
      void this.pullPooledTranscript();
      this.transcriptPullTimer = window.setInterval(() => this.zone.run(() => this.pullPooledTranscript()), 8000);
    }
  }

  private async pullPooledTranscript(): Promise<void> {
    try {
      const response = await this.videoMeetingsService.transcriptForRoom(this.room);
      this.pooledTranscript = response?.transcript || "";
      this.refreshSpeechCapture();
    } catch (error) {
      this.logger.info("could not read pooled transcript", error);
    }
  }

  private stopTranscriptPull(): void {
    if (this.transcriptPullTimer !== null) {
      window.clearInterval(this.transcriptPullTimer);
      this.transcriptPullTimer = null;
    }
  }

  private recordChat(line: string | null): void {
    this.chatLines = appendUniqueLine(this.chatLines, line);
    this.refreshSpeechCapture();
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

  closeNotes(): void {
    this.showNotes = false;
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
    this.leavingOnPurpose = true;
    this.forgetThisRoom();
    this.disposeApi();
    this.router.navigate([this.guest ? "/" : "/" + AdminPath.MEETINGS]);
  }

  private recoverMeeting(): void {
    if (this.leavingOnPurpose || this.recovering) {
      this.logger.info("not recovering the meeting");
    } else {
      this.recovering = true;
      this.disposeApi();
      this.joinMeeting();
    }
  }

  private shouldAutoJoin(): boolean {
    const storage = this.meetingStorage();
    const storedRoom = storage ? activeMeetingRoom(storage) : null;
    return shouldAutoJoinMeeting(this.room, this.client, storedRoom);
  }

  private rememberThisRoom(): void {
    const storage = this.meetingStorage();
    if (storage) {
      rememberActiveMeetingRoom(this.room, storage);
    }
  }

  private forgetThisRoom(): void {
    const storage = this.meetingStorage();
    if (storage) {
      forgetActiveMeetingRoom(storage);
      forgetMeetingNotesStartedAt(this.room, storage);
    }
  }

  private meetingStorage(): Storage | null {
    try {
      return window.sessionStorage;
    } catch (error) {
      this.logger.info("meeting room memory is not available", error);
      return null;
    }
  }

  private disposeApi(): void {
    this.stopMeetingSpeechCapture();
    this.stopSameRoomDetection();
    this.stopTranscriptPull();
    this.flushTranscriptUpload();
    if (this.api) {
      this.api.dispose();
      this.api = undefined;
    }
    if (this.jitsiContainer?.nativeElement) {
      this.jitsiContainer.nativeElement.replaceChildren();
    }
  }

  ngOnDestroy(): void {
    this.leavingOnPurpose = true;
    this.hideConnecting();
    this.disposeApi();
  }
}
