import mongoose = require("mongoose");
import uniqueValidator = require("mongoose-unique-validator");

const schema = mongoose.Schema({
  memberId: {type: String},
  createdBy: {type: String},
  listType: {type: String},
  timestamp: {type: Number},
  status: {type: String},
  audit: {type: Object},
}, {collection: "mailListAudit"});

schema.plugin(uniqueValidator);

export const mailListAudit = mongoose.model("mail-list-audit", schema);
