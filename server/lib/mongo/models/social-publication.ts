import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";

const SocialPublicationSchema = new mongoose.Schema({
  albumName: {type: String},
  eventId: {type: String, index: true},
  eventTitle: {type: String},
  captionFingerprint: {type: String},
  network: {type: String, required: true},
  postId: {type: String},
  permalink: {type: String},
  imageCount: {type: Number},
  imageNames: [{type: String}],
  caption: {type: String},
  publishedAt: {type: Number}
}, {collection: "socialPublication"});

export const socialPublication = ensureModel("social-publication", SocialPublicationSchema);
