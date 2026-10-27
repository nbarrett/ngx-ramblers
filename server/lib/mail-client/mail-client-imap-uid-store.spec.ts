import expect from "expect";
import { afterEach, beforeEach, describe, it } from "mocha";
import mongoose, { Connection, Model } from "mongoose";
import { Db, MongoClient, ObjectId } from "mongodb";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { InboxMessage, InboxMessageDirection, InboxThread, InboxThreadFolder } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxMessage } from "../mongo/models/inbox-message";
import { inboxThread } from "../mongo/models/inbox-thread";
import { bootstrapImapUids, imapMessageMailboxes, imapUidMemberships, imapUidState, IMAP_UID_MEMBERSHIPS_COLLECTION, synchroniseImapThreadUids } from "./mail-client-imap-uid-store";
import { MailClientUidMailbox } from "./mail-client-imap-uid.model";
import { withImapUidBulkWrites } from "./mail-client-imap-uid-hooks";

const inbox: MailClientUidMailbox = {tenantSlug: "example", roleType: "chair", folder: InboxThreadFolder.INBOX, userFolderId: null};
const threadId = new ObjectId();
const messageId = new ObjectId();
const thread: InboxThread = {
  tenantSlug: inbox.tenantSlug,
  roleType: inbox.roleType,
  folder: InboxThreadFolder.INBOX,
  userFolderId: null,
  externalAddress: {email: "alex.reed@example.com"},
  subject: "Hillside Park",
  firstSeenAt: 1,
  lastSeenAt: 1,
  lastDirection: InboxMessageDirection.INBOUND
} as InboxThread;
const message: InboxMessage = {
  threadId: String(threadId),
  direction: InboxMessageDirection.INBOUND,
  messageId: "<walk@example.com>",
  from: {email: "alex.reed@example.com"},
  to: [],
  cc: [],
  externalSource: "test",
  receivedAt: 1
} as unknown as InboxMessage;

describe("IMAP mailbox membership", () => {
  it("places outbound replies in Sent as well as their conversation folder", () => {
    expect(imapMessageMailboxes(thread, {...message, direction: InboxMessageDirection.OUTBOUND})).toEqual([inbox, {...inbox, folder: InboxThreadFolder.SENT}]);
    expect(imapMessageMailboxes({...thread, userFolderId: "folder-1"}, {...message, direction: InboxMessageDirection.OUTBOUND})).toEqual([
      {...inbox, folder: null, userFolderId: "folder-1"}, {...inbox, folder: InboxThreadFolder.SENT}
    ]);
  });

  it("excludes inbound messages and automatic replies from Sent", () => {
    expect(imapMessageMailboxes({...thread, folder: InboxThreadFolder.SENT}, message)).toEqual([]);
    expect(imapMessageMailboxes(thread, {...message, direction: InboxMessageDirection.OUTBOUND, autoReply: true})).toEqual([inbox]);
  });

  it("keeps junk and deleted conversations out of Sent", () => {
    [InboxThreadFolder.JUNK, InboxThreadFolder.DELETED].forEach(folder => {
      expect(imapMessageMailboxes({...thread, folder}, {...message, direction: InboxMessageDirection.OUTBOUND})).toEqual([{...inbox, folder}]);
    });
  });
});

const databaseTests = process.env.MAIL_CLIENT_UID_TEST_MONGODB_URI ? describe : describe.skip;

