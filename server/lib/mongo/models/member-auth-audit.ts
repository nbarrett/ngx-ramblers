import mongoose from "mongoose";
import * as memberModel  from "./member";
import { MemberAuthAudit } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const memberAuthAuditSchema = new mongoose.Schema({
  userName: {type: String},
  loginTime: {type: Number},
  loginResponse: {type: Object},
  member: memberModel.member.schema,
}, {collection: "memberAudit"});


export const memberAuthAudit: mongoose.Model<MemberAuthAudit> = mongoose.model<MemberAuthAudit>("member-auth-audit", memberAuthAuditSchema);
