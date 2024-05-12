import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const configSchema = new mongoose.Schema({
  key: {type: String, required: true, unique: true},
  value: {type: Object, required: false}
}, {collection: "config"});

configSchema.plugin(uniqueValidator);

export const config: mongoose.Model<mongoose.Document> = mongoose.model("config", configSchema);
