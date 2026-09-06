import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { MailSendRefusal } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const schema = new mongoose.Schema({
  purpose: {type: String, required: true},
  channel: {type: String, required: true},
  reason: {type: String, required: true},
  message: {type: String, required: true},
  subject: {type: String},
  recipientCount: {type: Number},
  requestedBy: {type: String},
  refusedAt: {type: Number, required: true, index: true}
}, {collection: "mailSendRefusals"});

export const mailSendRefusal: mongoose.Model<MailSendRefusal> = ensureModel<MailSendRefusal>("mail-send-refusal", schema);
