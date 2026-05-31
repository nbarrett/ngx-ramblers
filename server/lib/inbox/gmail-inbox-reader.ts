import { gmail_v1, google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import {
  InboxAddress,
  InboxAliasConfig,
  InboxAttachment,
  InboxMailboxConnection,
  InboxMessage,
  InboxMessageDirection,
  InboxReaderProvider
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { dateTimeNow } from "../shared/dates";
import { isString } from "es-toolkit/compat";
import { decryptInboxRefreshToken } from "./inbox-oauth-token-crypto";
import { systemConfig } from "../config/system-config";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { putBufferDirect } from "../aws/aws-controllers";
import { generateAwsFileName, isAwsUploadErrorResponse } from "../aws/aws-utils";

const debugLog = debug(envConfig.logNamespace("gmail-inbox-reader"));
debugLog.enabled = true;

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";

export function gmailScopes(): string[] {
  return [GMAIL_SCOPE];
}

export interface GoogleInboxOauthResolved {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  configured: boolean;
}

const OAUTH_NOT_CONFIGURED_MESSAGE = "Google Inbox OAuth client is not configured. Set the Client ID, Client Secret and Redirect URI in System Settings > External Systems > Gmail Inbox API.";

export async function resolveGoogleInboxOauth(): Promise<GoogleInboxOauthResolved> {
  const googleInbox = (await systemConfig())?.googleInbox;
  const clientId = googleInbox?.clientId ?? "";
  const clientSecret = googleInbox?.clientSecret ?? "";
  const redirectUri = googleInbox?.redirectUri ?? "";
  return {clientId, clientSecret, redirectUri, configured: !!(clientId && clientSecret && redirectUri)};
}

async function oauthClientForCredentials(): Promise<OAuth2Client> {
  const oauth = await resolveGoogleInboxOauth();
  if (!oauth.configured) {
    throw new Error(OAUTH_NOT_CONFIGURED_MESSAGE);
  }
  return new google.auth.OAuth2(oauth.clientId, oauth.clientSecret, oauth.redirectUri);
}

async function oauthClient(connection: InboxMailboxConnection): Promise<OAuth2Client> {
  const client = await oauthClientForCredentials();
  if (connection.oauthRefreshTokenEncrypted) {
    client.setCredentials({refresh_token: decryptInboxRefreshToken(connection.oauthRefreshTokenEncrypted)});
  }
  return client;
}

async function gmailFor(connection: InboxMailboxConnection): Promise<gmail_v1.Gmail> {
  return google.gmail({version: "v1", auth: await oauthClient(connection)});
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

export async function buildOauthConsentUrl(stateToken: string, options: OauthConsentOptions = {}): Promise<string> {
  const client = await oauthClientForCredentials();
  return client.generateAuthUrl({
    access_type: options.accessType ?? OauthAccessType.OFFLINE,
    prompt: "consent select_account",
    scope: options.scopes ?? gmailScopes(),
    state: stateToken,
    include_granted_scopes: options.includeGrantedScopes
  });
}

export async function exchangeOauthCodeForAccessToken(code: string): Promise<{ accessToken: string }> {
  const client = await oauthClientForCredentials();
  const {tokens} = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google did not return an access_token for the setup flow.");
  }
  return {accessToken: tokens.access_token};
}

export async function exchangeOauthCodeForRefreshToken(code: string): Promise<{ refreshToken: string; emailAddress: string }> {
  const client = await oauthClientForCredentials();
  const {tokens} = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh_token. Revoke the app's access in your Google account and retry the consent flow with prompt=consent.");
  }
  client.setCredentials(tokens);
  const profile = await google.gmail({version: "v1", auth: client}).users.getProfile({userId: "me"});
  const emailAddress = profile.data.emailAddress ?? "";
  if (!emailAddress) {
    throw new Error("Could not resolve Gmail address for the consented account.");
  }
  return {refreshToken: tokens.refresh_token, emailAddress};
}

export async function listRecentInboxMessageIds(connection: InboxMailboxConnection, aliasConfig: InboxAliasConfig, maxResults: number = 50): Promise<string[]> {
  const gmail = await gmailFor(connection);
  const response = await gmail.users.messages.list({
    userId: "me",
    q: `in:inbox to:${aliasConfig.roleEmail}`,
    maxResults
  });
  return (response.data.messages ?? []).map(m => m.id ?? "").filter(id => id.length > 0);
}

export async function listAllInboxMessageIds(connection: InboxMailboxConnection, maxResults: number = 100): Promise<string[]> {
  const gmail = await gmailFor(connection);
  const response = await gmail.users.messages.list({
    userId: "me",
    q: "in:inbox",
    maxResults
  });
  return (response.data.messages ?? []).map(m => m.id ?? "").filter(id => id.length > 0);
}

export async function mailboxHistoryId(connection: InboxMailboxConnection): Promise<string | null> {
  const gmail = await gmailFor(connection);
  const profile = await gmail.users.getProfile({userId: "me"});
  return profile.data.historyId ?? null;
}

export async function listHistoryDelta(connection: InboxMailboxConnection, startHistoryId: string): Promise<{ newMessageIds: string[]; latestHistoryId: string | null }> {
  const gmail = await gmailFor(connection);
  const response = await gmail.users.history.list({
    userId: "me",
    startHistoryId,
    historyTypes: ["messageAdded"],
    labelId: "INBOX"
  });
  const ids = (response.data.history ?? [])
    .flatMap(h => h.messagesAdded ?? [])
    .map(added => added.message?.id ?? "")
    .filter(id => id.length > 0);
  return {newMessageIds: ids, latestHistoryId: response.data.historyId ?? null};
}

export async function fetchFullMessage(connection: InboxMailboxConnection, gmailMessageId: string): Promise<InboxMessage> {
  const gmail = await gmailFor(connection);
  const response = await gmail.users.messages.get({
    userId: "me",
    id: gmailMessageId,
    format: "full"
  });
  const message = parseGmailMessage(response.data);
  message.attachments = await downloadAttachmentsToS3(gmail, gmailMessageId, response.data);
  return message;
}

interface GmailAttachmentRef {
  filename: string;
  contentType: string;
  sizeBytes: number;
  attachmentId: string;
}

function collectAttachmentRefs(part: gmail_v1.Schema$MessagePart | null): GmailAttachmentRef[] {
  if (!part) {
    return [];
  }
  const direct: GmailAttachmentRef[] = isAttachment(part) && part.body?.attachmentId
    ? [{
      filename: part.filename ?? "",
      contentType: part.mimeType ?? "application/octet-stream",
      sizeBytes: part.body?.size ?? 0,
      attachmentId: part.body.attachmentId
    }]
    : [];
  return direct.concat((part.parts ?? []).flatMap(collectAttachmentRefs));
}

async function downloadAttachmentsToS3(gmail: gmail_v1.Gmail, gmailMessageId: string, payload: gmail_v1.Schema$Message): Promise<InboxAttachment[]> {
  const refs = collectAttachmentRefs(payload.payload ?? null);
  return refs.reduce<Promise<InboxAttachment[]>>(async (acc, ref) => {
    const accumulator = await acc;
    return accumulator.concat(await downloadAttachmentToS3(gmail, gmailMessageId, ref));
  }, Promise.resolve([]));
}

async function downloadAttachmentToS3(gmail: gmail_v1.Gmail, gmailMessageId: string, ref: GmailAttachmentRef): Promise<InboxAttachment> {
  const metadataOnly: InboxAttachment = {filename: ref.filename, contentType: ref.contentType, sizeBytes: ref.sizeBytes, s3Key: ""};
  try {
    const attachment = await gmail.users.messages.attachments.get({userId: "me", messageId: gmailMessageId, id: ref.attachmentId});
    const data = attachment.data.data;
    if (!data) {
      return metadataOnly;
    }
    const buffer = Buffer.from(data, "base64url");
    const awsFileName = generateAwsFileName(ref.filename || `attachment-${ref.attachmentId}`);
    const uploadResult = await putBufferDirect(RootFolder.inboxAttachments, awsFileName, buffer, ref.contentType);
    if (isAwsUploadErrorResponse(uploadResult)) {
      debugLog("attachment upload to S3 failed for", ref.filename, "->", uploadResult.error);
      return {...metadataOnly, sizeBytes: ref.sizeBytes || buffer.length};
    }
    return {filename: ref.filename, contentType: ref.contentType, sizeBytes: ref.sizeBytes || buffer.length, s3Key: `${RootFolder.inboxAttachments}/${awsFileName}`};
  } catch (error) {
    debugLog("attachment download failed for", ref.filename, "->", (error as Error).message);
    return metadataOnly;
  }
}

export interface GmailWatchRegistration {
  historyId: string | null;
  expiration: number | null;
}

export async function registerGmailWatch(connection: InboxMailboxConnection, topicName: string): Promise<GmailWatchRegistration> {
  const gmail = await gmailFor(connection);
  const response = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "include"
    }
  });
  return {
    historyId: response.data.historyId ?? null,
    expiration: isString(response.data.expiration) ? parseInt(response.data.expiration, 10) : null
  };
}

