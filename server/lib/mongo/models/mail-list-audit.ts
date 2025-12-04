import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { MailListAudit } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const schema = new mongoose.Schema({
  memberId: {type: String},
  createdBy: {type: String},
  listType: {type: String},
  timestamp: {type: Number},
  status: {type: String},
  audit: {type: Object},
}, {collection: "mailListAudit"});

schema.plugin(uniqueValidator);

export const mailListAudit: mongoose.Model<MailListAudit> =  ensureModel<MailListAudit>("mail-list-audit", schema);
