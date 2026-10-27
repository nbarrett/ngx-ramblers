import mongoose from "mongoose";
import {ensureModel} from "../utils/model-utils";
import {MailClientSubmission, MailClientSubmissionStatus} from "../../../../projects/ngx-ramblers/src/app/models/mail-client-submission.model";
import {values} from "es-toolkit/compat";

const schema = new mongoose.Schema({
  _id: {type: String, required: true},
  memberId: {type: String, required: true},
  messageId: {type: String, required: true},
  payloadHash: {type: String, required: true},
  status: {type: String, enum: values(MailClientSubmissionStatus), required: true},
  createdAt: {type: Number, required: true},
  updatedAt: {type: Number, required: true},
  providerKey: {type: String, required: true},
  request: mongoose.Schema.Types.Mixed,
  alias: mongoose.Schema.Types.Mixed,
  outbound: mongoose.Schema.Types.Mixed,
  internalEmails: [String],
  error: {type: String, default: null}
}, {collection: "mailClientSubmissions"});

export const mailClientSubmission: mongoose.Model<MailClientSubmission> = ensureModel<MailClientSubmission>("mail-client-submission", schema);
