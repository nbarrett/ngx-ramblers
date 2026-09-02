import { kebabCase } from "es-toolkit/compat";
import { InboxAddress, InboxAliasConfig, InboxMessage, InboxMessageDirection, InboxReplyComposeResponse, InboxThread, isInboxGeneralRoleType } from "../models/inbox.model";
import { normaliseEmail } from "./strings";

export const INBOX_SEND_COLLAPSE_WINDOW_MS = 5 * 60 * 1000;

export function inboxThreadId(thread: InboxThread): string {
  return (thread?.id ?? (thread as unknown as { _id: { toString(): string } })?._id ?? "").toString();
}

export function inboxThreadSlug(thread: InboxThread): string {
  return kebabCase(thread?.normalisedSubject || thread?.subject || "");
}

export function isInboxThreadMongoId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value);
}

export function aliasMailboxAddresses(alias: Pick<InboxAliasConfig, "roleEmail" | "additionalEmails">): string[] {
  return [alias.roleEmail, ...(alias.additionalEmails ?? [])]
    .map(address => (address ?? "").trim())
    .filter(address => address.length > 0)
    .reduce<string[]>((unique, address) => unique.some(existing => existing.toLowerCase() === address.toLowerCase()) ? unique : unique.concat(address), []);
}

export function aliasMailboxHeading(alias: Pick<InboxAliasConfig, "roleType" | "roleEmail">): string {
  if (isInboxGeneralRoleType(alias.roleType)) {
    return "Other inbox mail";
  } else {
    return alias.roleEmail;
  }
}

export function aliasMailboxExtraAddresses(alias: Pick<InboxAliasConfig, "roleType" | "roleEmail" | "additionalEmails">): string[] {
  if (isInboxGeneralRoleType(alias.roleType)) {
    return [];
  } else {
    return aliasMailboxAddresses(alias)
      .filter(address => normaliseEmail(address) !== normaliseEmail(alias.roleEmail));
  }
}

export function aliasMailboxLabel(alias: Pick<InboxAliasConfig, "roleType" | "roleEmail" | "additionalEmails">): string {
  const extras = aliasMailboxExtraAddresses(alias);
  if (extras.length === 0) {
    return aliasMailboxHeading(alias);
  } else {
    return `${aliasMailboxHeading(alias)} + ${extras.length} more`;
  }
}

export function aliasMailboxExtraCaption(alias: Pick<InboxAliasConfig, "roleType" | "roleEmail" | "additionalEmails">): string | null {
  const extras = aliasMailboxExtraAddresses(alias);
  if (extras.length === 0) {
    return null;
  } else if (extras.length === 1) {
    return extras[0];
  } else if (extras.length === 2) {
    return `${extras[0]} and ${extras[1]}`;
  } else {
    return `${extras.slice(0, -1).join(", ")} and ${extras[extras.length - 1]}`;
  }
}

export function deliveredToFromMessage(message: InboxMessage, alias: Pick<InboxAliasConfig, "roleEmail" | "additionalEmails">): InboxAddress | null {
  const identity = new Set(aliasMailboxAddresses(alias).map(address => normaliseEmail(address)).filter(Boolean));
  const match = [...(message.to ?? []), ...(message.cc ?? [])]
    .find(address => identity.has(normaliseEmail(address?.email)));
  if (match?.email) {
    return match;
  } else if (alias.roleEmail) {
    return {name: null, email: alias.roleEmail};
  } else {
    return null;
  }
}

export function inboxThreadRoleLine(thread: InboxThread, roleEmail: string | null): string | null {
  const sentFromEmail = thread?.sentFrom?.email || null;
  const deliveredToEmail = thread?.deliveredTo?.email || null;
  return thread?.lastDirection === InboxMessageDirection.OUTBOUND
    ? ((sentFromEmail || roleEmail) ? `from ${sentFromEmail || roleEmail}` : null)
    : ((deliveredToEmail || roleEmail) ? `to ${deliveredToEmail || roleEmail}` : null);
}

export function inboxMessageAt(message: InboxMessage | null | undefined): number {
  return message?.receivedAt ?? message?.sentAt ?? 0;
}

export function newestInboxMessage(messages: InboxMessage[] | null | undefined): InboxMessage | null {
  return (messages || []).reduce<InboxMessage | null>((latest, candidate) =>
    !latest || inboxMessageAt(candidate) > inboxMessageAt(latest) ? candidate : latest, null);
}

export function inboxThreadRowFrom(thread: InboxThread, roleEmail: string | null): string | null {
  return thread?.lastDirection === InboxMessageDirection.OUTBOUND
    ? thread?.sentFrom?.name || thread?.sentFrom?.email || roleEmail
    : thread?.externalAddress?.name || thread?.externalAddress?.email || null;
}

