import { AfterViewInit, Component, ElementRef, inject, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faArrowUpFromBracket,
  faArrowUpRightFromSquare,
  faCheck,
  faCircleDot,
  faCompress,
  faComments,
  faCopy,
  faExpand,
  faGaugeHigh,
  faHand,
  faMessage,
  faMicrophone,
  faMicrophoneSlash,
  faPaperPlane,
  faPhoneSlash,
  faRightFromBracket,
  faRotateRight,
  faTableCells,
  faUser,
  faUserPlus,
  faUsers,
  faVideo,
  faVideoSlash,
  faVolumeHigh,
  faVolumeXmark,
  faXmark
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { VideoMeetingsService } from "../../services/video-meetings/video-meetings.service";
import { DateUtilsService } from "../../services/date-utils.service";
import { CommitteeFileService } from "../../services/committee/committee-file.service";
import { ExternalRecipientService } from "../../services/external-recipient/external-recipient.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { MemberService } from "../../services/member/member.service";
import { Member } from "../../models/member.model";
import { ClipboardService } from "../../services/clipboard.service";
import { AlertPanelComponent } from "../../modules/common/alert-panel/alert-panel";
import { RecipientFieldComponent } from "../../modules/common/recipient-field/recipient-field";
import { VideoMeetingNotesComponent } from "./video-meeting-notes";
import { ComposerExternalRecipient } from "../../models/email-composer.model";
import { ExternalRecipient } from "../../models/external-recipient.model";
import {
  JitsiJoinMode,
  MeetingAudioRecorder,
  MeetingMinutesCollectionState,
  MeetingSpeechCapture,
  SameRoomDetector,
  TranscribeStatus,
  VideoMeetingClient,
  VideoMeetingMediaAction,
  VideoMeetingMediaHelp,
  VideoMeetingMediaIssue,
  VideoMeetingParticipant,
  VideoMeetingLayout,
  VideoMeetingLayoutOption,
  VideoMeetingQuality,
  VideoMeetingQualityOption,
  VideoMeetingRoomPhase,
  VideoMeetingRuntimeConfig
} from "../../models/video-meeting.model";
import { AlertPanelVariant } from "../../models/alert-panel.model";
import { applyJitsiHostPageTheme, applyJitsiIframeAllow, displayNameFromToken, jitsiEmbedConfigOverwrite, jitsiHostPageUrl, jitsiJoinMode, nameFromEmailAddress, videoMeetingPeople } from "../../functions/video-meeting-join";
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
import { createMeetingAudioRecorder } from "../../functions/meeting-audio-recorder";

declare const JitsiMeetExternalAPI: any;

@Component({
  selector: "app-video-meeting-room",
  imports: [FormsModule, FontAwesomeModule, AlertPanelComponent, RecipientFieldComponent, VideoMeetingNotesComponent],
  styleUrls: ["./video-meeting-room.sass"],
  template: `
    <div class="meeting-shell d-flex flex-column overflow-hidden mb-3" [class.fullscreen]="fullscreen">
      @if (error) {
        <div class="p-3">
          <app-alert-panel title="Video meeting unavailable">{{ error }}</app-alert-panel>
        </div>
      }
      <header class="meeting-bar d-flex align-items-center gap-2 px-3 py-2 flex-shrink-0">
        <span class="meeting-bar-room fw-semibold text-truncate">{{ displayTitle }}</span>
        <span class="flex-grow-1"></span>
        @if (inMeeting) {
          <div class="meeting-toolbar d-flex align-items-stretch overflow-auto">
            @if (notesEnabled) {
              <button type="button" class="meeting-tool" [class.tool-rec-on]="recordingEnabled" (click)="toggleRecording()"
                      [title]="recordingEnabled ? transcribeDetail : 'Start recording for minutes'"
                      [attr.aria-label]="recordingEnabled ? 'Recording - tap to stop' : 'Not recording - tap to start'">
                <fa-icon [icon]="faCircleDot"/><span class="meeting-tool-label">Record</span>
              </button>
            }
            <button type="button" class="meeting-tool" title="Open chat" (click)="jitsiCommand('toggleChat')">
              <fa-icon [icon]="faMessage"/><span class="meeting-tool-label">Chat</span>
            </button>
            <button type="button" class="meeting-tool" [class.tool-active]="showPeople" title="Who is in this meeting"
                    (click)="togglePeople()">
              <fa-icon [icon]="faUsers"/><span class="meeting-tool-label">People</span>
            </button>
            <button type="button" class="meeting-tool" title="Raise or lower your hand" (click)="jitsiCommand('toggleRaiseHand')">
              <fa-icon [icon]="faHand"/><span class="meeting-tool-label">Raise</span>
            </button>
            <button type="button" class="meeting-tool" [class.tool-active]="showViewSettings"
                    [title]="layoutTooltip()" (click)="toggleViewSettings()">
              <fa-icon [icon]="faTableCells"/><span class="meeting-tool-label">{{ layoutOption().label }}</span>
            </button>
            <button type="button" class="meeting-tool" [class.tool-active]="showPerformanceSettings"
                    (click)="togglePerformanceSettings()" [title]="qualityTooltip()">
              <fa-icon [icon]="faGaugeHigh"/><span class="meeting-tool-label">{{ qualityOption().label }}</span>
            </button>
            @if (notesEnabled) {
              <button type="button" class="meeting-tool" #notesButton [class.tool-active]="showNotes || notesCapturing"
                      title="Meeting notes" (click)="toggleNotes()">
                <fa-icon [icon]="faComments"/><span class="meeting-tool-label">Notes</span>
              </button>
            }
            @if (!guest) {
              <button type="button" class="meeting-tool" [class.tool-active]="showInvite" title="Invite people"
                      (click)="toggleInvite()">
                <fa-icon [icon]="faUserPlus"/><span class="meeting-tool-label">Invite</span>
              </button>
            }
            <span class="meeting-tool-divider"></span>
            <button type="button" class="meeting-tool" [class.tool-off]="videoMuted"
                    [title]="videoMuted ? 'Turn camera on' : 'Turn camera off'" (click)="jitsiCommand('toggleVideo')">
              <fa-icon [icon]="videoMuted ? faVideoSlash : faVideo"/><span class="meeting-tool-label">Camera</span>
            </button>
            <button type="button" class="meeting-tool" [class.tool-off]="audioMuted"
                    [title]="audioMuted ? 'Turn microphone on' : 'Turn microphone off'" (click)="jitsiCommand('toggleAudio')">
              <fa-icon [icon]="audioMuted ? faMicrophoneSlash : faMicrophone"/><span class="meeting-tool-label">Mic</span>
            </button>
            <button type="button" class="meeting-tool" [class.tool-active]="sharingScreen"
                    [title]="sharingScreen ? 'Stop sharing your screen' : 'Share your screen'"
                    (click)="jitsiCommand('toggleShareScreen')">
              <fa-icon [icon]="faArrowUpFromBracket"/><span class="meeting-tool-label">{{ sharingScreen ? "Stop" : "Share" }}</span>
            </button>
            <button type="button" class="meeting-tool"
                    [title]="fullscreen ? 'Restore window' : 'Full screen'" (click)="toggleFullscreen()">
              <fa-icon [icon]="fullscreen ? faCompress : faExpand"/><span class="meeting-tool-label">{{ fullscreen ? "Restore" : "Full" }}</span>
            </button>
            <button type="button" class="meeting-tool tool-leave" title="Leave the meeting" (click)="leave()">
              <fa-icon [icon]="faPhoneSlash"/><span class="meeting-tool-label">Leave</span>
            </button>
          </div>
        } @else {
          <button type="button" class="meeting-bar-btn leave d-inline-flex align-items-center gap-2" (click)="leave()">
            <fa-icon [icon]="faRightFromBracket"/>
            <span class="meeting-bar-label">Leave</span>
          </button>
          <button type="button" class="meeting-bar-btn d-inline-flex align-items-center gap-2" (click)="toggleFullscreen()">
            <fa-icon [icon]="fullscreen ? faCompress : faExpand"/>
            <span class="meeting-bar-label">{{ fullscreen ? "Restore" : "Full screen" }}</span>
          </button>
        }
      </header>

      <div class="meeting-body position-relative d-flex flex-column flex-grow-1">
        @if (showPeople) {
          <div class="meeting-panel d-flex flex-column gap-2 p-3 bg-white text-dark rounded-3 shadow">
            <strong>People in this meeting</strong>
            @if (people.length) {
              <div class="d-flex flex-column gap-2">
                @for (person of people; track person.participantId) {
                  <div class="d-flex align-items-center gap-2">
                    <fa-icon [icon]="faUser"/>
                    <span>{{ person.displayName }}@if (person.local) { <span class="text-muted">(you)</span> }</span>
                  </div>
                }
              </div>
            } @else {
              <span class="text-muted">You are the only person in this meeting.</span>
            }
            @if (!guest) {
              <button type="button" class="btn btn-primary w-100" (click)="openInviteFromPeople()">
                <fa-icon [icon]="faUserPlus" class="me-2"/>Invite
              </button>
            }
          </div>
        }
        @if (showViewSettings) {
          <div class="meeting-panel d-flex flex-column gap-2 p-3 bg-white text-dark rounded-3 shadow">
            <strong>Meeting view</strong>
            <span class="text-muted">Choose how people are arranged on screen.</span>
            @for (option of layoutOptions; track option.value) {
              <button type="button"
                      class="btn w-100 d-flex align-items-center justify-content-between gap-2 text-start"
                      [class.btn-primary]="layout === option.value"
                      [class.btn-quiet]="layout !== option.value"
                      (click)="setLayout(option.value)">
                <span class="d-flex flex-column">
                  <strong>{{ option.label }}</strong>
                  <small>{{ option.detail }}</small>
                </span>
                @if (layout === option.value) {
                  <fa-icon [icon]="faCheck"/>
                }
              </button>
            }
          </div>
        }
        @if (showPerformanceSettings) {
          <div class="meeting-panel d-flex flex-column gap-2 p-3 bg-white text-dark rounded-3 shadow">
            <strong>Performance settings</strong>
            <span class="text-muted">Choose how much bandwidth this meeting uses.</span>
            @for (option of videoQualityOptions; track option.value) {
              <button type="button"
                      class="btn w-100 d-flex align-items-center justify-content-between gap-2 text-start"
                      [class.btn-primary]="videoQuality === option.value"
                      [class.btn-quiet]="videoQuality !== option.value"
                      (click)="setVideoQuality(option.value)">
                <span class="d-flex flex-column">
                  <strong>{{ option.label }}</strong>
                  <small>{{ option.detail }}</small>
                </span>
                @if (videoQuality === option.value) {
                  <fa-icon [icon]="faCheck"/>
                }
              </button>
            }
          </div>
        }
        <div #jitsiContainer class="meeting-frame"></div>

        @if (connecting && !error) {
          <div class="meeting-connecting d-flex flex-column align-items-center justify-content-center gap-3">
            <div class="meeting-connecting-spinner"></div>
            <span>{{ connectingMessage }}</span>
          </div>
        }

        @if (phase === roomPhase.READY && !error) {
          <div class="meeting-dialog-scrim"></div>
          <div class="meeting-dialog join d-flex flex-column overflow-hidden bg-white text-dark rounded-3 shadow">
            <div class="d-flex align-items-center justify-content-between flex-shrink-0 px-3 py-2 fw-semibold border-bottom">
              <span>{{ joinTitle }}</span>
            </div>
            <div class="d-flex flex-column gap-2 p-3 overflow-auto">
              <p class="fs-5 mb-0">{{ joinGuidance }}</p>
              @if (client.inAppBrowser) {
                <button type="button" class="btn btn-primary w-100" (click)="copyMeetingLink()">
                  <fa-icon [icon]="faCopy" class="me-2"/>{{ joinActionLabel }}
                </button>
                <button type="button" class="btn btn-quiet w-100" (click)="openInRecommendedBrowser()">
                  <fa-icon [icon]="faArrowUpRightFromSquare" class="me-2"/>Open in {{ client.recommendedBrowserLabel }}
                </button>
              } @else {
                <button type="button" class="btn btn-primary w-100" (click)="joinMeeting()">
                  <fa-icon [icon]="faVideo" class="me-2"/>{{ joinActionLabel }}
                </button>
                <button type="button" class="btn btn-quiet w-100" (click)="joinSilent()">
                  <fa-icon [icon]="faVolumeXmark" class="me-2"/>Join without sound
                </button>
                <p class="text-muted small mb-0">
                  Already in the same room as someone who has joined? Join without sound so the audio stays on one
                  device in the room. You will still see everyone and can type in chat, without adding to the echo.
                </p>
              }
              @if (copyStatus) {
                <p class="text-muted mb-0">{{ copyStatus }}</p>
              }
            </div>
          </div>
        }

        <div class="meeting-banners d-flex flex-column gap-2 p-3">
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

        @if (recordingNoticeVisible) {
          <div class="meeting-help-banner">
            <app-alert-panel title="This meeting is being recorded for minutes" [icon]="faCircleDot"
                             [variant]="alertWarning" actionsEnd>
              What is said is transcribed so the group gets written minutes afterwards, kept within the group. You can
              turn recording off at any time with the Recording button in the bar.
              <button alertActions type="button" class="btn btn-quiet" (click)="dismissRecordingNotice()">OK</button>
            </app-alert-panel>
          </div>
        }

        @if (recordingEnabled && (transcribeStatus === transcribe.UNSUPPORTED || transcribeStatus === transcribe.ERROR)) {
          <div class="meeting-help-banner">
            <app-alert-panel title="Recording is not capturing words" [icon]="faCircleDot" [variant]="alertWarning"
                             actionsEnd>
              {{ transcribeDetail }}
              <button alertActions type="button" class="btn btn-quiet" (click)="toggleRecording()">Stop recording
              </button>
            </app-alert-panel>
          </div>
        }
        </div>

        @if (reconnectPrompt) {
          <div class="meeting-dialog-scrim"></div>
          <div class="meeting-dialog d-flex flex-column overflow-hidden bg-white text-dark rounded-3 shadow">
            <div class="d-flex flex-column gap-2 p-3 overflow-auto">
              <app-alert-panel title="Connection lost" [variant]="alertWarning">
                The meeting connection kept dropping, so we stopped trying automatically to avoid joining you in
                several times. Tap reconnect to rejoin.
              </app-alert-panel>
              <button type="button" class="btn btn-primary w-100" (click)="manualReconnect()">
                <fa-icon [icon]="faRotateRight" class="me-2"/>Reconnect
              </button>
              <button type="button" class="btn btn-quiet w-100" (click)="leave()">Leave</button>
            </div>
          </div>
        }

        @if (minutesState) {
          <div class="meeting-dialog-scrim"></div>
          <div class="meeting-dialog d-flex flex-column overflow-hidden bg-white text-dark rounded-3 shadow">
            <div class="d-flex flex-column gap-2 p-3 overflow-auto">
              @if (minutesState === minutesCollectionState.WRITING) {
                <app-alert-panel title="Collecting the minutes" [variant]="alertWarning">
                  Writing up the minutes from what was said. This takes a few seconds…
                </app-alert-panel>
              } @else {
                <app-alert-panel title="Draft minutes are ready" [variant]="alertWarning">
                  A draft has been written up from the call. Review it, edit it if you need to, then save it onto the committee documents page.
                </app-alert-panel>
                <button type="button" class="btn btn-primary w-100" (click)="openMinutes()">
                  <fa-icon [icon]="faCheck" class="me-2"/>Review the minutes
                </button>
                <button type="button" class="btn btn-quiet w-100" (click)="exitRoom()">Done</button>
              }
            </div>
          </div>
        }

        @if (meetingEnded) {
          <div class="meeting-dialog-scrim"></div>
          <div class="meeting-dialog d-flex flex-column overflow-hidden bg-white text-dark rounded-3 shadow">
            <div class="d-flex flex-column gap-2 p-3 overflow-auto">
              <app-alert-panel title="The meeting has ended" [variant]="alertWarning">
                Thanks for joining. You can close this page now.
              </app-alert-panel>
              <button type="button" class="btn btn-primary w-100" (click)="exitRoom()">
                <fa-icon [icon]="faCheck" class="me-2"/>Done
              </button>
            </div>
          </div>
        }

        @if (showInvite || mediaDialog) {
          <div class="meeting-dialog-scrim" (click)="closePanels()"></div>
        }

        @if (mediaDialog) {
          <div class="meeting-dialog d-flex flex-column overflow-hidden bg-white text-dark rounded-3 shadow">
            <div class="d-flex flex-column gap-2 p-3 overflow-auto">
              <app-alert-panel [title]="mediaDialog.title" [variant]="alertWarning">
                {{ mediaDialog.body }}
              </app-alert-panel>
              <button type="button" class="btn btn-primary w-100"
                      (click)="runMediaAction(mediaDialog.primaryAction)">
                {{ mediaDialog.primaryLabel }}
              </button>
              @if (mediaDialog.secondaryAction) {
                <button type="button" class="btn btn-quiet w-100"
                        (click)="runMediaAction(mediaDialog.secondaryAction)">
                  {{ mediaDialog.secondaryLabel }}
                </button>
              }
              @if (copyStatus) {
                <p class="text-muted mb-0">{{ copyStatus }}</p>
              }
            </div>
          </div>
        }

        @if (!guest && showInvite) {
          <div class="meeting-dialog d-flex flex-column bg-white text-dark rounded-3 shadow">
            <div class="d-flex align-items-center justify-content-between flex-shrink-0 gap-2 px-3 py-2 fw-semibold border-bottom">
              <span>Invite people</span>
              <button type="button" class="btn btn-icon" aria-label="Close" (click)="toggleInvite()">
                <fa-icon [icon]="faXmark"/>
              </button>
            </div>
            <div class="d-flex flex-column gap-2 p-3">
              <app-recipient-field [to]="inviteRecipients" (toChange)="inviteRecipients = $event"
                                   [savedRecipients]="previousRecipients" [members]="inviteMembers" [plain]="true"/>
              <button type="button" class="btn btn-primary btn-sm w-100" (click)="sendInvite()">
                <fa-icon [icon]="faPaperPlane" class="me-2"/>Send invite
              </button>
              @if (inviteStatus) {
                <p class="text-muted small mb-0">{{ inviteStatus }}</p>
              }
              @if (inviteLink) {
                <label class="form-label mb-0" for="guest-link">Invite link</label>
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
  private externalRecipientService = inject(ExternalRecipientService);
  private memberLoginService = inject(MemberLoginService);
  private memberService = inject(MemberService);
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
  showPeople = false;
  showPerformanceSettings = false;
  showViewSettings = false;
  people: VideoMeetingParticipant[] = [];
  inviteRecipients: ComposerExternalRecipient[] = [];
  previousRecipients: ExternalRecipient[] = [];
  inviteMembers: Member[] = [];
  inviteStatus = "";
  inviteLink = "";
  connecting = false;
  connectingMessage = "Preparing your meeting…";
  fullscreen = false;
  silentJoin = false;
  sameRoomPrompt = false;
  sharingScreen = false;
  reconnectPrompt = false;
  recordingEnabled = false;
  recordingNoticeVisible = false;
  meetingEnded = false;
  transcribeStatus: TranscribeStatus = TranscribeStatus.OFF;
  transcribeDetail = "";
  minutesState: MeetingMinutesCollectionState | null = null;
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
  audioMuted: boolean | null = null;
  videoMuted = false;
  videoQuality = VideoMeetingQuality.HIGH;
  readonly videoQualityOptions: VideoMeetingQualityOption[] = [
    {value: VideoMeetingQuality.LOW, label: "Data saver", detail: "Lower quality · 180p"},
    {value: VideoMeetingQuality.STANDARD, label: "Balanced", detail: "Standard quality · 360p"},
    {value: VideoMeetingQuality.HIGH, label: "Best quality", detail: "High definition · 720p"}
  ];
  layout = VideoMeetingLayout.SPEAKER;
  readonly layoutOptions: VideoMeetingLayoutOption[] = [
    {value: VideoMeetingLayout.SPEAKER, label: "Speaker", detail: "The person talking is shown large"},
    {value: VideoMeetingLayout.GALLERY, label: "Gallery", detail: "Everyone is shown equally"}
  ];
  private joinedMuted = false;
  private remoteParticipantCount = 0;
  private localParticipantId = "";
  private frameObserver: ResizeObserver | null = null;
  private appliedGallery: boolean | null = null;
  private cannotHearDismissed = false;
  private microphoneOffDismissed = false;
  private leavingOnPurpose = false;
  private recovering = false;
  private audioRecorder: MeetingAudioRecorder | null = null;
  private transcriptionUploads: Promise<void>[] = [];
  private captureStartedAt: number | null = null;
  private sameRoomDetector: SameRoomDetector | null = null;
  private recoverAttempts = 0;
  private lastRecoverAt = 0;
  private stableTimer: number | null = null;
  private recordingNoticeTimer: number | null = null;
  private recordingUsed = false;
  private localDisplayName = "";
  private pooledTranscript = "";
  private transcriptUploadBuffer: string[] = [];
  private transcriptUploadTimer: number | null = null;
  private transcriptPullTimer: number | null = null;

  protected readonly roomPhase = VideoMeetingRoomPhase;
  protected readonly minutesCollectionState = MeetingMinutesCollectionState;
  protected readonly transcribe = TranscribeStatus;
  private capturedLineTotal = 0;
  private discardedChunkTotal = 0;
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
  protected readonly faCircleDot = faCircleDot;
  protected readonly faRotateRight = faRotateRight;
  protected readonly faCheck = faCheck;
  protected readonly faMessage = faMessage;
  protected readonly faUsers = faUsers;
  protected readonly faUser = faUser;
  protected readonly faHand = faHand;
  protected readonly faTableCells = faTableCells;
  protected readonly faGaugeHigh = faGaugeHigh;
  protected readonly faMicrophone = faMicrophone;
  protected readonly faMicrophoneSlash = faMicrophoneSlash;
  protected readonly faVideoSlash = faVideoSlash;
  protected readonly faArrowUpFromBracket = faArrowUpFromBracket;
  protected readonly faPhoneSlash = faPhoneSlash;

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
        await this.loadPreviousRecipients();
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
      configOverwrite: jitsiEmbedConfigOverwrite(this.config, this.displayTitle, this.silentJoin),
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
        VIDEO_QUALITY_LABEL_DISABLED: true,
        VERTICAL_FILMSTRIP: false,
        TILE_VIEW_MAX_COLUMNS: 3,
        AUTO_PIN_LATEST_SCREEN_SHARE: "true",
        DEFAULT_BACKGROUND: "#1a1a1a"
      }
    };
    const displayName = this.fallbackDisplayName();
    if (displayName && displayName.toLowerCase() !== "guest") {
      options.userInfo = {displayName};
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
    this.api.addEventListener("readyToClose", () => this.zone.run(() => this.endMeeting()));
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
    this.api.addEventListener("videoMuteStatusChanged", (payload: { muted?: boolean }) => this.zone.run(() => {
      this.videoMuted = !!payload?.muted;
    }));
    this.api.addEventListener("videoQualityChanged", (payload: { videoQuality?: number }) => this.zone.run(() => {
      const quality = String(payload?.videoQuality || "") as VideoMeetingQuality;
      if (this.videoQualityOptions.some(option => option.value === quality)) {
        this.videoQuality = quality;
      }
    }));
    this.api.addEventListener("micError", () => this.zone.run(() => {
      this.audioAvailable = false;
      this.refreshMediaHelp();
    }));
    this.api.addEventListener("cameraError", () => this.zone.run(() => {
      this.videoAvailable = false;
      this.refreshMediaHelp();
    }));
    this.api.addEventListener("screenSharingStatusChanged", (payload: { on?: boolean }) => this.zone.run(() => {
      this.sharingScreen = !!payload?.on;
    }));
    this.api.addEventListener("participantJoined", () => this.zone.run(() => this.refreshParticipantCount()));
    this.api.addEventListener("participantLeft", () => this.zone.run(() => this.refreshParticipantCount()));
    this.api.addEventListener("tileViewChanged", (payload: { enabled?: boolean }) => this.zone.run(() => {
      if (!this.frameIsPortrait()) {
        this.layout = payload?.enabled ? VideoMeetingLayout.GALLERY : VideoMeetingLayout.SPEAKER;
      }
    }));
    this.watchMeetingFrame();
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

  private async onConferenceJoined(payload?: { displayName?: string; id?: string }): Promise<void> {
    this.recovering = false;
    this.reconnectPrompt = false;
    this.hideConnecting();
    this.hideHostBranding();
    this.phase = VideoMeetingRoomPhase.IN_MEETING;
    this.localParticipantId = payload?.id || "";
    this.localDisplayName = (payload?.displayName || "").trim() || this.fallbackDisplayName();
    this.applyMeetingLayout();
    this.startStableTimer();
    this.showRecordingNotice();

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
    if (this.recordingEnabled) {
      this.startMeetingSpeechCapture();
      this.startTranscriptPull();
    }
  }

  toggleRecording(): void {
    this.recordingEnabled = !this.recordingEnabled;
    if (this.recordingEnabled) {
      this.recordingUsed = true;
      this.startMeetingSpeechCapture();
      this.startTranscriptPull();
      this.showRecordingNotice();
    } else {
      this.stopMeetingSpeechCapture();
      this.stopTranscriptPull();
      this.flushTranscriptUpload();
      this.recordingNoticeVisible = false;
      this.transcribeStatus = TranscribeStatus.OFF;
      this.transcribeDetail = "";
    }
  }

  private fallbackDisplayName(): string {
    if (this.guest) {
      return displayNameFromToken(this.token) || "Guest";
    } else {
      const member = this.memberLoginService.loggedInMember();
      const fullName = [member?.firstName, member?.lastName].filter(Boolean).join(" ").trim();
      return fullName || nameFromEmailAddress(member?.userName || "") || (member?.userName || "").trim() || "Member";
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
    if (this.remoteParticipantCount > 0) {
      if (!this.sameRoomDetector) {
        void this.startSameRoomDetection();
      }
    } else {
      this.stopSameRoomDetection();
      this.sameRoomPrompt = false;
    }
    this.refreshPeople();
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
    this.capturedLineTotal = 0;
    this.discardedChunkTotal = 0;
    this.transcriptionUploads = [];
    const recorder = createMeetingAudioRecorder(window, {
      chunkMs: 20000,
      onChunk: blob => this.queueAudioChunk(blob)
    });
    this.audioRecorder = recorder;
    void recorder.start().then(started => this.zone.run(() => {
      if (started) {
        this.transcribeStatus = TranscribeStatus.LISTENING;
        this.transcribeDetail = "Listening - speak to capture the minutes.";
        this.logger.info("meeting transcribe: audio recording started");
      } else {
        this.audioRecorder = null;
        this.transcribeStatus = TranscribeStatus.UNSUPPORTED;
        this.transcribeDetail = "This device could not start audio recording. Check that the microphone is allowed.";
        this.logger.error("meeting transcribe: could not start audio recording");
      }
    }));
  }

  private queueAudioChunk(blob: Blob): void {
    if (blob?.size && this.room) {
      this.transcriptionUploads = [...this.transcriptionUploads, this.uploadAudioChunk(blob)];
    }
  }

  private async uploadAudioChunk(blob: Blob): Promise<void> {
    try {
      const result = await this.videoMeetingsService.transcribeAudioChunk(this.room, this.localDisplayName, blob);
      this.zone.run(() => {
        if (result.saved > 0 || result.discarded > 0) {
          this.capturedLineTotal += result.saved;
          this.discardedChunkTotal += result.discarded;
          this.transcribeStatus = TranscribeStatus.CAPTURING;
          this.transcribeDetail = this.discardedChunkTotal > 0
            ? `Capturing speech - ${this.capturedLineTotal} captured, ${this.discardedChunkTotal} unclear ${this.discardedChunkTotal === 1 ? "section" : "sections"} left out.`
            : `Capturing speech - ${this.capturedLineTotal} captured so far.`;
        }
      });
    } catch (error) {
      this.zone.run(() => {
        this.transcribeStatus = TranscribeStatus.ERROR;
        this.transcribeDetail = "The transcription service could not be reached, so the minutes may be incomplete.";
      });
      this.logger.error("meeting transcribe: audio upload failed", error);
    }
  }

  private stopMeetingSpeechCapture(): void {
    if (this.audioRecorder) {
      this.audioRecorder.stop();
      this.audioRecorder = null;
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
    const previousLines = this.transcriptLines;
    this.transcriptLines = appendUniqueLine(this.transcriptLines, line);
    if (this.transcriptLines !== previousLines) {
      this.queueTranscriptUpload(line);
    }
    this.refreshSpeechCapture();
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
    void this.flushTranscriptUploadNow();
  }

  private async flushTranscriptUploadNow(): Promise<void> {
    if (this.transcriptUploadTimer !== null) {
      window.clearTimeout(this.transcriptUploadTimer);
      this.transcriptUploadTimer = null;
    }
    const pending = this.transcriptUploadBuffer;
    this.transcriptUploadBuffer = [];
    if (pending.length && this.room) {
      try {
        await this.videoMeetingsService.appendTranscript(this.room, this.localDisplayName, pending);
      } catch (error) {
        this.logger.info("could not upload transcript lines", error);
      }
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
      applyJitsiHostPageTheme(this.api?.getIFrame?.() as HTMLIFrameElement);
    } catch (error) {
      this.logger.info("host branding is not writable from the parent page", error);
    }
  }

  toggleNotes(): void {
    this.showNotes = !this.showNotes;
    if (this.showNotes) {
      this.showInvite = false;
      this.showPeople = false;
      this.showPerformanceSettings = false;
      this.showViewSettings = false;
    }
  }

  closeNotes(): void {
    this.showNotes = false;
  }

  toggleInvite(): void {
    this.showInvite = !this.showInvite;
    if (this.showInvite) {
      this.showNotes = false;
      this.showPeople = false;
      this.showPerformanceSettings = false;
      this.showViewSettings = false;
    }
  }

  togglePeople(): void {
    this.showPeople = !this.showPeople;
    if (this.showPeople) {
      this.showNotes = false;
      this.showInvite = false;
      this.showPerformanceSettings = false;
      this.showViewSettings = false;
      this.refreshPeople();
    }
  }

  openInviteFromPeople(): void {
    this.showPeople = false;
    this.showNotes = false;
    this.showPerformanceSettings = false;
    this.showViewSettings = false;
    this.showInvite = true;
  }

  togglePerformanceSettings(): void {
    this.showPerformanceSettings = !this.showPerformanceSettings;
    if (this.showPerformanceSettings) {
      this.showNotes = false;
      this.showInvite = false;
      this.showPeople = false;
      this.showViewSettings = false;
    }
  }

  toggleViewSettings(): void {
    this.showViewSettings = !this.showViewSettings;
    if (this.showViewSettings) {
      this.showNotes = false;
      this.showInvite = false;
      this.showPeople = false;
      this.showPerformanceSettings = false;
    }
  }

  layoutOption(): VideoMeetingLayoutOption {
    return this.layoutOptions.find(option => option.value === this.layout) || this.layoutOptions[0];
  }

  layoutTooltip(): string {
    const option = this.layoutOption();
    return `${option.label}: ${option.detail}. Click to change.`;
  }

  setLayout(layout: VideoMeetingLayout): void {
    this.layout = layout;
    this.showViewSettings = false;
    this.appliedGallery = null;
    this.applyMeetingLayout();
  }

  private frameIsPortrait(): boolean {
    const frame = this.jitsiContainer?.nativeElement;
    return !!frame && frame.clientHeight > frame.clientWidth;
  }

  private applyMeetingLayout(): void {
    const gallery = this.frameIsPortrait() || this.layout === VideoMeetingLayout.GALLERY;
    this.appliedGallery = gallery;
    this.jitsiCommand("setTileView", gallery);
  }

  private watchMeetingFrame(): void {
    this.frameObserver?.disconnect();
    const frame = this.jitsiContainer?.nativeElement;
    if (frame) {
      this.frameObserver = new ResizeObserver(() => this.zone.run(() => this.applyMeetingLayout()));
      this.frameObserver.observe(frame);
    }
  }

  qualityOption(): VideoMeetingQualityOption {
    return this.videoQualityOptions.find(option => option.value === this.videoQuality) || this.videoQualityOptions[2];
  }

  qualityTooltip(): string {
    const option = this.qualityOption();
    return `${option.label}: ${option.detail}. Click to change.`;
  }

  setVideoQuality(quality: VideoMeetingQuality): void {
    this.videoQuality = quality;
    this.jitsiCommand("setVideoQuality", Number(quality));
  }

  closePanels(): void {
    this.showNotes = false;
    this.showInvite = false;
    this.showPeople = false;
    this.showPerformanceSettings = false;
    this.showViewSettings = false;
  }

  private refreshPeople(): void {
    this.people = videoMeetingPeople(this.api?.getParticipantsInfo?.() || [], this.localParticipantId);
  }

  toggleFullscreen(): void {
    this.fullscreen = !this.fullscreen;
  }

  selectAll(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  async sendInvite(): Promise<void> {
    const guests = this.inviteRecipients.filter(recipient => recipient.email);
    if (guests.length) {
      this.inviteStatus = guests.length === 1 ? "Sending…" : `Sending ${guests.length} invites…`;
      this.inviteLink = "";
      try {
        const results = await Promise.all(guests.map(guest =>
          this.videoMeetingsService.inviteGuest(this.room, guest.email, guest.name || "").then(response => ({guest, response}))
        ));
        const sent = results.filter(result => result.response.sent).map(result => result.guest.email);
        const fallback = results.find(result => !result.response.sent);
        if (fallback && !sent.length) {
          this.inviteStatus = "We could not send that automatically - copy the link below and send it yourself.";
          this.inviteLink = fallback.response.link;
        } else if (fallback) {
          this.inviteStatus = `Invite sent to ${sent.join(", ")}. Copy the link below for the rest.`;
          this.inviteLink = fallback.response.link;
        } else {
          this.inviteStatus = sent.length === 1 ? `Invite sent to ${sent[0]}.` : `Invites sent to ${sent.join(", ")}.`;
          this.inviteRecipients = [];
        }
      } catch (error) {
        this.logger.error("failed to send guest invite", error);
        this.inviteStatus = "We could not send that invite. Please check the email addresses and try again.";
      }
    } else {
      this.inviteStatus = "Please add at least one person.";
    }
  }

  private async loadPreviousRecipients(): Promise<void> {
    if (!this.guest) {
      try {
        this.previousRecipients = await this.externalRecipientService.list();
      } catch (error) {
        this.logger.error("failed to load previous guest recipients", error);
      }
      try {
        this.inviteMembers = await this.memberService.all();
      } catch (error) {
        this.logger.error("failed to load members for meeting invites", error);
      }
    }
  }

  leave(): void {
    this.leavingOnPurpose = true;
    this.reconnectPrompt = false;
    this.forgetThisRoom();
    this.clearStableTimer();
    if (!this.guest && this.notesEnabled && this.recordingUsed) {
      void this.collectMinutesThenExit();
    } else {
      this.disposeApi();
      this.exitRoom();
    }
  }

  private async collectMinutesThenExit(): Promise<void> {
    this.minutesState = MeetingMinutesCollectionState.WRITING;
    this.stopMeetingSpeechCapture();
    this.stopSameRoomDetection();
    this.stopTranscriptPull();
    await Promise.all(this.transcriptionUploads);
    await this.pullPooledTranscript();
    await this.flushTranscriptUploadNow();
    if (this.api) {
      this.api.dispose();
      this.api = undefined;
    }
    if (this.jitsiContainer?.nativeElement) {
      this.jitsiContainer.nativeElement.replaceChildren();
    }
    try {
      await this.videoMeetingsService.writeMinutes(this.room, this.speechCapture, "", true);
    } catch (error) {
      this.logger.info("could not write up the minutes on leaving", error);
    }
    this.minutesState = MeetingMinutesCollectionState.DONE;
  }

  openMinutes(): void {
    this.router.navigate(["/" + AdminPath.MEETING_MINUTES, this.room]);
  }

  exitRoom(): void {
    this.minutesState = null;
    this.meetingEnded = false;
    this.router.navigate([this.guest ? "/" : "/" + AdminPath.MEETINGS]);
  }

  private endMeeting(): void {
    if (this.leavingOnPurpose) {
      this.logger.info("meeting closing while already leaving");
    } else {
      this.leavingOnPurpose = true;
      this.reconnectPrompt = false;
      this.clearStableTimer();
      this.forgetThisRoom();
      if (!this.guest && this.notesEnabled && this.captureStartedAt !== null) {
        void this.collectMinutesThenExit();
      } else {
        this.disposeApi();
        this.meetingEnded = true;
      }
    }
  }

  private recoverMeeting(): void {
    if (this.leavingOnPurpose || this.recovering || this.reconnectPrompt) {
      this.logger.info("not recovering the meeting");
    } else {
      const now = this.dateUtils.dateTimeNowAsValue();
      if (now - this.lastRecoverAt > 120000) {
        this.recoverAttempts = 0;
      }
      this.lastRecoverAt = now;
      this.recoverAttempts += 1;
      this.clearStableTimer();
      if (this.recoverAttempts > 2) {
        this.logger.info("meeting dropped repeatedly, asking the user to reconnect");
        this.disposeApi();
        this.hideConnecting();
        this.reconnectPrompt = true;
      } else {
        this.recovering = true;
        this.disposeApi();
        window.setTimeout(() => this.zone.run(() => {
          if (!this.leavingOnPurpose) {
            this.joinMeeting();
          }
        }), 1500);
      }
    }
  }

  manualReconnect(): void {
    this.reconnectPrompt = false;
    this.recoverAttempts = 0;
    this.lastRecoverAt = 0;
    this.joinMeeting();
  }

  private startStableTimer(): void {
    this.clearStableTimer();
    this.stableTimer = window.setTimeout(() => this.zone.run(() => {
      this.recoverAttempts = 0;
    }), 60000);
  }

  private clearStableTimer(): void {
    if (this.stableTimer !== null) {
      window.clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
  }

  jitsiCommand(command: string, ...args: unknown[]): void {
    try {
      this.api?.executeCommand?.(command, ...args);
    } catch (error) {
      this.logger.info("could not run meeting command", command, error);
    }
  }

  private showRecordingNotice(): void {
    if (this.notesEnabled && this.recordingEnabled) {
      this.recordingNoticeVisible = true;
      if (this.recordingNoticeTimer !== null) {
        window.clearTimeout(this.recordingNoticeTimer);
      }
      this.recordingNoticeTimer = window.setTimeout(() => this.zone.run(() => {
        this.recordingNoticeVisible = false;
        this.recordingNoticeTimer = null;
      }), 12000);
    }
  }

  dismissRecordingNotice(): void {
    this.recordingNoticeVisible = false;
    if (this.recordingNoticeTimer !== null) {
      window.clearTimeout(this.recordingNoticeTimer);
      this.recordingNoticeTimer = null;
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
    this.clearStableTimer();
    this.flushTranscriptUpload();
    this.frameObserver?.disconnect();
    this.frameObserver = null;
    this.appliedGallery = null;
    this.localParticipantId = "";
    this.people = [];
    this.showPeople = false;
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
    this.dismissRecordingNotice();
    this.disposeApi();
  }
}