export async function stopGmailWatch(connection: InboxMailboxConnection): Promise<void> {
  const gmail = await gmailFor(connection);
  await gmail.users.stop({userId: "me"});
}

export async function markMessagesRead(connection: InboxMailboxConnection, gmailMessageIds: string[]): Promise<void> {
  if (gmailMessageIds.length === 0) {
    return;
  }
  const gmail = await gmailFor(connection);
  await gmail.users.messages.batchModify({
    userId: "me",
    requestBody: {ids: gmailMessageIds, removeLabelIds: ["UNREAD"]}
  });
}

export async function markMessageRead(connection: InboxMailboxConnection, gmailMessageId: string): Promise<void> {
  const gmail = await gmailFor(connection);
  await gmail.users.messages.modify({
    userId: "me",
    id: gmailMessageId,
    requestBody: {removeLabelIds: ["UNREAD"]}
  });
}

export async function insertSentCopy(connection: InboxMailboxConnection, rfc822: string): Promise<string | null> {
  const gmail = await gmailFor(connection);
  const response = await gmail.users.messages.insert({
    userId: "me",
    internalDateSource: "dateHeader",
    requestBody: {
      raw: Buffer.from(rfc822, "utf8").toString("base64url"),
      labelIds: ["SENT"]
    }
  });
  return response.data.id ?? null;
}

