const mongoose = require("mongoose");
const member = require("./member");

const memberUpdateAuditSchema = mongoose.Schema({
  uploadSessionId: {type: String},
  updateTime: {type: Number},
  memberAction: {type: String},
  rowNumber: {type: Number},
  changes: {type: Number},
  auditMessage: {type: String},
  memberId: {type: String},
  member: member.schema,
  auditErrorMessage: {type: Object}
}, {collection: "memberUpdateAudit"});

module.exports = mongoose.model("member-update-audit", memberUpdateAuditSchema);

