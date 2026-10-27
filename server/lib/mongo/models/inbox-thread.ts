import { maintainImapUids, withImapUidBulkWrites } from "../../mail-client/mail-client-imap-uid-hooks";
import mongoose, { Schema } from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { InboxThread } from "../../../../projects/ngx-ramblers/src/app/models/inbox.model";

const inboxAddress = new Schema({
  name: {type: String, default: null},
  email: {type: String, required: true}
}, {_id: false});

const inboxThreadSchema = new mongoose.Schema({
  tenantSlug: {type: String, required: true, index: true},
  roleType: {type: String, required: true, index: true},
  externalAddress: {type: inboxAddress, required: true},
  subject: {type: String, default: ""},
  normalisedSubject: {type: String, default: ""},
  slug: {type: String, default: "", index: true},
  folder: {type: String, default: "inbox", index: true},
  userFolderId: {type: String, default: null, index: true},
  deletedAt: {type: Number, default: null},
  messageIds: [{type: String}],
  firstSeenAt: {type: Number, required: true},
  lastSeenAt: {type: Number, required: true, index: true},
  lastDirection: {type: String, required: true},
  sentFrom: {type: inboxAddress, default: null},
  deliveredTo: {type: inboxAddress, default: null},
  unread: {type: Boolean, default: true, index: true},
  readByMemberIds: {type: [String], default: [], index: true},
  conversationKey: {type: String, default: null, index: true}
}, {collection: "inboxThreads"});

inboxThreadSchema.index({tenantSlug: 1, slug: 1, lastSeenAt: -1});
inboxThreadSchema.plugin(uniqueValidator);
inboxThreadSchema.plugin(maintainImapUids);

export const inboxThread: mongoose.Model<InboxThread> = withImapUidBulkWrites(ensureModel<InboxThread>("inbox-thread", inboxThreadSchema));
