import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { GoogleCloudSetupStatusRecord } from "../../inbox/gmail-inbox.model";

const provisioningStepSchema = new mongoose.Schema({
  step: {type: String, required: true},
  status: {type: String, required: true},
  detail: {type: String, default: ""}
}, {_id: false});

const inboxSetupStatusSchema = new mongoose.Schema({
  tenantSlug: {type: String, required: true, unique: true, index: true},
  status: {type: String, required: true},
  projectId: {type: String, default: ""},
  topicName: {type: String, default: ""},
  topicFullName: {type: String, default: null},
  subscriptionFullName: {type: String, default: null},
  steps: {type: [provisioningStepSchema], default: []},
  errorMessage: {type: String, default: null},
  startedAt: {type: Number},
  updatedAt: {type: Number}
}, {collection: "inboxSetupStatus"});

export const inboxSetupStatus: mongoose.Model<GoogleCloudSetupStatusRecord> = ensureModel<GoogleCloudSetupStatusRecord>("inbox-setup-status", inboxSetupStatusSchema);
