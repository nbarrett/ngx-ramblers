import { InboxAddress, InboxMessage, InboxMessageDirection, InboxThread } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxThreadId } from "../../../projects/ngx-ramblers/src/app/functions/inbox-thread";

export interface SentMessageRowsResult {
  rows: InboxThread[];
  totalCount: number;
}

export function sentMessageRows(threads: InboxThread[], messages: InboxMessage[], offset: number, limit: number): SentMessageRowsResult {
  const threadsById = new Map(threads.map(thread => [inboxThreadId(thread), thread]));
  const seenMessageIds = new Set<string>();
  const rows = messages
    .filter(message => threadsById.has(String(message.threadId)))
    .filter(message => {
      if (seenMessageIds.has(message.messageId)) {
        return false;
      } else {
        seenMessageIds.add(message.messageId);
        return true;
      }
    })
    .map(message => sentRowFor(threadsById.get(String(message.threadId)), message))
    .sort((left, right) => (right.lastOutboundAt ?? 0) - (left.lastOutboundAt ?? 0));
  return {rows: rows.slice(offset, offset + limit), totalCount: rows.length};
}

function sentRowFor(thread: InboxThread, message: InboxMessage): InboxThread {
  return {
    ...thread,
    subject: message.subject || thread.subject,
    externalAddress: sentRecipientAddress(message) ?? thread.externalAddress,
    lastDirection: InboxMessageDirection.OUTBOUND,
    lastOutboundAt: message.sentAt ?? message.receivedAt ?? 0,
    sentMessageId: message.messageId
  };
}

function sentRecipientAddress(message: InboxMessage): InboxAddress | null {
  const recipients = (message.to ?? []).filter(recipient => !!recipient?.email);
  if (recipients.length === 0) {
    return null;
  } else {
    const first = recipients[0];
    const extra = recipients.length > 1 ? ` +${recipients.length - 1}` : "";
    return {name: `${first.name || first.email}${extra}`, email: first.email};
  }
}
