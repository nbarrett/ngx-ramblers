import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const contentMetadataItem = new mongoose.Schema({
  eventId: {type: String},
  dateSource: {type: String},
  date: {type: Number},
  image: {type: String, required: true},
  originalFileName: {type: String},
  text: {type: String},
  tags: [{type: Number}]
});

const imageTag = new mongoose.Schema({
  key: {type: Number},
  sortIndex: {type: Number},
  subject: {type: String},
  excludeFromRecent: {type: Boolean},
}, {_id: false});


const contentMetadataSchema = new mongoose.Schema({
  rootFolder: {type: String, required: true},
  name: {type: String, required: true},
  baseUrl: {type: String},
  aspectRatio: {type: String},
  contentMetaDataType: {type: String},
  files: [contentMetadataItem],
  coverImage:  {type: String},
  imageTags: [imageTag]
}, {collection: "contentMetaData"});

contentMetadataSchema.plugin(uniqueValidator);

export const contentMetadata: mongoose.Model<mongoose.Document> = mongoose.model("content-metadata", contentMetadataSchema);
