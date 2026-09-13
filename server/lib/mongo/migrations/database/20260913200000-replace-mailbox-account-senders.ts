import { Db, MongoClient, ObjectId } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { compositionSenderEmail } from "../../../inbox/inbox-composition-sender";
import { normaliseEmail } from "../../../../../projects/ngx-ramblers/src/app/functions/strings";
import { InboxReaderProvider } from "../../../../../projects/ngx-ramblers/src/app/models/inbox.model";

const debugLog = createMigrationLogger("replace-mailbox-account-senders");

export async function up(db: Db, _client: MongoClient): Promise<void> {
  const connections = await db.collection("inboxMailboxConnections").find({gmailAccountEmail: {$ne: null}}).toArray();
  const accountEmails = new Set(connections.map(connection => normaliseEmail(String(connection.gmailAccountEmail))));
  if (accountEmails.size === 0) {
    debugLog("no mailbox connections with an account address - nothing to replace");
    return;
  }
  const composerMessages = await db.collection("inboxMessages")
    .find({externalSource: InboxReaderProvider.EMAIL_COMPOSER}).toArray();
  const affected = composerMessages.filter(message => message.from?.email && accountEmails.has(normaliseEmail(String(message.from.email))));
  debugLog(`${affected.length} sent messages carry a mailbox account address as their sender`);
  const replacements = await affected.reduce(async (previous, message) => {
    const replaced = await previous;
    const composition = message.externalId && ObjectId.isValid(String(message.externalId))
      ? await db.collection("emailCompositions").findOne({_id: new ObjectId(String(message.externalId))})
      : null;
    const owner = composition?.ownerMemberId && ObjectId.isValid(String(composition.ownerMemberId))
      ? await db.collection("members").findOne({_id: new ObjectId(String(composition.ownerMemberId))}, {projection: {email: 1, firstName: 1, lastName: 1}})
      : null;
    const senderEmail = compositionSenderEmail({
      brandingMode: composition?.state?.brandingMode,
      brandedSenderEmail: composition?.state?.brandedSenderEmail,
      unbrandedSenderEmail: composition?.state?.unbrandedSenderEmail,
      ownerEmail: owner?.email,
      mailboxAccountEmail: String(message.from.email)
    });
    if (!senderEmail) {
      debugLog(`leaving ${message.messageId} alone: no address other than the mailbox account is known for it`);
      return replaced;
    } else {
      const senderName = message.from?.name || [owner?.firstName, owner?.lastName].filter(Boolean).join(" ");
      const from = {name: senderName || "", email: senderEmail};
      await db.collection("inboxMessages").updateOne({_id: message._id}, {$set: {from}});
      await db.collection("inboxThreads").updateOne(
        {_id: new ObjectId(String(message.threadId)), "sentFrom.email": message.from.email},
        {$set: {sentFrom: from}});
      debugLog(`${message.messageId}: sender replaced with ${senderEmail}`);
      return replaced + 1;
    }
  }, Promise.resolve(0));
  const remainingThreads = await db.collection("inboxThreads")
    .find({"sentFrom.email": {$ne: null}}).toArray();
  const strandedThreads = remainingThreads.filter(thread => accountEmails.has(normaliseEmail(String(thread.sentFrom.email))));
  await Promise.all(strandedThreads.map(thread => db.collection("inboxThreads").updateOne({_id: thread._id}, {$unset: {sentFrom: ""}})));
  debugLog(`replaced ${replacements} senders and cleared ${strandedThreads.length} thread sender summaries still holding a mailbox account address`);
}

export async function down(_db: Db, _client: MongoClient): Promise<void> {
  debugLog("Senders are not restored to the mailbox account address.");
}
