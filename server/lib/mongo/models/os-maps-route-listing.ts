import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { OsMapsRouteListing } from "../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";

const osMapsListedRouteSchema = new mongoose.Schema({
  id: {type: String},
  title: {type: String},
  url: {type: String},
  createdAt: {type: String},
  createdAtValue: {type: Number},
  distanceMetres: {type: Number},
  source: {type: String},
  importedAt: {type: Number}
}, {_id: false});

const osMapsRouteListingSchema = new mongoose.Schema({
  key: {type: String, unique: true},
  listedAt: {type: Number},
  routes: [osMapsListedRouteSchema]
}, {collection: "osMapsRouteListings"});

export const osMapsRouteListing: mongoose.Model<OsMapsRouteListing & {key: string}> = ensureModel("osMapsRouteListing", osMapsRouteListingSchema);
