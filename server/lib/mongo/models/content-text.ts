import mongoose from "mongoose";

const contextTextSchema = new mongoose.Schema({
  category: {type: String},
  name: {type: String, required: true},
  text: {type: String, required: true},
  styles: {type: Object}
}, {collection: "contentText"});

export const contentText: mongoose.Model<mongoose.Document> = mongoose.model("content-text", contextTextSchema);
