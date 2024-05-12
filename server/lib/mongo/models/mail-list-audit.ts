import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const schema = new mongoose.Schema({
  memberId: {type: String},
  createdBy: {type: String},
  listType: {type: String},
  timestamp: {type: Number},
  status: {type: String},
  audit: {type: Object},
}, {collection: "mailListAudit"});

schema.plugin(uniqueValidator);

export const mailListAudit: mongoose.Model<mongoose.Document> =  mongoose.model("mail-list-audit", schema);
