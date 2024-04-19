import mongoose = require("mongoose");
import uniqueValidator = require("mongoose-unique-validator");

const schema = mongoose.Schema({
  memberId: {type: String},
  listType: {type: String},
  timestamp: {type: Number},
  status: {type: String},
  audit: {type: Object},
}, {collection: "mailchimpListAudit"});

schema.plugin(uniqueValidator);

export const mailchimpListAudit = mongoose.model("mailchimp-list-audit", schema);
