import mongoose from "mongoose";
import { MemberBulkLoadAudit } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const StatusMessageSchema = new mongoose.Schema({
  status: {type: String},
  message: {type: String}
}, {_id: false});

const RamblersMemberSchema = new mongoose.Schema({
  membershipExpiryDate: {type: String},
  membershipNumber: {type: String},
  mobileNumber: {type: String},
  email: {type: String},
  firstName: {type: String},
  lastName: {type: String},
  postcode: {type: String},
}, {_id: false});

const MemberBulkLoadAuditSchema = new mongoose.Schema({
  createdDate: {type: Number},
  createdBy: {type: String},
  files: {
    archive: {type: String},
    data: {type: String},
  },
  auditLog: [StatusMessageSchema],
  members: [RamblersMemberSchema]
}, {collection: "memberBulkLoadAudit"});

export const memberBulkLoadAudit: mongoose.Model<MemberBulkLoadAudit> = mongoose.model<MemberBulkLoadAudit>("member-bulk-load-audit", MemberBulkLoadAuditSchema);
