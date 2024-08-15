import mongoose from "mongoose";

const memberUpdateAuditSchema = new mongoose.Schema({
  uploadSessionId: {type: String},
  updateTime: {type: Number},
  memberAction: {type: String},
  rowNumber: {type: Number},
  changes: {type: Number},
  auditMessage: {type: String},
  memberId: {type: String},
  member: {type: Object},
  auditErrorMessage: {type: Object}
}, {collection: "memberUpdateAudit"});


export const memberUpdateAudit: mongoose.Model<mongoose.Document> = mongoose.model("member-update-audit", memberUpdateAuditSchema);
