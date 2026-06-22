import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig, CommitteeMember } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { InboxMessage, InboxMessageDirection, InboxThread } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { configuredBrevo } from "../brevo/brevo-config";
import { scheduleBrevo } from "../brevo/common/rate-limiting";
import { systemConfig } from "../config/system-config";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { connectedInboxEmails, defaultTenantSlug, derivedAliases } from "./inbox-aliases";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { member as memberModel } from "../mongo/models/member";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { dateTimeNow } from "../shared/dates";
import { pluraliseWithCount } from "../shared/string-utils";

const debugLog = debug(envConfig.logNamespace("inbox-message-digest"));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog("inbox-message-digest");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface DigestItem {
  message: InboxMessage;
  thread: InboxThread;
  role: CommitteeMember;
}

function digestRecipientEmail(role: CommitteeMember, member: Member | undefined): string {
  return (role.inboxNotificationEmail?.trim() || member?.email || "").trim();
}

export async function runInboxMessageDigest(): Promise<number> {
  const now = dateTimeNow().toMillis();
  const messages = await inboxMessageModel.find({
    direction: InboxMessageDirection.INBOUND,
    notifiedAt: null,
    receivedAt: {$ne: null, $gte: now - ONE_DAY_MS}
  }).sort({receivedAt: 1}).lean() as InboxMessage[];
  if (messages.length === 0) {
    debugLog("no unnotified inbox messages, nothing to send");
    return 0;
  }
  const threadIds = Array.from(new Set(messages.map(message => message.threadId)));
  const threads = await inboxThreadModel.find({_id: {$in: threadIds}}).lean() as InboxThread[];
  const threadById = threads.reduce<Map<string, InboxThread>>((map, thread) => {
    const threadId = ((thread as unknown as {_id: {toString(): string}})._id ?? thread.id ?? "").toString();
    map.set(threadId, thread);
    return map;
  }, new Map());

  const committeeConfigDocument = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeConfiguration: CommitteeConfig = committeeConfigDocument?.value;
  const rolesByType = (committeeConfiguration?.roles ?? []).reduce<Map<string, CommitteeMember>>((map, role) => {
    map.set(role.type, role);
    return map;
  }, new Map());

  const candidateMemberIds = Array.from(new Set((committeeConfiguration?.roles ?? [])
    .filter(role => role.inboxMessageNotifications === true)
    .map(role => role.memberId)
    .filter((memberId): memberId is string => Boolean(memberId) && /^[0-9a-fA-F]{24}$/.test(memberId))));
  const subscribers = await memberModel.find({
    _id: {$in: candidateMemberIds}
  }).lean() as unknown as Member[];
  const subscriberById = subscribers.reduce<Map<string, Member>>((map, member) => {
    const memberId = ((member as unknown as {_id?: {toString(): string}; id?: string})._id ?? (member as unknown as {id?: string}).id ?? "").toString();
    map.set(memberId, member);
    return map;
  }, new Map());

  const inboxRoutingAddresses = new Set<string>([
    ...(committeeConfiguration?.roles ?? []).map(role => role.email).filter((email): email is string => Boolean(email)).map(normaliseEmail),
    ...(await connectedInboxEmails(defaultTenantSlug())),
    ...(await derivedAliases()).map(alias => alias.roleEmail).filter((email): email is string => Boolean(email)).map(normaliseEmail)
  ]);
  const isInboxRoutingAddress = (email: string): boolean => inboxRoutingAddresses.has(normaliseEmail(email));

  const itemsByMember = messages.reduce<Map<string, DigestItem[]>>((map, message) => {
    const thread = threadById.get(message.threadId);
    if (!thread) {
      return map;
    }
    const role = rolesByType.get(thread.roleType);
    if (!role?.memberId || role.inboxMessageNotifications !== true) {
      return map;
    }
    const subscriber = subscriberById.get(role.memberId);
    if (!subscriber) {
      return map;
    }
    const recipientEmail = digestRecipientEmail(role, subscriber);
    if (!recipientEmail || isInboxRoutingAddress(recipientEmail)) {
      return map;
    }
    const existing = map.get(role.memberId) ?? [];
    existing.push({message, thread, role});
    map.set(role.memberId, existing);
    return map;
  }, new Map());

  if (itemsByMember.size === 0) {
    await markMessagesNotified(messages, now);
    debugLog(`${messages.length} message(s) had no opted-in committee recipient; marked notified`);
    return 0;
  }

  const systemCfg = await systemConfig();
  const groupHref = systemCfg?.group?.href ?? "";
  const groupShortName = systemCfg?.group?.shortName ?? "NGX Ramblers";
  const brevoConfig = await configuredBrevo();
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);

  const sentMessageIds: string[] = [];
  await Array.from(itemsByMember.entries()).reduce<Promise<void>>(async (acc, [memberId, items]) => {
    await acc;
    const member = subscriberById.get(memberId);
    if (!member) {
      return;
    }
    try {
      await sendDigestEmail(apiInstance, member, items, groupHref, groupShortName);
      items.forEach(item => sentMessageIds.push((item.message as unknown as {_id?: {toString(): string}})._id?.toString() ?? ""));
    } catch (error) {
      errorDebugLog(`digest send failed for member ${memberId}: ${(error as Error).message}`);
    }
  }, Promise.resolve());

  const validIds = sentMessageIds.filter(Boolean);
  if (validIds.length > 0) {
    await inboxMessageModel.updateMany({_id: {$in: validIds}}, {$set: {notifiedAt: now}});
  }
  debugLog(`sent ${itemsByMember.size} digest email(s) covering ${validIds.length} message(s)`);
  return validIds.length;
}

