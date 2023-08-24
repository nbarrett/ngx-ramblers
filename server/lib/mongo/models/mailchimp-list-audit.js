const mongoose = require("mongoose");

module.exports = mongoose.model("mailchimp-list",
  mongoose.Schema({
    memberId: {type: String},
    listType: {type: String},
    timestamp: {type: Number},
    status: {type: String},
    audit: {type: Object},
  }, {collection: "mailchimpListAudit"}));

