import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";
import { MailchimpListAudit } from "../../../../projects/ngx-ramblers/src/app/models/mailchimp.model";

const schema = new mongoose.Schema({
  memberId: {type: String},
  listType: {type: String},
  timestamp: {type: Number},
  status: {type: String},
  audit: {type: Object},
}, {collection: "mailchimpListAudit"});

schema.plugin(uniqueValidator);

export const mailchimpListAudit: mongoose.Model<MailchimpListAudit> = mongoose.model<MailchimpListAudit>("mailchimp-list-audit", schema);
