import { ClientSession, Db, MongoClient, ObjectId } from "mongodb";
import { isArray } from "es-toolkit/compat";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { defaultTenantSlug } from "../inbox/inbox-aliases";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { CommitteeConfig } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { foldersExcludedFromInboxList, hiddenInboxFolders, InboxMessage, InboxMessageDirection, InboxThread, InboxThreadFolder, InboxUserFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { CONFIG_COLLECTION, INBOX_FOLDERS_COLLECTION, INBOX_MESSAGES_COLLECTION, INBOX_THREADS_COLLECTION } from "../mongo/migrations/shared/collection-names";
import { IMAP_SHARED_FOLDER_ROLE, MailClientUidCounter, MailClientUidMailbox, MailClientUidMailboxRecord, MailClientUidMembership, MailClientUidState } from "./mail-client-imap-uid.model";

const debugLog = debug(envConfig.logNamespace("mail-client:imap-uid"));

export const IMAP_UID_MAILBOXES_COLLECTION = "mailClientImapMailboxes";
export const IMAP_UID_MEMBERSHIPS_COLLECTION = "mailClientImapMemberships";
export const IMAP_UID_COUNTERS_COLLECTION = "mailClientImapCounters";
const MAX_IMAP_UID = 4294967295;

export function imapMailboxKey(mailbox: MailClientUidMailbox): string {
  return JSON.stringify([mailbox.tenantSlug, mailbox.roleType, mailbox.userFolderId ? null : mailbox.folder, mailbox.userFolderId]);
}

function threadIdValues(threadId: string): (string | ObjectId)[] {
  return ObjectId.isValid(threadId) ? [threadId, new ObjectId(threadId)] : [threadId];
}

export function userFolderMailboxKeyIsStale(mailboxKey: string): boolean {
  const parsed = JSON.parse(mailboxKey) as unknown;
  if (!isArray(parsed) || parsed.length < 4) {
    return false;
  } else {
    return Boolean(parsed[3]) && parsed[1] !== IMAP_SHARED_FOLDER_ROLE;
  }
}

export function imapMessageMailboxes(thread: InboxThread, message: InboxMessage): MailClientUidMailbox[] {
  const scope = {tenantSlug: thread.tenantSlug, roleType: thread.roleType};
  const folder = thread.folder ?? InboxThreadFolder.INBOX;
  const sentMessage = message.direction === InboxMessageDirection.OUTBOUND && !message.autoReply;
  const location: MailClientUidMailbox[] = folder === InboxThreadFolder.SENT && !sentMessage ? [] : foldersExcludedFromInboxList().includes(folder)
    ? [{...scope, folder, userFolderId: null}]
    : thread.userFolderId
      ? [{tenantSlug: thread.tenantSlug, roleType: IMAP_SHARED_FOLDER_ROLE, folder: null, userFolderId: thread.userFolderId}]
      : [{...scope, folder: InboxThreadFolder.INBOX, userFolderId: null}];
  const inSent = !hiddenInboxFolders().includes(folder) && sentMessage;
  return inSent && folder !== InboxThreadFolder.SENT ? location.concat({...scope, folder: InboxThreadFolder.SENT, userFolderId: null}) : location;
}

export async function imapUidState(db: Db, mailbox: MailClientUidMailbox): Promise<MailClientUidState> {
  const state = await db.collection<MailClientUidMailboxRecord>(IMAP_UID_MAILBOXES_COLLECTION).findOne({_id: imapMailboxKey(mailbox)});
  return {uidValidity: state?.uidValidity ?? 1, uidNext: state?.uidNext ?? 1};
}

export async function imapUidMemberships(db: Db, mailbox: MailClientUidMailbox, messageIds: string[] | null = null): Promise<MailClientUidMembership[]> {
  return db.collection<MailClientUidMembership>(IMAP_UID_MEMBERSHIPS_COLLECTION)
    .find({mailboxKey: imapMailboxKey(mailbox), active: true, ...(messageIds ? {messageId: {$in: messageIds}} : {})}).sort({uid: 1}).toArray();
}

async function lockMailbox(db: Db, session: ClientSession, mailbox: MailClientUidMailbox): Promise<MailClientUidMailboxRecord> {
  const key = imapMailboxKey(mailbox);
  const collection = db.collection<MailClientUidMailboxRecord>(IMAP_UID_MAILBOXES_COLLECTION);
  const existing = await collection.findOne({_id: key}, {session});
  if (existing) {
    return collection.findOneAndUpdate({_id: key}, {$inc: {revision: 1}}, {session, returnDocument: "after"});
  } else {
    const counter = await db.collection<MailClientUidCounter>(IMAP_UID_COUNTERS_COLLECTION).findOneAndUpdate(
      {_id: "uid-validity"}, {$inc: {value: 1}}, {session, upsert: true, returnDocument: "after"}
    );
    const uidValidity = counter.value + 1;
    if (uidValidity > MAX_IMAP_UID) {
      throw new Error("IMAP UIDVALIDITY space exhausted");
    } else {
      const state = {_id: key, ...mailbox, uidValidity, uidNext: 1, revision: 1};
      await collection.insertOne(state, {session});
      return state;
    }
  }
}

async function synchroniseThread(db: Db, session: ClientSession, threadId: string): Promise<void> {
  await db.collection<MailClientUidCounter>(IMAP_UID_COUNTERS_COLLECTION).updateOne(
    {_id: `thread:${threadId}`}, {$inc: {value: 1}}, {session, upsert: true}
  );
  const identities = threadIdValues(threadId);
  const thread = await db.collection(INBOX_THREADS_COLLECTION).findOne({_id: {$in: identities}} as never, {session}) as unknown as InboxThread | null;
  const messages = thread
    ? await db.collection(INBOX_MESSAGES_COLLECTION).find({threadId: {$in: identities}}, {session}).sort({receivedAt: 1, sentAt: 1, _id: 1}).toArray() as unknown as InboxMessage[]
    : [];
  const memberships = db.collection<MailClientUidMembership>(IMAP_UID_MEMBERSHIPS_COLLECTION);
  const threadMemberships = await memberships.find({threadId: {$in: [threadId, ...identities.map(String)]}}, {session}).toArray();
  const previous = threadMemberships.filter(entry => entry.active);
  const expunged = new Set(threadMemberships.filter(entry => !entry.active).map(entry => `${entry.mailboxKey}:${entry.messageId}`));
  const desired = messages.flatMap(message => imapMessageMailboxes(thread, message).flatMap(mailbox => {
    const mailboxKey = imapMailboxKey(mailbox);
    const messageId = String(message["_id"]);
    return expunged.has(`${mailboxKey}:${messageId}`) ? [] : [{mailbox, mailboxKey, messageId}];
  }));
  const mailboxKeys = [...new Set([...previous.map(entry => entry.mailboxKey), ...desired.map(entry => entry.mailboxKey)])].sort();
  for (const mailboxKey of mailboxKeys) {
    const wanted = desired.filter(entry => entry.mailboxKey === mailboxKey);
    const existingState = await db.collection<MailClientUidMailboxRecord>(IMAP_UID_MAILBOXES_COLLECTION).findOne({_id: mailboxKey}, {session});
    const mailbox = wanted[0]?.mailbox ?? existingState;
    if (mailbox) {
      const state = await lockMailbox(db, session, mailbox);
      const active = previous.filter(entry => entry.mailboxKey === mailboxKey);
      const removed = active.filter(entry => !wanted.some(item => item.messageId === entry.messageId));
      if (removed.length) {
        await memberships.updateMany({_id: {$in: removed.map(entry => entry._id)}}, {$set: {active: false}}, {session});
      }
      const additions = wanted.filter(item => !active.some(entry => entry.messageId === item.messageId));
      if (state.uidNext + additions.length > MAX_IMAP_UID) {
        throw new Error("IMAP mailbox UID space exhausted");
      } else if (additions.length) {
        await memberships.insertMany(additions.map((item, index) => ({
          _id: JSON.stringify([mailboxKey, state.uidNext + index]),
          mailboxKey,
          threadId,
          messageId: item.messageId,
          uid: state.uidNext + index,
          active: true
        })), {session});
        await db.collection<MailClientUidMailboxRecord>(IMAP_UID_MAILBOXES_COLLECTION).updateOne(
          {_id: mailboxKey}, {$inc: {uidNext: additions.length}}, {session}
        );
      }
    }
  }
}

export async function synchroniseImapThreadUids(db: Db, client: MongoClient, threadIds: string[]): Promise<void> {
  for (const threadId of [...new Set(threadIds)].filter(Boolean).sort()) {
    const session = client.startSession();
    try {
      await session.withTransaction(async () => synchroniseThread(db, session, threadId));
    } catch (error) {
      debugLog("failed to synchronise IMAP UIDs for thread", threadId, (error as Error).message);
    } finally {
      await session.endSession();
    }
  }
}

export async function bootstrapImapUids(db: Db, client: MongoClient): Promise<void> {
  await db.collection(IMAP_UID_MEMBERSHIPS_COLLECTION).createIndex({mailboxKey: 1, uid: 1}, {unique: true});
  await db.collection(IMAP_UID_MEMBERSHIPS_COLLECTION).createIndex({mailboxKey: 1, messageId: 1}, {unique: true, partialFilterExpression: {active: true}});
  await db.collection(IMAP_UID_MEMBERSHIPS_COLLECTION).createIndex({threadId: 1, active: 1});
  const threads = await db.collection(INBOX_THREADS_COLLECTION).find({}).project({_id: 1, tenantSlug: 1, roleType: 1, userFolderId: 1}).toArray();
  const prior = await db.collection<MailClientUidMembership>(IMAP_UID_MEMBERSHIPS_COLLECTION).find({active: true}).project({threadId: 1, mailboxKey: 1}).toArray();
  const folders = await db.collection(INBOX_FOLDERS_COLLECTION).find({}).toArray() as unknown as InboxUserFolder[];
  const committee = await db.collection(CONFIG_COLLECTION).findOne({key: ConfigKey.COMMITTEE});
  const roles = (committee?.value as CommitteeConfig)?.roles ?? [];
  const tenants = [...new Set([defaultTenantSlug(), ...threads.map(thread => thread.tenantSlug as string)])];
  const scopes = threads.map(thread => ({tenantSlug: thread.tenantSlug as string, roleType: thread.roleType as string})).concat(tenants.flatMap(tenantSlug => roles.map(role => ({tenantSlug, roleType: role.type}))));
  const scopeKeys = new Set<string>();
  for (const scope of scopes) {
    const scopeKey = JSON.stringify([scope.tenantSlug, scope.roleType]);
    if (!scopeKeys.has(scopeKey)) {
      scopeKeys.add(scopeKey);
      const mailboxes: MailClientUidMailbox[] = [InboxThreadFolder.INBOX, InboxThreadFolder.SENT, InboxThreadFolder.DRAFTS, InboxThreadFolder.JUNK, InboxThreadFolder.DELETED]
        .map(folder => ({tenantSlug: scope.tenantSlug, roleType: scope.roleType, folder, userFolderId: null}));
      mailboxes.push(...folders.filter(folder => folder.tenantSlug === scope.tenantSlug).map(folder => ({
        tenantSlug: scope.tenantSlug, roleType: IMAP_SHARED_FOLDER_ROLE, folder: null, userFolderId: String(folder.id ?? folder["_id"])
      })));
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          for (const mailbox of mailboxes) {
            await lockMailbox(db, session, mailbox);
          }
        });
      } finally {
        await session.endSession();
      }
    }
  }
  const filedThreadIds = threads.filter(thread => thread.userFolderId).map(thread => String(thread._id));
  const staleFolderThreadIds = prior.filter(entry => userFolderMailboxKeyIsStale(entry.mailboxKey)).map(entry => entry.threadId);
  await synchroniseImapThreadUids(db, client, [...filedThreadIds, ...staleFolderThreadIds]);
  await synchroniseImapThreadUids(db, client, [...threads.map(thread => String(thread._id)), ...prior.map(entry => entry.threadId)]);
}
