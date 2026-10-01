import { InboxAddress, InboxThread } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxThreadId } from "../../../projects/ngx-ramblers/src/app/functions/inbox-thread";
import { inboxMessage as inboxMessageModel } from "../mongo/models/inbox-message";

export async function withResolvedDisplayRecipients(threads: InboxThread[]): Promise<InboxThread[]> {
  const threadIds = threads.map(inboxThreadId);
  if (threadIds.length === 0) {
    return threads;
  } else {
    const latest = await inboxMessageModel.aggregate([
      {$match: {threadId: {$in: threadIds}}},
      {$addFields: {messageAt: {$ifNull: ["$receivedAt", "$sentAt"]}}},
      {$sort: {messageAt: -1}},
      {$group: {_id: "$threadId", from: {$first: "$from"}, to: {$first: "$to"}}}
    ]);
    const recipientsByThreadId = new Map<string, InboxAddress[]>(latest.map(row => [String(row._id), (row.to ?? []) as InboxAddress[]]));
    const sendersByThreadId = new Map<string, InboxAddress>(latest.map(row => [String(row._id), row.from as InboxAddress]));
    return threads.map(thread => ({...thread, receivedFrom: sendersByThreadId.get(inboxThreadId(thread)) ?? null, receivedTo: recipientsByThreadId.get(inboxThreadId(thread)) ?? null}));
  }
}
