import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const memberAuditSchema = new mongoose.Schema({
  userName: {type: String},
  loginTime: {type: Number},
  loginResponse: {type: Object},
  member: {type: Object}
}, {collection: "memberAudit"});

memberAuditSchema.plugin(uniqueValidator);

export const memberAudit: mongoose.Model<mongoose.Document> = mongoose.model("member-audit", memberAuditSchema);
