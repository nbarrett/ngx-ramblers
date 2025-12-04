import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { ConfigDocument } from "../../../../projects/ngx-ramblers/src/app/models/config.model";

const configSchema = new mongoose.Schema({
  key: {type: String, required: true, unique: true},
  value: {type: Object, required: false}
}, {collection: "config"});

configSchema.plugin(uniqueValidator);

export const config: mongoose.Model<ConfigDocument> = ensureModel<ConfigDocument>("config", configSchema);
