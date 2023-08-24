const mongoose = require("mongoose");

const contextTextSchema = mongoose.Schema({
  name: {type: String, required: true},
  text: {type: String, required: true},
  category: {type: String}
}, {collection: "contentText"});

module.exports = mongoose.model("content-text", contextTextSchema);
