const mongoose = require("mongoose");

const deletedMemberSchema = mongoose.Schema({
  deletedAt: {type: Number},
  deletedBy: {type: String},
  memberId: {type: String},
  membershipNumber: {type: String},
}, {collection: "deletedMembers"});

module.exports = mongoose.model("deleted-member", deletedMemberSchema);

