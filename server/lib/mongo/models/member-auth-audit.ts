import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { MemberAuthAudit } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const memberAuthAuditSchema = new mongoose.Schema({
  userName: {type: String},
  loginTime: {type: Number},
  loginResponse: {type: Object},
  member: {type: Object},
}, {collection: "memberAudit"});

memberAuthAuditSchema.set("autoIndex", false);

export const memberAuthAudit: mongoose.Model<MemberAuthAudit> = ensureModel<MemberAuthAudit>("member-auth-audit", memberAuthAuditSchema);
