const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const ContentMetadataItem = mongoose.Schema({
  eventId: {type: String},
  dateSource: {type: String},
  date: {type: Number},
  image: {type: String, required: true},
  text: {type: String, required: true},
  tags: [{type: Number}]
});

const imageTag = {
  key: {type: Number},
  sortIndex: {type: Number},
  subject: {type: String},
  excludeFromRecent: {type: Boolean}
};

const ContentMetadataSchema = mongoose.Schema({
  baseUrl: {type: String, required: true},
  contentMetaDataType: {type: String, required: true},
  files: [ContentMetadataItem],
  imageTags: [imageTag]
}, {collection: "contentMetaData"});

ContentMetadataSchema.plugin(uniqueValidator);

module.exports = mongoose.model("content-metadata", ContentMetadataSchema);

