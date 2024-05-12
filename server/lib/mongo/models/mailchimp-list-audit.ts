import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const schema = new mongoose.Schema({
  memberId: {type: String},
  listType: {type: String},
  timestamp: {type: Number},
  status: {type: String},
  audit: {type: Object},
}, {collection: "mailchimpListAudit"});

schema.plugin(uniqueValidator);

export const mailchimpListAudit: mongoose.Model<mongoose.Document> = mongoose.model("mailchimp-list-audit", schema);