databaseTests("persistent IMAP UIDs with MongoDB transactions", function() {
  this.timeout(30000);
  const state = {connection: null as Connection | null, db: null as Db | null, client: null as MongoClient | null, threads: null as Model<InboxThread> | null, messages: null as Model<InboxMessage> | null};

  beforeEach(async () => {
    state.connection = await mongoose.createConnection(process.env.MAIL_CLIENT_UID_TEST_MONGODB_URI, {dbName: `imap_uid_test_${new ObjectId().toHexString()}`, autoIndex: false}).asPromise();
    state.db = state.connection.db;
    state.client = state.connection.getClient();
    state.threads = withImapUidBulkWrites(state.connection.model<InboxThread>("uid-test-thread", inboxThread.schema.clone()));
    state.messages = withImapUidBulkWrites(state.connection.model<InboxMessage>("uid-test-message", inboxMessage.schema.clone()));
    await state.db.collection("config").insertOne({key: ConfigKey.BREVO, value: {allowMailClientAccess: true}});
    await state.db.collection("inboxThreads").insertOne({_id: threadId, ...thread});
    await state.db.collection("inboxMessages").insertOne({_id: messageId, ...message});
    await bootstrapImapUids(state.db, state.client);
  });

  afterEach(async () => {
    await state.db?.dropDatabase();
    await state.connection?.close();
  });

  it("bootstraps historical mail once and preserves identifiers after restart", async () => {
    const initial = await imapUidState(state.db, inbox);
    expect(initial.uidValidity).toBeGreaterThan(1);
    expect(initial.uidNext).toBe(2);
    expect((await imapUidMemberships(state.db, inbox)).map(entry => entry.uid)).toEqual([1]);
    await bootstrapImapUids(state.db, state.client);
    expect(await imapUidState(state.db, inbox)).toEqual(initial);
    expect((await imapUidMemberships(state.db, inbox)).map(entry => entry.uid)).toEqual([1]);
    expect(await state.db.collection("inboxThreads").findOne({_id: threadId})).toEqual({_id: threadId, ...thread});
    expect(await state.db.collection("inboxMessages").findOne({_id: messageId})).toEqual({_id: messageId, ...message});
  });

  it("allocates increasing collision-free UIDs for concurrent imports and older mail", async () => {
    await Promise.all([1, 2, 3, 4].map(async index => {
      await state.messages.create({...message, messageId: `<walk-${index}@example.com>`, receivedAt: -index});
    }));
    const memberships = await imapUidMemberships(state.db, inbox);
    expect(memberships.map(entry => entry.uid)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(memberships.map(entry => entry.messageId)).size).toBe(5);
    expect((await imapUidState(state.db, inbox)).uidNext).toBe(6);
  });

  it("allocates a fresh UID when a conversation returns from a custom folder", async () => {
    const folder = {...inbox, folder: null, userFolderId: "folder-1"};
    await state.threads.updateOne({_id: threadId}, {$set: {userFolderId: "folder-1"}});
    expect(await imapUidMemberships(state.db, inbox)).toEqual([]);
    expect((await imapUidMemberships(state.db, folder)).map(entry => entry.uid)).toEqual([1]);
    await state.threads.updateOne({_id: threadId}, {$unset: {userFolderId: 1}});
    expect((await imapUidMemberships(state.db, inbox)).map(entry => entry.uid)).toEqual([2]);
    expect((await imapUidState(state.db, inbox)).uidNext).toBe(3);
    expect(await state.db.collection(IMAP_UID_MEMBERSHIPS_COLLECTION).countDocuments({active: false})).toBe(2);
  });

  it("keeps Sent identifiers while filing replies and reallocates after restoration from Deleted", async () => {
    const sent = {...inbox, folder: InboxThreadFolder.SENT};
    await state.messages.create({...message, messageId: "<reply@example.com>", direction: InboxMessageDirection.OUTBOUND});
    const original = await imapUidMemberships(state.db, sent);
    await state.threads.updateMany({_id: threadId}, {$set: {userFolderId: "folder-1"}});
    expect(await imapUidMemberships(state.db, sent)).toEqual(original);
    await state.threads.findOneAndUpdate({_id: threadId}, {$set: {folder: InboxThreadFolder.DELETED}});
    expect(await imapUidMemberships(state.db, sent)).toEqual([]);
    await state.threads.findOneAndUpdate({_id: threadId}, {$set: {folder: InboxThreadFolder.INBOX}});
    expect((await imapUidMemberships(state.db, sent)).map(entry => entry.uid)).toEqual([2]);
  });

  it("synchronises insertMany and bulk folder moves without waiting for a restart", async () => {
    await state.messages.insertMany([{...message, messageId: "<second@example.com>"}]);
    expect((await imapUidMemberships(state.db, inbox)).map(entry => entry.uid)).toEqual([1, 2]);
    await state.threads.bulkWrite([{updateOne: {filter: {_id: threadId}, update: {$set: {folder: InboxThreadFolder.JUNK}}}}]);
    expect(await imapUidMemberships(state.db, inbox)).toEqual([]);
    expect((await imapUidMemberships(state.db, {...inbox, folder: InboxThreadFolder.JUNK})).map(entry => entry.uid)).toEqual([1, 2]);
  });

  it("never reuses a UID after a message is removed and reinserted", async () => {
    await state.messages.deleteMany({_id: messageId});
    expect(await imapUidMemberships(state.db, inbox)).toEqual([]);
    await state.messages.create({_id: messageId, ...message});
    expect((await imapUidMemberships(state.db, inbox)).map(entry => entry.uid)).toEqual([2]);
  });

  it("isolates role mailboxes and gives recreated folders a different UIDVALIDITY", async () => {
    const firstFolder = {...inbox, folder: null, userFolderId: "folder-1"};
    const nextFolder = {...inbox, folder: null, userFolderId: "folder-2"};
    await state.threads.updateOne({_id: threadId}, {$set: {userFolderId: firstFolder.userFolderId}});
    const first = await imapUidState(state.db, firstFolder);
    await state.threads.updateOne({_id: threadId}, {$set: {userFolderId: nextFolder.userFolderId}});
    expect((await imapUidState(state.db, nextFolder)).uidValidity).not.toBe(first.uidValidity);
    await state.threads.updateOne({_id: threadId}, {$set: {roleType: "secretary", userFolderId: null}});
    expect(await imapUidMemberships(state.db, inbox)).toEqual([]);
    expect((await imapUidMemberships(state.db, {...inbox, roleType: "secretary"})).map(entry => entry.uid)).toEqual([1]);
  });

  it("leaves inbox persistence untouched when mail client access is disabled", async () => {
    await state.db.collection("config").updateOne({key: ConfigKey.BREVO}, {$set: {"value.allowMailClientAccess": false}});
    await state.threads.updateOne({_id: threadId}, {$set: {folder: InboxThreadFolder.JUNK}});
    expect((await imapUidMemberships(state.db, inbox)).map(entry => entry.uid)).toEqual([1]);
    expect(await imapUidMemberships(state.db, {...inbox, folder: InboxThreadFolder.JUNK})).toEqual([]);
    await bootstrapImapUids(state.db, state.client);
    expect(await imapUidMemberships(state.db, inbox)).toEqual([]);
  });

  it("does not allocate UIDs while reading a mailbox", async () => {
    const count = await state.db.collection(IMAP_UID_MEMBERSHIPS_COLLECTION).countDocuments();
    await imapUidState(state.db, inbox);
    await imapUidMemberships(state.db, inbox);
    await imapUidState(state.db, {...inbox, userFolderId: "missing-folder", folder: null});
    expect(await state.db.collection(IMAP_UID_MEMBERSHIPS_COLLECTION).countDocuments()).toBe(count);
    await synchroniseImapThreadUids(state.db, state.client, [String(threadId)]);
    expect(await state.db.collection(IMAP_UID_MEMBERSHIPS_COLLECTION).countDocuments()).toBe(count);
  });
});
