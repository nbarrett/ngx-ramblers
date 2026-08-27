import { Identifiable } from "./api-response.model";
import { CommitteeAssignedMailboxGroup, CommitteeMember, InboxRoleRecipient } from "./committee.model";

export interface ProfileAssignedRoleMailbox {
  role: CommitteeMember;
  alias: InboxAliasConfigView | null;
  group: CommitteeAssignedMailboxGroup;
}

export interface InboxNotifyBaseline {
  notify: boolean;
  notificationEmail: string | null;
}

export enum InboxMessageDirection {
  INBOUND = "inbound",
  OUTBOUND = "outbound"
}

export enum InboxReaderProvider {
  NONE = "none",
  EMAIL_COMPOSER = "email-composer",
  GMAIL_API = "gmail-api",
  BREVO_INBOUND_PARSE = "brevo-inbound-parse",
  CLOUDFLARE_INGRESS = "cloudflare-ingress"
}

export enum InboxCatchAllMode {
  INBOX = "inbox",
  FORWARD = "forward",
  DROP = "drop"
}

export interface InboxCatchAllPolicy {
  mode: InboxCatchAllMode;
  forwardTo?: string;
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

export enum InboxPrivacyMode {
  CONFIGURABLE = "configurable",
  PRIVATE = "private"
}

export enum InboxReadFilter {
  ALL = "all",
  UNREAD = "unread",
  READ = "read"
}

export enum InboxNotifyMode {
  NONE = "none",
  MEMBER = "member",
  OVERRIDE = "override"
}

export enum InboxNotifySource {
  NONE = "none",
  OWN = "own",
  ANOTHER_ROLE = "another-role"
}

export enum InboxThreadFolder {
  INBOX = "inbox",
  JUNK = "junk",
  DELETED = "deleted"
}

export const INBOX_DELETED_RETENTION_DAYS = 30;

export function hiddenInboxFolders(): InboxThreadFolder[] {
  return [InboxThreadFolder.JUNK, InboxThreadFolder.DELETED];
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
  additionalEmails: string[];
  mailboxConnectionId: string | null;
  enabled: boolean;
  inboxMessageNotifications: boolean;
  inboxNotificationEmail: string | null;
  memberId: string | null;
  recipients: InboxRoleRecipient[];
  recipientsFromRoleType: string | null;
}

export interface InboxJunkAccess {
  canReadJunk: boolean;
}

export interface InboxAliasRecipientView extends InboxRoleRecipient {
  memberName: string | null;
  memberEmail: string | null;
}

export interface InboxAliasConfigView extends Omit<InboxAliasConfig, "recipients"> {
  mailboxConnection: InboxMailboxConnectionView | null;
  assignedMemberName: string | null;
  assignedMemberEmail: string | null;
  recipients: InboxAliasRecipientView[];
}

export interface InboxRoleNotificationSetting {
  roleType: string;
  roleEmail?: string | null;
  memberId: string | null;
  email: string | null;
  notify: boolean;
  notificationEmail: string | null;
  remove?: boolean;
  recipientsFromRoleType?: string | null;
}

export function inboxNotifyModeFor(recipient: Pick<InboxRoleRecipient, "notify" | "email"> | null, memberOptionAvailable = true): InboxNotifyMode {
  if (!recipient?.notify) {
    return InboxNotifyMode.NONE;
  } else if (recipient.email) {
    return InboxNotifyMode.OVERRIDE;
  } else if (!memberOptionAvailable) {
    return InboxNotifyMode.NONE;
  } else {
    return InboxNotifyMode.MEMBER;
  }
}

export function memberNotificationSetting(roleType: string, recipient: InboxRoleRecipient): InboxRoleNotificationSetting {
  return {
    roleType,
    memberId: recipient.memberId,
    email: null,
    notify: recipient.notify,
    notificationEmail: recipient.notify ? recipient.email?.trim() || null : null
  };
}

export enum GoogleCloudSetupStatusValue {
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed"
}

export enum GoogleCloudProvisioningStepStatus {
  OK = "ok",
  SKIPPED = "skipped",
  FAILED = "failed"
}

export interface GoogleCloudProvisioningStepView {
  step: string;
  status: GoogleCloudProvisioningStepStatus;
  detail: string;
}

export interface GoogleCloudSetupStatusView {
  status: GoogleCloudSetupStatusValue;
  projectId: string;
  topicName: string;
  topicFullName: string | null;
  subscriptionFullName: string | null;
  steps: GoogleCloudProvisioningStepView[];
  errorMessage: string | null;
  startedAt: number;
  updatedAt: number;
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
  contentId?: string | null;
}

export enum AttachmentPreviewKind {
  IMAGE = "image",
  PDF = "pdf",
  ICS = "ics",
  CSV = "csv",
  TEXT = "text",
  NONE = "none"
}

export interface AttachmentPreview {
  filename: string;
  url: string;
  contentType?: string;
}

export enum CalendarMethod {
  REQUEST = "REQUEST",
  PUBLISH = "PUBLISH",
  REPLY = "REPLY",
  CANCEL = "CANCEL",
  COUNTER = "COUNTER"
}

export enum CalendarRsvpStatus {
  NEEDS_ACTION = "NEEDS-ACTION",
  ACCEPTED = "ACCEPTED",
  TENTATIVE = "TENTATIVE",
  DECLINED = "DECLINED"
}

export interface CalendarAttendee {
  email: string;
  name: string | null;
  rsvp: boolean;
  partStat: CalendarRsvpStatus | null;
}

export interface CalendarPreviewEvent {
  title: string | null;
  startsAt: number | null;
  endsAt: number | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  url: string | null;
  status: string | null;
  organiser: string | null;
  organiserEmail: string | null;
  uid: string | null;
  sequence: number;
  attendees: CalendarAttendee[];
}

export interface CalendarInvite {
  method: CalendarMethod | null;
  events: CalendarPreviewEvent[];
}

export interface InboxCalendarReplyRequest {
  messageId: string;
  status: CalendarRsvpStatus;
}

export interface InboxCalendarReplyResponse {
  status: CalendarRsvpStatus;
  attendeeEmail: string;
}

export enum DeviceKind {
  APPLE = "apple",
  WINDOWS = "windows",
  ANDROID = "android",
  OTHER = "other"
}

export enum CalendarApp {
  LOCAL = "local",
  GOOGLE = "google",
  OUTLOOK = "outlook"
}

export interface CalendarClientHints {
  userAgent: string;
  origin: string | null;
}

export interface InboxThread extends Identifiable {
  tenantSlug: string;
  roleType: string;
  externalAddress: InboxAddress;
  subject: string;
  normalisedSubject: string;
  folder?: InboxThreadFolder;
  deletedAt?: number | null;
  messageIds: string[];
  firstSeenAt: number;
  lastSeenAt: number;
  lastDirection: InboxMessageDirection;
  unread: boolean;
  readByMemberIds?: string[];
  conversationKey?: string | null;
  sentFrom?: InboxAddress | null;
  deliveredTo?: InboxAddress | null;
}

export interface InboxDeletedIdentity extends Identifiable {
  tenantSlug: string;
  threadId: string;
  messageIds: string[];
  externalIds: string[];
  conversationKeys: string[];
  deletedAt: number;
}

export interface InboxPendingDelete {
  threadId: string;
  removedThreads: InboxThread[];
  insertionIndex: number;
  selectedThread: InboxThread | null;
  timer: ReturnType<typeof setTimeout>;
}

export interface InboxMessage extends Identifiable {
  threadId: string;
  mailboxConnectionId: string | null;
  direction: InboxMessageDirection;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  from: InboxAddress;
  replyTo?: InboxAddress | null;
  autoReply?: boolean;
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
  conversationKey?: string | null;
  calendarRsvp?: CalendarRsvpStatus | null;
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
  totalCount: number;
}

export interface InboxThreadMessagesResponse {
  thread: InboxThread;
  messages: InboxMessage[];
}

export interface InboxRemapCandidate {
  roleType: string;
  roleEmail: string;
}

export interface OrphanedInboxThread {
  thread: InboxThread;
  proposedRoleType: string | null;
  proposedRoleEmail: string | null;
}

export interface OrphanedInboxThreadsResponse {
  orphanedThreads: OrphanedInboxThread[];
  totalCount: number;
  affectedRoleTypes: string[];
  remapCandidates: InboxRemapCandidate[];
  folderlessThreadIds: string[];
}

export interface InboxThreadIdsRequest {
  threadIds: string[];
}

export interface InboxThreadUpdateResult {
  matched: number;
  modified: number;
}

export interface InboxOrphanedThreadGroup {
  roleType: string;
  count: number;
  threadIds: string[];
  suggestedRoleType: string | null;
  targetRoleType: string | null;
}

export interface InboxThreadRemapRequest {
  threadIds: string[];
  targetRoleType: string;
}

export interface InboxThreadRemapResponse {
  matched: number;
  modified: number;
  targetRoleType: string;
}

export interface InboxReplyComposeRequest {
  threadId: string;
  messageId: string;
  forward?: boolean;
}

export interface InboxReplyComposeResponse {
  to: InboxAddress;
  cc: InboxAddress[];
  subject: string;
  inReplyTo: string;
  references: string[];
  quotedHtml: string;
  senderRoleType: string;
  senderRoleEmail?: string;
  threadId: string;
  aliasId: string;
  mailboxConnectionId: string;
  inboxMessageId: string;
  replyAll?: boolean;
  forward?: boolean;
  attachments?: InboxAttachment[];
}

export interface InboxReplyOutboundContext {
  threadId: string;
  aliasId: string;
  senderRoleType: string;
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
