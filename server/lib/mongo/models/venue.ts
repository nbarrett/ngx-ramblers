import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { StoredVenue } from "../../../../projects/ngx-ramblers/src/app/models/event-venue.model";

const venueSchema = new mongoose.Schema({
  name: {type: String, required: true},
  address1: {type: String},
  address2: {type: String},
  postcode: {type: String},
  type: {type: String},
  url: {type: String},
  lat: {type: Number},
  lon: {type: Number},
  usageCount: {type: Number, default: 0},
  lastUsed: {type: Number},
  createdAt: {type: Number},
  createdBy: {type: String},
  updatedAt: {type: Number},
  updatedBy: {type: String}
}, {collection: "venues"});

venueSchema.index({name: 1, postcode: 1}, {unique: true});
venueSchema.plugin(uniqueValidator);

export const venue: mongoose.Model<StoredVenue> = ensureModel<StoredVenue>("venue", venueSchema);
