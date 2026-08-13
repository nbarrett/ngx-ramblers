import { Identifiable } from "./api-response.model";
import { EmailAttachment } from "./mail.model";

export interface VideoMeetingsConfig {
  enabled: boolean;
  hostUrl?: string;
  roomPrefix: string;
  brandName?: string;
  startWithAudioMuted: boolean;
  startWithVideoMuted: boolean;
  enableNotes: boolean;
  enableLobby: boolean;
}

export interface VideoMeetingRuntimeConfig {
  enabled: boolean;
  host: string;
  jwtRequired: boolean;
  roomPrefix: string;
  brandName: string;
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

export enum VideoMeetingPlanAction {
  SEND = "send",
  COMPOSE = "compose"
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

export interface VideoMeeting extends Identifiable {
  room: string;
  title: string;
  startTime: number;
  durationMinutes?: number;
  meetingType?: string;
  committeeFileId?: string;
  createdAt: number;
  createdBy?: string;
  createdByName?: string;
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
}

export interface JitsiTokenUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  moderator: boolean;
}

export interface MintMeetingTokenOptions {
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
