import mongoose = require("mongoose");
import uniqueValidator = require("mongoose-unique-validator");

const fileNameData = mongoose.Schema({
    rootFolder: {type: String},
    originalFileName: {type: String},
    awsFileName: {type: String},
    title: {type: String},
}, {_id: false});


const bannerConfigSchema = mongoose.Schema({
  name: {type: String},
  bannerType: {type: String},
  banner: {type: Object},
  createdAt: {type: Number},
  createdBy: {type: String},
  updatedAt: {type: Number},
  updatedBy: {type: String},
  fileNameData
}, {collection: "banners"});

bannerConfigSchema.plugin(uniqueValidator);

export const banner = mongoose.model("banner", bannerConfigSchema);



