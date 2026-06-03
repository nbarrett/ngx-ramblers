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
import {
  GMAIL_API_ROOT,
  GMAIL_DYNAMIC_ENDPOINTS,
  GMAIL_DYNAMIC_QUERIES,
  GMAIL_SCOPES,
  GmailEndpoint,
  GmailHeader,
  GmailHistoryType,
  GmailInternalDateSource,
  GmailLabel,
  GmailMimePrefix,
  GmailMimeType,
  GmailQuery,
  GmailAttachment,
  GmailAttachmentRef,
  GmailHistoryResponse,
  GmailMessage,
  GmailMessageListResponse,
  GmailMessagePart,
  GmailMessagePartHeader,
  GmailProfile,
  GmailQueryParams,
  GmailRequestMethod,
  GmailRequestOptions,
  GmailWatchRegistration,
  GmailWatchResponse,
  GoogleInboxOauthResolved,
  OauthAccessType,
  OauthConsentOptions
} from "./gmail-inbox.model";

const debugLog = debug(envConfig.logNamespace("gmail-inbox-reader"));
debugLog.enabled = true;

export function gmailScopes(): string[] {
  return GMAIL_SCOPES;
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
  return new OAuth2Client(oauth.clientId, oauth.clientSecret, oauth.redirectUri);
}

async function oauthClient(connection: InboxMailboxConnection): Promise<OAuth2Client> {
  const client = await oauthClientForCredentials();
  if (connection.oauthRefreshTokenEncrypted) {
    client.setCredentials({refresh_token: decryptInboxRefreshToken(connection.oauthRefreshTokenEncrypted)});
  }
  return client;
}

async function gmailRequest<T = unknown>(connection: InboxMailboxConnection, path: string, params: GmailQueryParams | null = null, options: GmailRequestOptions = {}): Promise<T> {
  return gmailRequestWithClient(await oauthClient(connection), path, params, options);
}

async function gmailRequestWithClient<T = unknown>(client: OAuth2Client, path: string, params: GmailQueryParams | null = null, options: GmailRequestOptions = {}): Promise<T> {
  const response = await client.request<T>({
    url: `${GMAIL_API_ROOT}${path}`,
    method: options.method ?? "GET",
    params: params ?? undefined,
    data: options.data
  });
  return response.data;
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
  const profile = await gmailRequestWithClient<GmailProfile>(client, GmailEndpoint.PROFILE);
  const emailAddress = profile.emailAddress ?? "";
  if (!emailAddress) {
    throw new Error("Could not resolve Gmail address for the consented account.");
  }
  return {refreshToken: tokens.refresh_token, emailAddress};
}

export async function listRecentInboxMessageIds(connection: InboxMailboxConnection, aliasConfig: InboxAliasConfig, maxResults: number = 50): Promise<string[]> {
  const response = await gmailRequest<GmailMessageListResponse>(connection, GmailEndpoint.MESSAGES, {
    q: GMAIL_DYNAMIC_QUERIES.INBOX_TO(aliasConfig.roleEmail),
    maxResults
  });
  return (response.messages ?? []).map(m => m.id ?? "").filter(id => id.length > 0);
}

export async function listAllInboxMessageIds(connection: InboxMailboxConnection, maxResults: number = 100): Promise<string[]> {
  const response = await gmailRequest<GmailMessageListResponse>(connection, GmailEndpoint.MESSAGES, {
    q: GmailQuery.INBOX,
    maxResults
  });
  return (response.messages ?? []).map(m => m.id ?? "").filter(id => id.length > 0);
}

export async function findGmailMessageIdByRfcHeader(connection: InboxMailboxConnection, rfcMessageId: string): Promise<string | null> {
  const stripped = rfcMessageId.replace(/^<|>$/g, "");
  if (!stripped) return null;
  const response = await gmailRequest<GmailMessageListResponse>(connection, GmailEndpoint.MESSAGES, {
    q: `rfc822msgid:${stripped}`,
    maxResults: 1,
    includeSpamTrash: true
  });
  const firstId = (response.messages ?? [])[0]?.id;
  return firstId && firstId.length > 0 ? firstId : null;
}