async function markMessagesNotified(messages: InboxMessage[], now: number): Promise<void> {
  const ids = messages.map(message => (message as unknown as {_id?: {toString(): string}})._id?.toString() ?? "").filter(Boolean);
  if (ids.length === 0) {
    return;
  }
  await inboxMessageModel.updateMany({_id: {$in: ids}}, {$set: {notifiedAt: now}});
}

async function sendDigestEmail(apiInstance: SibApiV3Sdk.TransactionalEmailsApi, member: Member, items: DigestItem[], groupHref: string, groupShortName: string): Promise<void> {
  const role = items[0].role;
  const senderName = role.fullName || role.description || groupShortName;
  const senderEmail = role.email || `noreply@${(groupHref || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "ngx-ramblers.org.uk"}`;
  const conversationCount = new Set(items.map(item => digestDedupeKey(item))).size;
  const subject = `${pluraliseWithCount(conversationCount, "new inbox message")} for ${role.description || role.type}`;
  const htmlContent = buildDigestHtml(items, groupHref, groupShortName);
  const recipientEmail = digestRecipientEmail(role, member);
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.sender = {name: senderName, email: senderEmail};
  sendSmtpEmail.to = [{email: recipientEmail, name: [member.firstName, member.lastName].filter(Boolean).join(" ") || member.userName || recipientEmail}];
  sendSmtpEmail.htmlContent = htmlContent;
  await scheduleBrevo(() => apiInstance.sendTransacEmail(sendSmtpEmail));
}

function threadIdOf(thread: InboxThread): string {
  return ((thread as unknown as {_id?: {toString(): string}; id?: string})._id ?? (thread as unknown as {id?: string}).id ?? "").toString();
}

function digestDedupeKey(item: DigestItem): string {
  return `${(item.message.from.email ?? "").toLowerCase()}|${item.thread.normalisedSubject ?? ""}`;
}

function buildDigestHtml(items: DigestItem[], groupHref: string, groupShortName: string): string {
  const heading = `<h2 style="font-family:sans-serif;color:#333">New inbox mail in ${escapeHtml(groupShortName)}</h2>`;
  const latestByContent = items.reduce<Map<string, DigestItem>>((map, item) => {
    const key = digestDedupeKey(item);
    const existing = map.get(key);
    if (!existing || (item.message.receivedAt ?? 0) > (existing.message.receivedAt ?? 0)) {
      map.set(key, item);
    }
    return map;
  }, new Map());
  const rows = Array.from(latestByContent.values()).map(item => {
    const sender = escapeHtml(item.message.from.name || item.message.from.email || "(unknown)");
    const subject = escapeHtml(item.message.subject || "(no subject)");
    const snippet = escapeHtml(buildSnippet(item.message));
    const threadId = threadIdOf(item.thread);
    const link = `${groupHref}/admin/inbox?thread=${encodeURIComponent(threadId)}`;
    return `<div style="border-top:1px solid #e0e0e0;padding:0.75em 0;font-family:sans-serif">
      <div><strong>${sender}</strong> &mdash; <span style="color:#555">${subject}</span></div>
      ${snippet ? `<div style="color:#666;margin-top:0.25em">${snippet}</div>` : ""}
      <div style="margin-top:0.5em"><a href="${link}" style="color:#c05711">Open this conversation</a></div>
    </div>`;
  }).join("");
  const allInboxLink = groupHref ? `<p style="font-family:sans-serif"><a href="${groupHref}/admin/inbox" style="color:#c05711">Open the inbox</a></p>` : "";
  const footer = `<p style="font-family:sans-serif;color:#888;font-size:0.85em">You're receiving this because you're assigned to the ${escapeHtml(items[0].role.description || items[0].role.type)} committee role and inbox notifications are enabled for it. A member administrator can turn these off in the Gmail inbox settings.</p>`;
  return `<div style="max-width:640px">${heading}${rows}${allInboxLink}${footer}</div>`;
}

function buildSnippet(message: InboxMessage): string {
  const source = message.bodyHtml ? stripHtml(message.bodyHtml) : (message.bodyText ?? "");
  if (!source) {
    return "";
  }
  const collapsed = source
    .replace(/\bhttps?:\/\/\S+/gi, " ")
    .replace(/\bmailto:\S+/gi, " ")
    .replace(/view this email in your browser/gi, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return collapsed.length > 200 ? `${collapsed.slice(0, 200)}…` : collapsed;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, "\"");
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
