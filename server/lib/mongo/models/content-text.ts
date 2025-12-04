import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { ContentText } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";

const contextTextSchema = new mongoose.Schema({
  category: {type: String},
  name: {type: String, required: true},
  text: {type: String, required: true},
  styles: {type: Object}
}, {collection: "contentText"});

export const contentText: mongoose.Model<ContentText> = ensureModel<ContentText>("content-text", contextTextSchema);
