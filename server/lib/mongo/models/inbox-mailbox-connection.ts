import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { InboxMailboxConnection } from "../../../../projects/ngx-ramblers/src/app/models/inbox.model";

const inboxMailboxConnectionSchema = new mongoose.Schema({
  tenantSlug: {type: String, required: true, index: true},
  provider: {type: String, required: true},
  gmailAccountEmail: {type: String, default: null},
  oauthRefreshTokenEncrypted: {type: String, default: null},
  syncMode: {type: String, required: true, default: "poll"},
  pubsubTopicName: {type: String, default: null},
  pubsubSubscriptionName: {type: String, default: null},
  watchExpiresAt: {type: Number, default: null},
  lastHistoryId: {type: String, default: null},
  lastPolledAt: {type: Number, default: null},
  lastHealthCheckAt: {type: Number, default: null},
  connectionStatus: {type: String, required: true, default: "not-connected"},
  accessMode: {type: String, required: true, default: "all-committee-roles"},
  importAllMessages: {type: Boolean, default: false},
  lastErrorMessage: {type: String, default: null},
  enabled: {type: Boolean, default: true},
  createdAt: {type: Number},
  createdBy: {type: String},
  updatedAt: {type: Number},
  updatedBy: {type: String}
}, {collection: "inboxMailboxConnections"});

inboxMailboxConnectionSchema.index({tenantSlug: 1, gmailAccountEmail: 1}, {unique: true, partialFilterExpression: {gmailAccountEmail: {$type: "string"}}});

inboxMailboxConnectionSchema.plugin(uniqueValidator);

export const inboxMailboxConnection: mongoose.Model<InboxMailboxConnection> = ensureModel<InboxMailboxConnection>("inbox-mailbox-connection", inboxMailboxConnectionSchema);
