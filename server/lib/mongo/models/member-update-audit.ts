import mongoose from "mongoose";
import * as memberModel from "./member";

const memberUpdateAuditSchema = new mongoose.Schema({
  uploadSessionId: {type: String},
  updateTime: {type: Number},
  memberAction: {type: String},
  rowNumber: {type: Number},
  changes: {type: Number},
  auditMessage: {type: String},
  memberId: {type: String},
  member: memberModel.member.schema,
  auditErrorMessage: {type: Object}
}, {collection: "memberUpdateAudit"});


export const memberUpdateAudit: mongoose.Model<mongoose.Document> = mongoose.model("member-update-audit", memberUpdateAuditSchema);
