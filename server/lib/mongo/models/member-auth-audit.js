const mongoose = require("mongoose");
const member = require("./member");

const memberAuthAuditSchema = mongoose.Schema({
  userName: {type: String},
  loginTime: {type: Number},
  loginResponse: {type: Object},
  member: member.schema,
}, {collection: "memberAudit"});

module.exports = mongoose.model("member-auth-audit", memberAuthAuditSchema);

