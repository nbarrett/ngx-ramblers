import mongoose = require("mongoose");
import uniqueValidator = require("mongoose-unique-validator");

const configSchema = mongoose.Schema({
  key: {type: String, required: true, unique: true},
  value: {type: Object, required: false}
}, {collection: "config"});

configSchema.plugin(uniqueValidator);

export const config = mongoose.model("config", configSchema);
