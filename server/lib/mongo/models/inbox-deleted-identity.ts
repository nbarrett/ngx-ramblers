import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { InboxDeletedIdentity } from "../../../../projects/ngx-ramblers/src/app/models/inbox.model";

const inboxDeletedIdentitySchema = new mongoose.Schema({
  tenantSlug: {type: String, required: true, index: true},
  threadId: {type: String, required: true, index: true},
  messageIds: [{type: String, index: true}],
  externalIds: [{type: String, index: true}],
  conversationKeys: [{type: String, index: true}],
  deletedAt: {type: Number, required: true, index: true}
}, {collection: "inboxDeletedIdentities"});

inboxDeletedIdentitySchema.plugin(uniqueValidator);

export const inboxDeletedIdentity: mongoose.Model<InboxDeletedIdentity> = ensureModel<InboxDeletedIdentity>("inbox-deleted-identity", inboxDeletedIdentitySchema);
