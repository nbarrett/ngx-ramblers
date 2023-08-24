const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const memberResourceSchema = mongoose.Schema({
  data: {
    campaignSearchTerm: {type: String},
    campaignSearchField: {type: String},
    campaign:  {type: Object},
    fileNameData: {
      originalFileName: {type: String},
      awsFileName: {type: String},
      title: {type: String},
    },
  },
  resourceType: {type: String},
  accessLevel: {type: String},
  createdDate: {type: Number},
  createdBy: {type: String},
  title: {type: String},
  resourceDate: {type: Number},
  description: {type: String},
  subject: {type: String}
}, {collection: "memberResources"});

memberResourceSchema.plugin(uniqueValidator);

module.exports = mongoose.model("member-resource", memberResourceSchema);
