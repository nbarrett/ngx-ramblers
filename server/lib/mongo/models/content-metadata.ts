import mongoose = require("mongoose");
import uniqueValidator = require("mongoose-unique-validator");

const contentMetadataItem = mongoose.Schema({
  eventId: {type: String},
  dateSource: {type: String},
  date: {type: Number},
  image: {type: String, required: true},
  originalFileName: {type: String},
  text: {type: String},
  tags: [{type: Number}]
});

const imageTag = mongoose.Schema({
  key: {type: Number},
  sortIndex: {type: Number},
  subject: {type: String},
  excludeFromRecent: {type: Boolean},
}, {_id: false});


const contentMetadataSchema = mongoose.Schema({
  rootFolder: {type: String, required: true},
  name: {type: String, required: true},
  baseUrl: {type: String},
  aspectRatio: {type: String},
  contentMetaDataType: {type: String},
  files: [contentMetadataItem],
  imageTags: [imageTag]
}, {collection: "contentMetaData"});

contentMetadataSchema.plugin(uniqueValidator);

export const contentMetadata = mongoose.model("content-metadata", contentMetadataSchema);
