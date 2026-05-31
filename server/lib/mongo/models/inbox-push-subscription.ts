import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { InboxPushSubscription } from "../../../../projects/ngx-ramblers/src/app/models/inbox.model";

const inboxPushSubscriptionSchema = new mongoose.Schema({
  tenantSlug: {type: String, required: true, index: true},
  memberId: {type: String, required: true, index: true},
  endpoint: {type: String, required: true, unique: true},
  p256dh: {type: String, required: true},
  auth: {type: String, required: true},
  userAgent: {type: String, default: null},
  createdAt: {type: Number, required: true},
  lastSeenAt: {type: Number, required: true}
}, {collection: "inboxPushSubscriptions"});

inboxPushSubscriptionSchema.plugin(uniqueValidator);

export const inboxPushSubscription: mongoose.Model<InboxPushSubscription> = ensureModel<InboxPushSubscription>("inbox-push-subscription", inboxPushSubscriptionSchema);
