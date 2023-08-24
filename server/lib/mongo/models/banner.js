const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const bannerConfigSchema = mongoose.Schema({
  name: {type: String},
  bannerType: {type: String},
  banner: {type: Object},
  createdAt: {type: Number},
  createdBy: {type: String},
  updatedAt: {type: Number},
  updatedBy: {type: String}
}, {collection: "banners"});

bannerConfigSchema.plugin(uniqueValidator);

module.exports = mongoose.model("banner", bannerConfigSchema);
