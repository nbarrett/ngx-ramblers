import mongoose = require("mongoose");
import * as memberModel  from "./member";

const memberAuthAuditSchema = mongoose.Schema({
  userName: {type: String},
  loginTime: {type: Number},
  loginResponse: {type: Object},
  member: memberModel.member.schema,
}, {collection: "memberAudit"});


export const memberAuthAudit = mongoose.model("member-auth-audit", memberAuthAuditSchema);
