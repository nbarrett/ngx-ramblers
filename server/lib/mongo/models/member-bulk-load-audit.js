const mongoose = require("mongoose");

const StatusMessageSchema = mongoose.Schema({
  status: {type: String},
  message: {type: String}
});

const RamblersMemberSchema = mongoose.Schema({
  membershipExpiryDate: {type: String},
  membershipNumber: {type: String},
  mobileNumber: {type: String},
  email: {type: String},
  firstName: {type: String},
  lastName: {type: String},
  postcode: {type: String},
});

const MemberBulkLoadAuditSchema = mongoose.Schema({
  createdDate: {type: Number},
  createdBy: {type: String},
  files: {
    archive: {type: String},
    data: {type: String},
  },
  auditLog: [StatusMessageSchema],
  members: [RamblersMemberSchema]
}, {collection: "memberBulkLoadAudit"});

module.exports = mongoose.model("member-bulk-load-audit", MemberBulkLoadAuditSchema);
