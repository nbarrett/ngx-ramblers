import { Db, MongoClient, ObjectId } from "mongodb";
import { InboxMessage, InboxMessageDirection, InboxReaderProvider, InboxThreadFolder } from "../../../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { normaliseEmail } from "../../../../../projects/ngx-ramblers/src/app/functions/strings";
import { dateTimeNow } from "../../../shared/dates";
import createMigrationLogger from "../migrations-logger";
import { INBOX_MESSAGES_COLLECTION, INBOX_THREADS_COLLECTION, NOTIFICATION_CONFIG_COLLECTION } from "../shared/collection-names";

const debugLog = createMigrationLogger("repair-inbox-and-email-defaults");

function internalEmailsFrom(committee: Record<string, unknown> | null, connections: Record<string, unknown>[]): Set<string> {
  const roles = (committee?.roles ?? []) as Record<string, unknown>[];
  const roleEmails = roles.flatMap(role => [
    role.email,
    ...((role.additionalEmails ?? []) as unknown[]),
    role.forwardEmailCustom,
    ...((role.forwardEmailRecipients ?? []) as unknown[])
  ]);
  const connectionEmails = connections.map(connection => connection.gmailAccountEmail);
  return new Set([...roleEmails, ...connectionEmails]
    .map(value => normaliseEmail(String(value ?? "")))
    .filter(Boolean));
}

export function misclassifiedInboundMessage(message: InboxMessage, internalEmails: Set<string>): boolean {
  const sender = normaliseEmail(message.from?.email ?? "");
  const recipients = [...(message.to ?? []), ...(message.cc ?? [])]
    .map(address => normaliseEmail(address.email))
    .filter(Boolean);
  return message.direction === InboxMessageDirection.OUTBOUND
    && message.externalSource !== InboxReaderProvider.EMAIL_COMPOSER
    && message.externalSource !== InboxReaderProvider.NONE
    && Boolean(message.externalId)
    && Boolean(sender)
    && !internalEmails.has(sender)
    && recipients.some(recipient => internalEmails.has(recipient));
}

async function repairMisclassifiedInboundMessages(db: Db): Promise<void> {
  const [committeeDocument, connections, outboundMessages] = await Promise.all([
    db.collection("config").findOne({key: "committee"}),
    db.collection("inboxMailboxConnections").find({}).toArray(),
    db.collection(INBOX_MESSAGES_COLLECTION).find({direction: InboxMessageDirection.OUTBOUND}).toArray()
  ]);
  const internalEmails = internalEmailsFrom((committeeDocument?.value ?? null) as Record<string, unknown> | null, connections);
  const messages = (outboundMessages as unknown as InboxMessage[]).filter(message => misclassifiedInboundMessage(message, internalEmails));
  const messageIds = messages.map(message => message.messageId);
  const repairedAt = dateTimeNow().toMillis();
  const result = messageIds.length > 0
    ? await db.collection(INBOX_MESSAGES_COLLECTION).updateMany(
      {messageId: {$in: messageIds}},
      [{$set: {
        direction: InboxMessageDirection.INBOUND,
        receivedAt: {$ifNull: ["$receivedAt", "$sentAt"]},
        sentAt: null,
        notifiedAt: repairedAt
      }}]
    )
    : {modifiedCount: 0};
  const threadIds = Array.from(new Set(messages.map(message => message.threadId).filter(Boolean)));
  await threadIds.reduce<Promise<void>>(async (previous, threadId) => {
    await previous;
    const threadMessages = await db.collection(INBOX_MESSAGES_COLLECTION).find({threadId}).sort({receivedAt: -1, sentAt: -1}).toArray() as unknown as InboxMessage[];
    const latest = threadMessages[0] ?? null;
    const latestOutbound = threadMessages.find(message => message.direction === InboxMessageDirection.OUTBOUND) ?? null;
    if (latest) {
      const latestAt = latest.receivedAt ?? latest.sentAt ?? 0;
      const externalAddress = latest.direction === InboxMessageDirection.INBOUND
        ? latest.from
        : [...(latest.to ?? []), ...(latest.cc ?? [])].find(address => !internalEmails.has(normaliseEmail(address.email))) ?? latest.to?.[0] ?? latest.from;
      await db.collection(INBOX_THREADS_COLLECTION).updateOne({_id: new ObjectId(threadId)}, {$set: {
        folder: InboxThreadFolder.INBOX,
        lastDirection: latest.direction,
        lastSeenAt: latestAt,
        externalAddress,
        sentFrom: latestOutbound?.from?.email ? latestOutbound.from : null
      }});
    }
  }, Promise.resolve());
  debugLog("Restored %s misclassified incoming message(s) across %s conversation(s)", result.modifiedCount, threadIds.length);
}

async function moveOutboundOnlyThreadsToSent(db: Db): Promise<void> {
  const messages = db.collection(INBOX_MESSAGES_COLLECTION);
  const outboundThreadIds = await messages.distinct("threadId", {direction: InboxMessageDirection.OUTBOUND});
  const inboundThreadIds = new Set(await messages.distinct("threadId", {
    threadId: {$in: outboundThreadIds},
    direction: InboxMessageDirection.INBOUND
  }));
  const outboundOnlyThreadObjectIds = outboundThreadIds
    .filter(threadId => !inboundThreadIds.has(threadId) && ObjectId.isValid(threadId))
    .map(threadId => new ObjectId(threadId));
  const result = outboundOnlyThreadObjectIds.length > 0
    ? await db.collection(INBOX_THREADS_COLLECTION).updateMany(
      {_id: {$in: outboundOnlyThreadObjectIds}, folder: InboxThreadFolder.INBOX},
      {$set: {folder: InboxThreadFolder.SENT}}
    )
    : {modifiedCount: 0};
  debugLog("Moved %s outbound-only conversation(s) from Inbox to Sent", result.modifiedCount);
}

async function setNewsletterAsDefaultEmailType(db: Db): Promise<void> {
  const collection = db.collection(NOTIFICATION_CONFIG_COLLECTION);
  const newsletterCriteria = {"subject.text": /^Newsletter$/i};
  const newsletterCount = await collection.countDocuments(newsletterCriteria);
  if (newsletterCount > 0) {
    const cleared = await collection.updateMany(
      {defaultListing: true, "subject.text": {$not: /^Newsletter$/i}},
      {$set: {defaultListing: false}}
    );
    const set = await collection.updateMany(
      newsletterCriteria,
      {$set: {defaultListing: true}}
    );
    debugLog("Set Newsletter as default email type on %s configuration(s); cleared %s other default(s)", set.modifiedCount, cleared.modifiedCount);
  } else {
    debugLog("No Newsletter configuration found; existing default email type left unchanged");
  }
}

export async function up(db: Db, _client: MongoClient): Promise<void> {
  await repairMisclassifiedInboundMessages(db);
  await moveOutboundOnlyThreadsToSent(db);
  await setNewsletterAsDefaultEmailType(db);
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("Repaired inbox folders and Newsletter default email type are left as they are");
}
