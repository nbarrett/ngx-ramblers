export const GMAIL_API_ROOT = "https://gmail.googleapis.com/gmail/v1";

export enum GoogleApiScope {
  GMAIL_MODIFY = "https://www.googleapis.com/auth/gmail.modify",
  CLOUD_PLATFORM = "https://www.googleapis.com/auth/cloud-platform"
}

export const GMAIL_SCOPES = [
  GoogleApiScope.GMAIL_MODIFY
];

export const GOOGLE_CLOUD_SCOPES = [
  GoogleApiScope.CLOUD_PLATFORM
];

export enum GmailEndpoint {
  PROFILE = "/users/me/profile",
  MESSAGES = "/users/me/messages",
  HISTORY = "/users/me/history",
  WATCH = "/users/me/watch",
  STOP = "/users/me/stop",
  BATCH_MODIFY = "/users/me/messages/batchModify",
  INSERT = "/users/me/messages/insert"
}

export const GMAIL_DYNAMIC_ENDPOINTS = {
  MESSAGE: (messageId: string) => `/users/me/messages/${encodeURIComponent(messageId)}`,
  MESSAGE_MODIFY: (messageId: string) => `/users/me/messages/${encodeURIComponent(messageId)}/modify`,
  MESSAGE_TRASH: (messageId: string) => `/users/me/messages/${encodeURIComponent(messageId)}/trash`,
  ATTACHMENT: (messageId: string, attachmentId: string) => `/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`
};

export enum GmailLabel {
  INBOX = "INBOX",
  SENT = "SENT",
  UNREAD = "UNREAD",
  SPAM = "SPAM"
}

export enum GmailHistoryType {
  MESSAGE_ADDED = "messageAdded"
}

export enum GmailInternalDateSource {
  DATE_HEADER = "dateHeader"
}

export enum GmailQuery {
  INBOX = "in:inbox",
  SPAM = "in:spam"
}

export const GMAIL_DYNAMIC_QUERIES = {
  INBOX_TO: (emailAddress: string) => `in:inbox to:${emailAddress}`
};

export enum GmailHeader {
  MESSAGE_ID = "message-id",
  IN_REPLY_TO = "in-reply-to",
  REFERENCES = "references",
  FROM = "from",
  TO = "to",
  CC = "cc",
  SUBJECT = "subject",
  DATE = "date",
  CONVERSATION_KEY = "x-ngx-conversation-key"
}

export enum GmailMimeType {
  HTML = "text/html",
  PLAIN = "text/plain"
}

export enum GmailMimePrefix {
  MULTIPART = "multipart/"
}

export enum GoogleApiService {
  GMAIL = "gmail.googleapis.com",
  PUBSUB = "pubsub.googleapis.com",
  CLOUD_RESOURCE_MANAGER = "cloudresourcemanager.googleapis.com"
}

export enum GmailServiceAccount {
  PUBLISHER = "gmail-api-push@system.gserviceaccount.com"
}

export enum InboxPushEndpoint {
  RECEIVER_PATH = "/api/inbox/pubsub/push"
}

export interface GoogleInboxOauthResolved {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  configured: boolean;
}

export interface GmailQueryParams {
  [key: string]: string | number | boolean | null;
}

export enum GmailRequestMethod {
  GET = "GET",
  POST = "POST"
}

export interface GmailRequestOptions {
  method?: GmailRequestMethod;
  data?: unknown;
}

export interface GmailMessageListResponse {
  messages?: { id?: string | null }[];
}

export interface GmailProfile {
  emailAddress?: string | null;
  historyId?: string | null;
}

export interface GmailHistoryResponse {
  history?: {
    messagesAdded?: {
      message?: { id?: string | null };
    }[];
  }[];
  historyId?: string | null;
}

export interface GmailMessagePartHeader {
  name?: string | null;
  value?: string | null;
}

export interface GmailMessagePartBody {
  data?: string | null;
  size?: number | null;
  attachmentId?: string | null;
}

export interface GmailMessagePart {
  mimeType?: string | null;
  filename?: string | null;
  headers?: GmailMessagePartHeader[];
  body?: GmailMessagePartBody | null;
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id?: string | null;
  internalDate?: string | null;
  payload?: GmailMessagePart | null;
}

export interface GmailAttachment {
  data?: string | null;
  size?: number | null;
}

export interface GmailAttachmentRef {
  filename: string;
  contentType: string;
  sizeBytes: number;
  attachmentId: string;
  contentId: string | null;
}

export interface GmailWatchResponse {
  historyId?: string | null;
  expiration?: string | null;
}

export interface GmailWatchRegistration {
  historyId: string | null;
  expiration: number | null;
}

export enum OauthAccessType {
  ONLINE = "online",
  OFFLINE = "offline"
}

export interface OauthConsentOptions {
  scopes?: string[];
  accessType?: OauthAccessType;
  includeGrantedScopes?: boolean;
}

export interface GoogleInboxSetupStatePayload {
  projectId: string;
  topicName: string;
  subscriptionName?: string;
}

export enum GoogleInboxOauthStateKind {
  MAILBOX = "mailbox",
  SETUP = "setup"
}

export interface VerifiedGoogleInboxOauthState {
  kind: GoogleInboxOauthStateKind;
  mailboxConnectionId?: string;
  payload?: GoogleInboxSetupStatePayload;
  issuedAt: number;
}

export interface GoogleCloudProvisioningOptions {
  projectId: string;
  topicName: string;
  subscriptionName?: string;
  pushReceiverUrl: string;
}

export enum ProvisioningStepStatus {
  OK = "ok",
  SKIPPED = "skipped",
  FAILED = "failed"
}

export interface ProvisioningStep {
  step: string;
  status: ProvisioningStepStatus;
  detail: string;
}

export interface GoogleCloudProvisioningResult {
  projectId: string;
  topicFullName: string;
  subscriptionFullName: string;
  pushReceiverUrl: string;
  steps: ProvisioningStep[];
}

export enum GoogleCloudSetupStatus {
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed"
}

export interface GoogleCloudSetupStatusRecord {
  tenantSlug: string;
  status: GoogleCloudSetupStatus;
  projectId: string;
  topicName: string;
  topicFullName: string | null;
  subscriptionFullName: string | null;
  steps: ProvisioningStep[];
  errorMessage: string | null;
  startedAt: number;
  updatedAt: number;
}
