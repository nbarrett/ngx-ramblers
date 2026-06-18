import { Identifiable } from "./api-response.model";

export enum InboxMessageDirection {
  INBOUND = "inbound",
  OUTBOUND = "outbound"
}

export enum InboxReaderProvider {
  GMAIL_API = "gmail-api",
  BREVO_INBOUND_PARSE = "brevo-inbound-parse",
  CLOUDFLARE_INGRESS = "cloudflare-ingress"
}

export enum InboxSyncMode {
  POLL = "poll",
  WATCH = "watch"
}

export enum InboxAliasConnectionStatus {
  NOT_CONNECTED = "not-connected",
  CONNECTED = "connected",
  TOKEN_REVOKED = "token-revoked",
  ERROR = "error"
}

export enum InboxAccessMode {
  ASSIGNED_ROLES = "assigned-roles",
  ALL_COMMITTEE_ROLES = "all-committee-roles"
}

export enum InboxViewScope {
  ALL_ACCESSIBLE = "all-accessible",
  ASSIGNED_ROLES = "assigned-roles"
}

export enum InboxThreadFolder {
  INBOX = "inbox",
  JUNK = "junk"
}

export interface InboxMailboxConnection extends Identifiable {
  tenantSlug: string;
  provider: InboxReaderProvider;
  gmailAccountEmail: string | null;
  oauthRefreshTokenEncrypted: string | null;
  syncMode: InboxSyncMode;
  pubsubTopicName: string | null;
  pubsubSubscriptionName: string | null;
  watchExpiresAt: number | null;
  lastHistoryId: string | null;
  lastPolledAt: number | null;
  lastHealthCheckAt: number | null;
  connectionStatus: InboxAliasConnectionStatus;
  accessMode: InboxAccessMode;
  importAllMessages: boolean;
  lastErrorMessage: string | null;
  enabled: boolean;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
}

export interface InboxMailboxConnectionView extends Omit<InboxMailboxConnection, "oauthRefreshTokenEncrypted"> {
  hasRefreshToken: boolean;
}

export interface InboxAliasConfig extends Identifiable {
  tenantSlug: string;
  roleType: string;
  roleEmail: string;
  mailboxConnectionId: string | null;
  enabled: boolean;
}

export interface InboxAliasConfigView extends InboxAliasConfig {
  mailboxConnection: InboxMailboxConnectionView | null;
}

export interface InboxAddress {
  name: string | null;
  email: string;
}

export interface InboxAttachment {
  filename: string;
  contentType: string;
  sizeBytes: number;
  s3Key: string;
}

export interface InboxThread extends Identifiable {
  tenantSlug: string;
  roleType: string;
  externalAddress: InboxAddress;
  subject: string;
  normalisedSubject: string;
  folder?: InboxThreadFolder;
  messageIds: string[];
  firstSeenAt: number;
  lastSeenAt: number;
  lastDirection: InboxMessageDirection;
  unread: boolean;
}

export interface InboxMessage extends Identifiable {
  threadId: string;
  mailboxConnectionId: string | null;
  direction: InboxMessageDirection;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  from: InboxAddress;
  to: InboxAddress[];
  cc: InboxAddress[];
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  receivedAt: number | null;
  sentAt: number | null;
  externalSource: InboxReaderProvider;
  externalId: string | null;
  attachments: InboxAttachment[];
  notifiedAt?: number | null;
}

export interface InboxThreadListRequest {
  tenantSlug: string;
  roleType?: string;
  unreadOnly?: boolean;
  limit?: number;
}

export interface InboxThreadListResponse {
  threads: InboxThread[];
  unreadCount: number;
}

export interface InboxThreadMessagesResponse {
  thread: InboxThread;
  messages: InboxMessage[];
}

export interface InboxReplyComposeRequest {
  threadId: string;
  messageId: string;
}

export interface InboxReplyComposeResponse {
  to: InboxAddress;
  cc: InboxAddress[];
  subject: string;
  inReplyTo: string;
  references: string[];
  quotedHtml: string;
  senderRoleType: string;
  threadId: string;
  aliasId: string;
  mailboxConnectionId: string;
  inboxMessageId: string;
  replyAll?: boolean;
}

export interface InboxReplyOutboundContext {
  threadId: string;
  aliasId: string;
  mailboxConnectionId: string;
  inboxMessageId: string;
  inReplyTo: string;
  references: string[];
}

export interface InboxNewMessageEvent {
  threadId: string;
  messageId: string;
  roleType: string;
  unreadCountForRole: number;
}

export interface InboxUnreadCountByRole {
  roleType: string;
  unreadCount: number;
}

export interface InboxUnreadCountsResponse {
  total: number;
  byRole: InboxUnreadCountByRole[];
}

export interface InboxUnreadRole {
  roleType: string;
  label: string;
  unreadCount: number;
}

export interface InboxPushSubscription extends Identifiable {
  tenantSlug: string;
  memberId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: number;
  lastSeenAt: number;
}

export interface InboxPushSubscribeRequest {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

export interface InboxPushVapidPublicKeyResponse {
  vapidPublicKey: string;
}

export interface InboxImportAllResponse {
  connection: InboxMailboxConnectionView;
  importedCount: number;
  pollError: string | null;
}

export interface InboxRescanGeneralResponse {
  connection: InboxMailboxConnectionView;
  deletedThreads: number;
  deletedMessages: number;
  importedCount: number;
  pollError: string | null;
}

export interface InboxPushSubscriptionStatus {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
}

export interface InboxPollResult {
  mailboxConnectionId: string;
  importedCount: number;
  error: string | null;
}

export interface InboxConnectionHealthResult {
  mailboxConnectionId: string;
  gmailAccountEmail: string | null;
  healthy: boolean;
  connectionStatus: InboxAliasConnectionStatus;
  error: string | null;
}

export interface InboxSyncModeRequest {
  syncMode: InboxSyncMode;
  pubsubTopicName?: string | null;
}

export interface InboxPushConfigResponse {
  pushUrl: string | null;
  configured: boolean;
  configuredTopicName: string | null;
}

export const INBOX_GENERAL_ROLE_TYPE_PREFIX = "_general_";

export function inboxGeneralRoleTypeFor(mailboxConnectionId: string): string {
  return `${INBOX_GENERAL_ROLE_TYPE_PREFIX}${mailboxConnectionId}`;
}

export function isInboxGeneralRoleType(roleType: string): boolean {
  return roleType.startsWith(INBOX_GENERAL_ROLE_TYPE_PREFIX);
}
