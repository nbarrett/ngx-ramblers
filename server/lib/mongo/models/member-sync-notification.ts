import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { MemberSyncNotification } from "../../../../projects/ngx-ramblers/src/app/models/member-sync-notification.model";

const schema = new mongoose.Schema({
  memberId: {type: String},
  fieldName: {type: String},
  localValue: {type: String, default: null},
  headOfficeValue: {type: String, default: null},
  resolution: {type: String},
  status: {type: String},
  firstSeenAt: {type: Number},
  lastSeenInSyncRunAt: {type: Number},
  sentAt: {type: Number},
  sentBy: {type: String},
}, {collection: "memberSyncNotifications"});

schema.index({memberId: 1, fieldName: 1});
schema.index({status: 1});

export const memberSyncNotification: mongoose.Model<MemberSyncNotification> = ensureModel<MemberSyncNotification>("member-sync-notification", schema);
