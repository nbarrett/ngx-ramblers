const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const committeeFileSchema = mongoose.Schema({
  createdDate: {type: Number},
  eventDate: {type: Number},
  postcode: {type: String},
  fileType: {type: String},
  fileNameData: {
    rootFolder: {type: String},
    originalFileName: {type: String},
    awsFileName: {type: String},
    title: {type: String},
  }
}, {collection: "committeeFiles"});

committeeFileSchema.plugin(uniqueValidator);

module.exports = mongoose.model("committee-file", committeeFileSchema);