export async function mailboxHistoryId(connection: InboxMailboxConnection): Promise<string | null> {
  const profile = await gmailRequest<GmailProfile>(connection, GmailEndpoint.PROFILE);
  return profile.historyId ?? null;
}

export async function listHistoryDelta(connection: InboxMailboxConnection, startHistoryId: string): Promise<{ newMessageIds: string[]; latestHistoryId: string | null }> {
  const response = await gmailRequest<GmailHistoryResponse>(connection, GmailEndpoint.HISTORY, {
    startHistoryId,
    historyTypes: GmailHistoryType.MESSAGE_ADDED,
    labelId: GmailLabel.INBOX
  });
  const ids = (response.history ?? [])
    .flatMap(h => h.messagesAdded ?? [])
    .map(added => added.message?.id ?? "")
    .filter(id => id.length > 0);
  return {newMessageIds: ids, latestHistoryId: response.historyId ?? null};
}

export async function fetchFullMessage(connection: InboxMailboxConnection, gmailMessageId: string): Promise<InboxMessage> {
  const payload = await gmailRequest<GmailMessage>(connection, GMAIL_DYNAMIC_ENDPOINTS.MESSAGE(gmailMessageId), {
    format: "full"
  });
  const message = parseGmailMessage(payload);
  message.attachments = await downloadAttachmentsToS3(connection, gmailMessageId, payload);
  return message;
}

