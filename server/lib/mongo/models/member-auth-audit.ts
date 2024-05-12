import mongoose from "mongoose";
import * as memberModel  from "./member";

const memberAuthAuditSchema = new mongoose.Schema({
  userName: {type: String},
  loginTime: {type: Number},
  loginResponse: {type: Object},
  member: memberModel.member.schema,
}, {collection: "memberAudit"});


export const memberAuthAudit: mongoose.Model<mongoose.Document> = mongoose.model("member-auth-audit", memberAuthAuditSchema);
