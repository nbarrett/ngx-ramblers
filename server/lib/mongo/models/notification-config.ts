import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const notificationConfigSchema = new mongoose.Schema({
  subject: {
    prefixParameter: {type: String},
    text: {type: String},
    suffixParameter: {type: String}
  },
  bannerId: {type: String},
  templateId: {type: Number},
  preSendActions: [{type: String}],
  defaultMemberSelection: {type: String},
  postSendActions: [{type: String}],
  monthsInPast: {type: Number},
  defaultListId: {type: Number},
  signOffRoles: [{type: String}],
  senderRole: {type: String},
  replyToRole: {type: String},
  ccRoles: [{type: String}],
  contentPreset: {type: String},
  help: {type: String},
  createdAt: {type: Number},
  createdBy: {type: String},
  updatedAt: {type: Number},
  updatedBy: {type: String},
}, {collection: "notificationConfigs"});

notificationConfigSchema.plugin(uniqueValidator);

export const notificationConfig: mongoose.Model<mongoose.Document> = mongoose.model("notification-config", notificationConfigSchema);