export function inboxThreadRowTo(thread: InboxThread, roleEmail: string | null): string | null {
  return thread?.lastDirection === InboxMessageDirection.OUTBOUND
    ? thread?.externalAddress?.name || thread?.externalAddress?.email || null
    : thread?.deliveredTo?.email || roleEmail;
}

export function inboxThreadHeaderFrom(messages: InboxMessage[] | null | undefined): InboxAddress | null {
  const latest = newestInboxMessage(messages);
  return latest?.from?.email ? latest.from : null;
}

export function inboxThreadHeaderTo(messages: InboxMessage[] | null | undefined): InboxAddress[] {
  return newestInboxMessage(messages)?.to ?? [];
}

export function inboxMessageMatchingId(messages: InboxMessage[] | null | undefined, messageId: string | null | undefined): InboxMessage | null {
  return messageId
    ? ((messages || []).find(message => message.messageId === messageId) ?? null)
    : null;
}

export function replyAllRecipients(reply: InboxReplyComposeResponse, target: InboxMessage, roleEmails: string[]): InboxAddress[] {
  const excluded = new Set([reply?.to?.email?.toLowerCase(), ...(roleEmails || []).map(email => email?.toLowerCase())]);
  const seen = new Set<string>();
  return [...(reply?.cc ?? []), ...(target?.to ?? []), ...(target?.cc ?? [])].filter(address => {
    const email = address?.email?.toLowerCase();
    const include = !!email && !excluded.has(email) && !seen.has(email);
    if (include) {
      seen.add(email);
    }
    return include;
  });
}

export function inboxThreadMatchingSlug(threads: InboxThread[], slug: string): InboxThread | undefined {
  const matches = (threads || []).filter(thread => inboxThreadSlug(thread) === slug);
  return matches.sort((left, right) => (right?.lastSeenAt || 0) - (left?.lastSeenAt || 0))[0];
}

export function inboxMessageBodyKey(message: InboxMessage): string {
  const raw = message.bodyHtml?.trim() ? message.bodyHtml : (message.bodyText ?? "");
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function inboxSendCollapseKey(message: InboxMessage): string {
  const subject = (message.subject ?? "").replace(/^(?:re|fwd?|aw)\s*:\s*/gi, "").trim().toLowerCase();
  return `${(message.from?.email ?? "").toLowerCase()}|${subject}|${message.direction}`;
}

function unionInboxAddresses(existing: InboxAddress[], incoming: InboxAddress[]): InboxAddress[] {
  const seen = new Set((existing ?? []).map(address => address.email.toLowerCase()));
  return (incoming ?? []).reduce((merged, address) => {
    if (seen.has(address.email.toLowerCase())) {
      return merged;
    } else {
      seen.add(address.email.toLowerCase());
      return merged.concat(address);
    }
  }, [...(existing ?? [])]);
}

function dedupeInboxMessages(messages: InboxMessage[]): InboxMessage[] {
  const seen = new Set<string>();
  return messages.filter(message => {
    const key = message.externalId || message.messageId;
    if (seen.has(key)) {
      return false;
    } else {
      seen.add(key);
      return true;
    }
  });
}

function takeRicherInboxBody(target: InboxMessage, incoming: InboxMessage): InboxMessage {
  if (inboxMessageBodyKey(target) || !inboxMessageBodyKey(incoming)) {
    return target;
  } else {
    return {...target, bodyHtml: incoming.bodyHtml, bodyText: incoming.bodyText};
  }
}

export function collapseInboxSends(messages: InboxMessage[]): InboxMessage[] {
  const groups: InboxMessage[] = [];
  const groupsByKey = new Map<string, InboxMessage[]>();
  dedupeInboxMessages(messages).forEach(message => {
    const key = inboxSendCollapseKey(message);
    const at = inboxMessageAt(message);
    const incomingBody = inboxMessageBodyKey(message);
    const candidates = groupsByKey.get(key) ?? [];
    const group = candidates.find(existing => {
      const existingBody = inboxMessageBodyKey(existing);
      const sameBody = !incomingBody || !existingBody || incomingBody === existingBody;
      return sameBody && Math.abs(inboxMessageAt(existing) - at) <= INBOX_SEND_COLLAPSE_WINDOW_MS;
    });
    if (group) {
      const richer = takeRicherInboxBody(group, message);
      group.bodyHtml = richer.bodyHtml;
      group.bodyText = richer.bodyText;
      group.to = unionInboxAddresses(group.to, message.to);
      group.cc = unionInboxAddresses(group.cc, message.cc);
    } else {
      const created = {...message, to: [...(message.to ?? [])], cc: [...(message.cc ?? [])]};
      groups.push(created);
      groupsByKey.set(key, [...candidates, created]);
    }
  });
  return groups;
}
