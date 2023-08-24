const mongoose = require("mongoose");

const PageContentColumn = mongoose.Schema({
  href: {type: String},
  title: {type: String},
  imageSource: {type: String},
  imageBorderRadius: {type: Number},
  icon: {type: String},
  columns: {type: Number},
  contentTextId: {type: String},
  accessLevel: {type: String},
  rows: {type: Object, required: false},
}, { _id : false });

const PageContentRow = mongoose.Schema({
  type: {type: String, required: true},
  maxColumns: {type: Number},
  showSwiper: {type: Boolean},
  columns: [PageContentColumn],
  marginTop: {type: Number},
  marginBottom: {type: Number},
}, { _id : false });

const pageContentSchema = mongoose.Schema({
  path: {type: String, required: true},
  rows: [PageContentRow]
}, {collection: "pageContent"});

module.exports = mongoose.model("page-content", pageContentSchema);
