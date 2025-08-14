import mongoose from "mongoose";
import { MemberUpdateAudit } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const memberUpdateAuditSchema = new mongoose.Schema({
  uploadSessionId: {type: String},
  updateTime: {type: Number},
  memberMatch: {type: String},
  memberAction: {type: String},
  rowNumber: {type: Number},
  changes: {type: Number},
  auditMessage: {type: String},
  memberId: {type: String},
  member: {type: Object},
  auditErrorMessage: {type: Object}
}, {collection: "memberUpdateAudit"});


export const memberUpdateAudit: mongoose.Model<MemberUpdateAudit> = mongoose.model<MemberUpdateAudit>("member-update-audit", memberUpdateAuditSchema);
