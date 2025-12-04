import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { MemberAuthAudit } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const memberAuditSchema = new mongoose.Schema({
  userName: {type: String},
  loginTime: {type: Number},
  loginResponse: {type: Object},
  member: {type: Object}
}, {collection: "memberAudit"});

memberAuditSchema.index({ userName: 1 }, { unique: false });

export const memberAudit: mongoose.Model<MemberAuthAudit> = ensureModel<MemberAuthAudit>("member-audit", memberAuditSchema);
