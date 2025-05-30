import mongoose from "mongoose";

const PageContentColumn = new mongoose.Schema({
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

const PageContentRow = new mongoose.Schema({
  type: {type: String, required: true},
  maxColumns: {type: Number},
  showSwiper: {type: Boolean},
  columns: [PageContentColumn],
  marginTop: {type: Number},
  marginBottom: {type: Number},
  album: {type: Object},
  carousel: {type: Object},
  events: {type: Object},
  albumIndex: {type: Object},
}, { _id : false });

const pageContentSchema = new mongoose.Schema({
  path: {type: String, required: true},
  rows: [PageContentRow]
}, {collection: "pageContent"});

export const pageContent: mongoose.Model<mongoose.Document> = mongoose.model("page-content", pageContentSchema);