export function parseGmailMessage(payload: gmail_v1.Schema$Message): InboxMessage {
  const headers = headerMap(payload.payload?.headers ?? []);
  const messageId = headers.get("message-id") ?? "";
  const inReplyTo = headers.get("in-reply-to") ?? null;
  const references = (headers.get("references") ?? "").split(/\s+/).filter(token => token.length > 0);
  const fromHeader = headers.get("from") ?? "";
  const toHeader = headers.get("to") ?? "";
  const ccHeader = headers.get("cc") ?? "";
  const subject = headers.get("subject") ?? "";
  const dateHeader = headers.get("date");
  const receivedAt = isString(payload.internalDate)
    ? parseInt(payload.internalDate, 10)
    : (dateHeader ? Date.parse(dateHeader) : dateTimeNow().toMillis());
  const {html, text, attachments} = walkParts(payload.payload ?? null);
  return {
    threadId: "",
    mailboxConnectionId: null,
    direction: InboxMessageDirection.INBOUND,
    messageId,
    inReplyTo,
    references,
    from: parseAddress(fromHeader),
    to: parseAddressList(toHeader),
    cc: parseAddressList(ccHeader),
    subject,
    bodyHtml: html,
    bodyText: text,
    receivedAt,
    sentAt: null,
    externalSource: InboxReaderProvider.GMAIL_API,
    externalId: payload.id ?? null,
    attachments
  };
}

function headerMap(headers: gmail_v1.Schema$MessagePartHeader[]): Map<string, string> {
  return headers.reduce<Map<string, string>>((acc, header) => {
    if (header.name && header.value) {
      acc.set(header.name.toLowerCase(), header.value);
    }
    return acc;
  }, new Map());
}

function walkParts(part: gmail_v1.Schema$MessagePart | null): { html: string | null; text: string | null; attachments: InboxAttachment[] } {
  if (!part) {
    return {html: null, text: null, attachments: []};
  }
  const directHtml = part.mimeType === "text/html" ? decodePartBody(part) : null;
  const directText = part.mimeType === "text/plain" ? decodePartBody(part) : null;
  const directAttachment = isAttachment(part) ? attachmentFor(part) : null;
  const childResults = (part.parts ?? []).map(walkParts);
  const html = directHtml ?? childResults.map(c => c.html).find(value => value !== null) ?? null;
  const text = directText ?? childResults.map(c => c.text).find(value => value !== null) ?? null;
  const attachments = (directAttachment ? [directAttachment] : []).concat(childResults.flatMap(c => c.attachments));
  return {html, text, attachments};
}

function decodePartBody(part: gmail_v1.Schema$MessagePart): string | null {
  const data = part.body?.data;
  if (!data) {
    return null;
  }
  return Buffer.from(data, "base64url").toString("utf8");
}

function isAttachment(part: gmail_v1.Schema$MessagePart): boolean {
  if (part.mimeType === "text/html" || part.mimeType === "text/plain" || part.mimeType?.startsWith("multipart/")) {
    return false;
  }
  return Boolean(part.filename && part.filename.length > 0);
}

function attachmentFor(part: gmail_v1.Schema$MessagePart): InboxAttachment {
  return {
    filename: part.filename ?? "",
    contentType: part.mimeType ?? "application/octet-stream",
    sizeBytes: part.body?.size ?? 0,
    s3Key: ""
  };
}

export function parseAddress(raw: string): InboxAddress {
  if (!raw) {
    return {name: null, email: ""};
  }
  const angleMatch = raw.match(/^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/);
  if (angleMatch) {
    const name = (angleMatch[1] ?? "").trim();
    return {name: name.length > 0 ? name : null, email: angleMatch[2].trim()};
  }
  return {name: null, email: raw.trim()};
}

export function parseAddressList(raw: string): InboxAddress[] {
  if (!raw) {
    return [];
  }
  return raw.split(/,(?![^<]*>)/).map(entry => parseAddress(entry)).filter(addr => addr.email.length > 0);
}
