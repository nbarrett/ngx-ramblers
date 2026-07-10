import mongoose, { Schema } from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { InboxMessage } from "../../../../projects/ngx-ramblers/src/app/models/inbox.model";

const inboxAddress = new Schema({
  name: {type: String, default: null},
  email: {type: String, required: true}
}, {_id: false});

const inboxAttachment = new Schema({
  filename: {type: String, required: true},
  contentType: {type: String, required: true},
  sizeBytes: {type: Number, required: true},
  s3Key: {type: String, required: true},
  contentId: {type: String, default: null}
}, {_id: false});

const inboxMessageSchema = new mongoose.Schema({
  threadId: {type: String, required: true, index: true},
  mailboxConnectionId: {type: String, default: null, index: true},
  direction: {type: String, required: true},
  messageId: {type: String, required: true, index: true},
  inReplyTo: {type: String, default: null},
  references: [{type: String}],
  from: {type: inboxAddress, required: true},
  to: [{type: inboxAddress}],
  cc: [{type: inboxAddress}],
  subject: {type: String, default: ""},
  bodyHtml: {type: String, default: null},
  bodyText: {type: String, default: null},
  receivedAt: {type: Number, default: null},
  sentAt: {type: Number, default: null},
  externalSource: {type: String, required: true},
  externalId: {type: String, default: null},
  attachments: [{type: inboxAttachment}],
  notifiedAt: {type: Number, default: null},
  conversationKey: {type: String, default: null, index: true}
}, {collection: "inboxMessages"});

inboxMessageSchema.plugin(uniqueValidator);

export const inboxMessage: mongoose.Model<InboxMessage> = ensureModel<InboxMessage>("inbox-message", inboxMessageSchema);
