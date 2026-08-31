import { Identifiable } from "./api-response.model";
import { CalendarRsvpStatus } from "./inbox.model";
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

export interface VideoMeetingRsvp {
  email: string;
  name?: string;
  status: CalendarRsvpStatus;
  respondedAt: number;
}

export interface VideoMeetingCancellationPerson {
  key: string;
  name: string;
  email: string;
  memberId: string | null;
}

export interface VideoMeetingRsvpPerson extends VideoMeetingCancellationPerson {
  status: CalendarRsvpStatus | null;
  respondedAt: number | null;
}

export enum VideoMeetingRsvpTableColumn {
  NAME = "name",
  EMAIL = "email",
  REPLY = "reply"
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

export enum VideoMeetingQuality {
  LOW = "180",
  STANDARD = "360",
  HIGH = "720"
}

export interface VideoMeetingQualityOption {
  value: VideoMeetingQuality;
  label: string;
  detail: string;
}

export enum VideoMeetingLayout {
  SPEAKER = "speaker",
  GALLERY = "gallery"
}

export interface VideoMeetingLayoutOption {
  value: VideoMeetingLayout;
  label: string;
  detail: string;
}

export interface VideoMeetingParticipant {
  participantId: string;
  displayName: string;
  local: boolean;
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
  startSilent: boolean;
  disableDeepLinking: boolean;
  hideConferenceSubject: boolean;
  hideConferenceTimer: boolean;
  disableSelfView: boolean;
  disableResponsiveTiles: boolean;
  customTheme: {
    palette: {
      action01: string;
      action01Hover: string;
      action01Active: string;
      focus01: string;
    };
  };
  connectionIndicators: {
    disabled: boolean;
  };
  defaultLogoUrl: string;
  toolbarButtons: string[];
  toolbarConfig: {
    alwaysVisible: boolean;
  };
  followMeEnabled: boolean;
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

export const MEETING_MINUTES_TEMPLATE_ID = "meeting-minutes";

export enum MeetingMinutesView {
  EDIT = "edit",
  PREVIEW = "preview",
  TRANSCRIPT = "transcript"
}

export interface MeetingMinutesSummary {
  room: string;
  title: string;
  dateLabel: string;
  pagePath: string | null;
  slug: string | null;
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

export enum MeetingMinutesCollectionState {
  WRITING = "writing",
  DONE = "done"
}

export enum TranscribeStatus {
  OFF = "off",
  LISTENING = "listening",
  CAPTURING = "capturing",
  UNSUPPORTED = "unsupported",
  ERROR = "error"
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

export interface MeetingMinutesRequest {
  room: string;
  transcript: string;
  chat: string;
  existingNotes: string;
  notify?: boolean;
}

export interface MeetingMinutesResponse {
  note: MeetingNote;
  link?: string;
  path?: string;
  slug?: string;
}

export interface MeetingTranscriptLine {
  room: string;
  authorName?: string;
  text: string;
  at: number;
}

export interface MeetingTranscriptAppendRequest {
  room: string;
  authorName: string;
  lines: string[];
}

export interface MeetingTranscriptEntry {
  authorName?: string;
  text: string;
  at: number;
}

export interface MeetingTranscriptResponse {
  transcript: string;
  lines: number;
  entries?: MeetingTranscriptEntry[];
  startedAt?: number | null;
  endedAt?: number | null;
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

export interface BeaconDetectionOptions {
  absoluteThresholdDb: number;
  prominenceDb: number;
}

export interface SameRoomDetectorOptions {
  onDetected: () => void;
}

export interface SameRoomDetector {
  start(): Promise<boolean>;
  stop(): void;
}

export interface MeetingAudioRecorderOptions {
  chunkMs: number;
  onChunk: (blob: Blob) => void;
}

export interface MeetingAudioRecorder {
  start(): Promise<boolean>;
  stop(): void;
}

export interface MeetingAudioTranscription {
  text: string;
  discarded: boolean;
}

export interface MeetingAudioTranscriptionResponse {
  saved: number;
  discarded: number;
  text: string;
}
