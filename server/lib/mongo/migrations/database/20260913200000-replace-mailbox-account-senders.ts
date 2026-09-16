import { Db, Document, FindCursor, MongoClient, ObjectId } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import {
  holdsMailboxAccountAddress,
  replacementSender,
  senderOutsideMailboxAccounts
} from "../../../inbox/inbox-composition-sender";
import { normaliseEmail } from "../../../../../projects/ngx-ramblers/src/app/functions/strings";
import { InboxMessageDirection, InboxReaderProvider } from "../../../../../projects/ngx-ramblers/src/app/models/inbox.model";

const debugLog = createMigrationLogger("replace-mailbox-account-senders");

async function forEachDocument(cursor: FindCursor<Document>, action: (document: Document) => Promise<void>): Promise<void> {
  while (await cursor.hasNext()) {
    await action(await cursor.next());
  }
}

async function documentById(db: Db, collection: string, id: unknown, projection?: Document): Promise<Document | null> {
  return id && ObjectId.isValid(String(id))
    ? db.collection(collection).findOne({_id: new ObjectId(String(id))}, {projection})
    : null;
}

async function replaceMessageSenders(db: Db, accountEmails: Set<string>): Promise<number> {
  const progress = {replaced: 0};
  const outboundComposerMessages = db.collection("inboxMessages")
    .find({externalSource: InboxReaderProvider.EMAIL_COMPOSER, direction: InboxMessageDirection.OUTBOUND});
  await forEachDocument(outboundComposerMessages, async message => {
    if (holdsMailboxAccountAddress(message.from, accountEmails)) {
      const composition = await documentById(db, "emailCompositions", message.externalId);
      const owner = await documentById(db, "members", composition?.ownerMemberId, {email: 1, firstName: 1, lastName: 1});
      const from = replacementSender(message.from, composition?.state, owner);
      if (from) {
        await db.collection("inboxMessages").updateOne({_id: message._id}, {$set: {from}});
        debugLog(`${message.messageId}: sender replaced with ${from.email}`);
        progress.replaced += 1;
      } else {
        debugLog(`leaving ${message.messageId} alone: no address other than the mailbox account is known for it`);
      }
    }
  });
  return progress.replaced;
}

async function repairThreadSenders(db: Db, accountEmails: Set<string>): Promise<{repaired: number; cleared: number}> {
  const progress = {repaired: 0, cleared: 0};
  const threadsWithSender = db.collection("inboxThreads").find({"sentFrom.email": {$nin: [null, ""]}});
  await forEachDocument(threadsWithSender, async thread => {
    if (holdsMailboxAccountAddress(thread.sentFrom, accountEmails)) {
      const latestOutbound = await db.collection("inboxMessages")
        .find({threadId: thread._id.toString(), direction: InboxMessageDirection.OUTBOUND})
        .sort({sentAt: -1, receivedAt: -1})
        .limit(1)
        .next();
      const sentFrom = senderOutsideMailboxAccounts(latestOutbound?.from, accountEmails);
      if (sentFrom) {
        await db.collection("inboxThreads").updateOne({_id: thread._id}, {$set: {sentFrom}});
        progress.repaired += 1;
      } else {
        await db.collection("inboxThreads").updateOne({_id: thread._id}, {$unset: {sentFrom: ""}});
        progress.cleared += 1;
      }
    }
  });
  return progress;
}

export async function up(db: Db, _client: MongoClient): Promise<void> {
  const connections = await db.collection("inboxMailboxConnections").find({gmailAccountEmail: {$ne: null}}).toArray();
  const accountEmails = new Set(connections.map(connection => normaliseEmail(String(connection.gmailAccountEmail))));
  if (accountEmails.size === 0) {
    debugLog("no mailbox connections with an account address - nothing to replace");
  } else {
    const replaced = await replaceMessageSenders(db, accountEmails);
    const threads = await repairThreadSenders(db, accountEmails);
    debugLog(`replaced ${replaced} message senders, repaired ${threads.repaired} thread sender summaries from their latest outbound message and cleared ${threads.cleared} still holding only a mailbox account address`);
  }
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("Senders are not restored to the mailbox account address.");
}