function collectAttachmentRefs(part: GmailMessagePart | null): GmailAttachmentRef[] {
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

async function downloadAttachmentsToS3(connection: InboxMailboxConnection, gmailMessageId: string, payload: GmailMessage): Promise<InboxAttachment[]> {
  const refs = collectAttachmentRefs(payload.payload ?? null);
  return refs.reduce<Promise<InboxAttachment[]>>(async (acc, ref) => {
    const accumulator = await acc;
    return accumulator.concat(await downloadAttachmentToS3(connection, gmailMessageId, ref));
  }, Promise.resolve([]));
}

async function downloadAttachmentToS3(connection: InboxMailboxConnection, gmailMessageId: string, ref: GmailAttachmentRef): Promise<InboxAttachment> {
  const metadataOnly: InboxAttachment = {filename: ref.filename, contentType: ref.contentType, sizeBytes: ref.sizeBytes, s3Key: ""};
  try {
    const attachment = await gmailRequest<GmailAttachment>(connection, GMAIL_DYNAMIC_ENDPOINTS.ATTACHMENT(gmailMessageId, ref.attachmentId));
    const data = attachment.data;
    if (!data) {
      return metadataOnly;
    }
    const buffer = Buffer.from(data, "base64url");
    const [
      {RootFolder},
      {putBufferDirect},
      {generateAwsFileName, isAwsUploadErrorResponse}
    ] = await Promise.all([
      import("../../../projects/ngx-ramblers/src/app/models/system.model"),
      import("../aws/aws-controllers"),
      import("../aws/aws-utils")
    ]);
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

export async function registerGmailWatch(connection: InboxMailboxConnection, topicName: string): Promise<GmailWatchRegistration> {
  const response = await gmailRequest<GmailWatchResponse>(connection, GmailEndpoint.WATCH, null, {
    method: GmailRequestMethod.POST,
    data: {
      topicName,
      labelIds: [GmailLabel.INBOX],
      labelFilterBehavior: "include"
    }
  });
  return {
    historyId: response.historyId ?? null,
    expiration: isString(response.expiration) ? parseInt(response.expiration, 10) : null
  };
}

export async function stopGmailWatch(connection: InboxMailboxConnection): Promise<void> {
  await gmailRequest(connection, GmailEndpoint.STOP, null, {method: GmailRequestMethod.POST, data: {}});
}

export async function markMessagesRead(connection: InboxMailboxConnection, gmailMessageIds: string[]): Promise<void> {
  if (gmailMessageIds.length === 0) {
    return;
  }
  await gmailRequest(connection, GmailEndpoint.BATCH_MODIFY, null, {method: GmailRequestMethod.POST, data: {ids: gmailMessageIds, removeLabelIds: [GmailLabel.UNREAD]}});
}

export async function markMessageRead(connection: InboxMailboxConnection, gmailMessageId: string): Promise<void> {
  await gmailRequest(connection, GMAIL_DYNAMIC_ENDPOINTS.MESSAGE_MODIFY(gmailMessageId), null, {method: GmailRequestMethod.POST, data: {removeLabelIds: [GmailLabel.UNREAD]}});
}

export async function insertSentCopy(connection: InboxMailboxConnection, rfc822: string): Promise<string | null> {
  const response = await gmailRequest<GmailMessage>(connection, GmailEndpoint.INSERT, {internalDateSource: GmailInternalDateSource.DATE_HEADER}, {
    method: GmailRequestMethod.POST,
    data: {
      raw: Buffer.from(rfc822, "utf8").toString("base64url"),
      labelIds: [GmailLabel.SENT]
    }
  });
  return response.id ?? null;
}

export function parseGmailMessage(payload: GmailMessage): InboxMessage {
  const headers = headerMap(payload.payload?.headers ?? []);
  const messageId = headers.get(GmailHeader.MESSAGE_ID) ?? "";
  const inReplyTo = headers.get(GmailHeader.IN_REPLY_TO) ?? null;
  const references = (headers.get(GmailHeader.REFERENCES) ?? "").split(/\s+/).filter(token => token.length > 0);
  const fromHeader = headers.get(GmailHeader.FROM) ?? "";
  const toHeader = headers.get(GmailHeader.TO) ?? "";
  const ccHeader = headers.get(GmailHeader.CC) ?? "";
  const subject = headers.get(GmailHeader.SUBJECT) ?? "";
  const dateHeader = headers.get(GmailHeader.DATE);
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

function headerMap(headers: GmailMessagePartHeader[]): Map<string, string> {
  return headers.reduce<Map<string, string>>((acc, header) => {
    if (header.name && header.value) {
      acc.set(header.name.toLowerCase(), header.value);
    }
    return acc;
  }, new Map());
}

function walkParts(part: GmailMessagePart | null): { html: string | null; text: string | null; attachments: InboxAttachment[] } {
  if (!part) {
    return {html: null, text: null, attachments: []};
  }
  const directHtml = part.mimeType === GmailMimeType.HTML ? decodePartBody(part) : null;
  const directText = part.mimeType === GmailMimeType.PLAIN ? decodePartBody(part) : null;
  const directAttachment = isAttachment(part) ? attachmentFor(part) : null;
  const childResults = (part.parts ?? []).map(walkParts);
  const html = directHtml ?? childResults.map(c => c.html).find(value => value !== null) ?? null;
  const text = directText ?? childResults.map(c => c.text).find(value => value !== null) ?? null;
  const attachments = (directAttachment ? [directAttachment] : []).concat(childResults.flatMap(c => c.attachments));
  return {html, text, attachments};
}

function decodePartBody(part: GmailMessagePart): string | null {
  const data = part.body?.data;
  if (!data) {
    return null;
  }
  return Buffer.from(data, "base64url").toString("utf8");
}

function isAttachment(part: GmailMessagePart): boolean {
  if (part.mimeType === GmailMimeType.HTML || part.mimeType === GmailMimeType.PLAIN || part.mimeType?.startsWith(GmailMimePrefix.MULTIPART)) {
    return false;
  }
  return Boolean(part.filename && part.filename.length > 0);
}

function attachmentFor(part: GmailMessagePart): InboxAttachment {
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
