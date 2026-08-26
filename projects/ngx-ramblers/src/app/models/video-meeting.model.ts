import { Identifiable } from "./api-response.model";
import { EmailAttachment } from "./mail.model";

export const DEFAULT_GUEST_INSTRUCTIONS = "Open the link in Safari on iPhone or iPad, or Chrome on Android or a computer, not inside Mail or Facebook. When asked, tap Allow for the camera and microphone. If you see a microphone with a line through it that does not change, allow camera and microphone in your browser settings and open the link again.";

export interface VideoMeetingsConfig {
  brandName?: string;
  guestInstructions?: string;
}

export interface VideoMeetingRuntimeConfig {
  enabled: boolean;
  host: string;
  jwtRequired: boolean;
  publicHost: boolean;
  roomPrefix: string;
  brandName: string;
  guestInstructions: string;
  startWithAudioMuted: boolean;
  startWithVideoMuted: boolean;
  enableNotes: boolean;
  enableLobby: boolean;
}

export interface VideoMeetingTokenRequest {
  room: string;
}

export interface VideoMeetingTokenResponse {
  token: string | null;
  host: string;
  room: string;
  moderator: boolean;
}

export interface GuestInviteRequest {
  room: string;
  email: string;
  name?: string;
}

export interface GuestInviteResponse {
  sent: boolean;
  link: string;
  room: string;
}

export interface VideoMeetingInviteRecipient {
  email: string;
  name?: string;
}

export interface VideoMeetingCancellationPerson {
  key: string;
  name: string;
  email: string;
  memberId: string | null;
}

export enum VideoMeetingPlanAction {
  SEND = "send",
  COMPOSE = "compose",
  SAVE = "save",
  DELETE = "delete"
}

export enum JitsiJoinMode {
  EMBED = "embed",
  HOST_PAGE = "host-page"
}

export enum VideoMeetingRoomPhase {
  PREPARING = "preparing",
  READY = "ready",
  JOINING = "joining",
  IN_MEETING = "in-meeting",
  UNAVAILABLE = "unavailable"
}

export enum VideoMeetingDevice {
  IPAD = "ipad",
  IPHONE = "iphone",
  ANDROID = "android",
  COMPUTER = "computer"
}

export enum VideoMeetingBrowser {
  SAFARI = "safari",
  CHROME = "chrome",
  FIREFOX = "firefox",
  EDGE = "edge",
  OTHER = "other"
}

export enum VideoMeetingMediaIssue {
  MEDIA_BLOCKED = "media-blocked",
  MICROPHONE_OFF = "microphone-off",
  CANNOT_HEAR = "cannot-hear"
}

export enum VideoMeetingMediaAction {
  TURN_ON_MICROPHONE = "turn-on-microphone",
  TRY_AGAIN = "try-again",
  COPY_LINK = "copy-link",
  DISMISS = "dismiss",
  STAY_MUTED = "stay-muted"
}

export interface VideoMeetingClientHints {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  vendor?: string;
  coarsePointer?: boolean;
}

export interface VideoMeetingClient {
  device: VideoMeetingDevice;
  browser: VideoMeetingBrowser;
  inAppBrowser: boolean;
  coarsePointer: boolean;
  deviceLabel: string;
  browserLabel: string;
  recommendedBrowserLabel: string;
}

export interface VideoMeetingMediaState {
  inMeeting: boolean;
  audioAvailable: boolean | null;
  videoAvailable: boolean | null;
  audioMuted: boolean | null;
  joinedMuted: boolean;
  remoteParticipantCount: number;
  cannotHearDismissed: boolean;
  microphoneOffDismissed: boolean;
  coarsePointer: boolean;
}

export interface VideoMeetingMediaHelp {
  issue: VideoMeetingMediaIssue;
  title: string;
  body: string;
  primaryAction: VideoMeetingMediaAction;
  primaryLabel: string;
  secondaryAction: VideoMeetingMediaAction | null;
  secondaryLabel: string | null;
}

export interface JitsiEmbedConfigOverwrite {
  prejoinPageEnabled: boolean;
  prejoinConfig: {
    enabled: boolean;
    hideExtraJoinButtons: string[];
  };
  disableLobby: boolean;
  lobby: {
    autoKnock: boolean;
    enableChat: boolean;
  };
  startWithAudioMuted: boolean;
  startWithVideoMuted: boolean;
  disableDeepLinking: boolean;
  defaultLogoUrl: string;
  toolbarButtons: string[];
  toolbarConfig: {
    alwaysVisible: boolean;
  };
  transcription: {
    enabled: boolean;
    preferredLanguage: string;
    disableClosedCaptions: boolean;
  };
  transcribingEnabled: boolean;
  disabledNotifications: string[];
  subject: string;
}

export interface VideoMeetingInviteHandoff {
  subject: string;
  body: string;
  externalRecipients?: VideoMeetingInviteRecipient[];
  selectedListId?: number;
  attachments?: EmailAttachment[];
  committeeFileSlug?: string;
  committeePagePath?: string;
}

export interface UpcomingBookedMeeting {
  title: string;
  startTime: number;
  meetingType?: string;
  committeeFileId?: string;
  committeePath?: string;
  committeeSlug?: string;
  composedDocument?: boolean;
  room?: string;
}

export enum MeetingNoteSource {
  MEMBER = "member",
  AI = "ai"
}

export enum MeetingNotesWriteOutcome {
  EMPTY = "empty",
  WRITING = "writing",
  UPDATED = "updated",
  FAILED = "failed"
}

export interface MeetingNote extends Identifiable {
  room: string;
  memberId: string;
  authorName: string;
  text: string;
  createdAt: number;
  createdBy?: string;
  updatedAt?: number;
  updatedBy?: string;
  source?: MeetingNoteSource;
}

export interface MeetingSpeechCapture {
  transcript: string;
  chat: string;
  startedAt: number | null;
}

export interface MeetingSpeechAlternative {
  transcript: string;
}

export interface MeetingSpeechResult {
  isFinal: boolean;
  0: MeetingSpeechAlternative;
}

export interface MeetingSpeechRecognitionEvent {
  results: {
    length: number;
    [index: number]: MeetingSpeechResult;
  };
}

export interface MeetingSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: MeetingSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export interface MeetingMinutesRequest {
  room: string;
  transcript: string;
  chat: string;
  existingNotes: string;
}

export interface MeetingMinutesResponse {
  note: MeetingNote;
}

export interface JitsiTokenUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  moderator: boolean;
}

export interface IssueMeetingTokenOptions {
  appId: string;
  appSecret: string;
  room: string;
  user: JitsiTokenUser;
  expirySeconds: number;
}

export interface VideoMeetingIdentity {
  displayName: string;
  email?: string;
  avatarUrl?: string;
}
