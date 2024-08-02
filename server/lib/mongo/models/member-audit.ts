import mongoose from "mongoose";

const memberAuditSchema = new mongoose.Schema({
  userName: {type: String},
  loginTime: {type: Number},
  loginResponse: {type: Object},
  member: {type: Object}
}, {collection: "memberAudit"});

memberAuditSchema.index({ userName: 1 }, { unique: false });

export const memberAudit: mongoose.Model<mongoose.Document> = mongoose.model("member-audit", memberAuditSchema);
