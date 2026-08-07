import { kebabCase } from "es-toolkit/compat";
import { InboxAddress, InboxMessage, InboxReplyComposeResponse, InboxThread } from "../models/inbox.model";

export function inboxThreadId(thread: InboxThread): string {
  return (thread?.id ?? (thread as unknown as { _id: { toString(): string } })?._id ?? "").toString();
}

export function inboxThreadSlug(thread: InboxThread): string {
  return kebabCase(thread?.normalisedSubject || thread?.subject || "");
}

export function inboxMessageAt(message: InboxMessage | null | undefined): number {
  return message?.receivedAt ?? message?.sentAt ?? 0;
}

export function newestInboxMessage(messages: InboxMessage[] | null | undefined): InboxMessage | null {
  return (messages || []).reduce<InboxMessage | null>((latest, candidate) =>
    !latest || inboxMessageAt(candidate) > inboxMessageAt(latest) ? candidate : latest, null);
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
