const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const memberAuditSchema = mongoose.Schema({
  userName: {type: String},
  loginTime: {type: Number},
  loginResponse: {type: Object},
  member: {type: Object}
}, {collection: "memberAudit"});

memberAuditSchema.plugin(uniqueValidator);

module.exports = mongoose.model("member-audit", memberAuditSchema);

