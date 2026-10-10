import { OsMapsImportContext } from "../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { Difficulty } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { FileNameData } from "../../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { RouteFollowWaypoint } from "../../../../projects/ngx-ramblers/src/app/models/route-follow.model";
import { fileNameData } from "./banner";

export interface ImportedRouteNumberCounter {
  _id: string;
  seq: number;
}

export interface OsMapsImportedRouteRecord extends OsMapsImportContext {
  routeId: string;
  number?: number | null;
  url: string;
  importedAt: number;
  gpxFile?: FileNameData | null;
  color?: string | null;
  weight?: number | null;
  opacity?: number | null;
  waypoints?: RouteFollowWaypoint[] | null;
  difficulty?: Difficulty | null;
}

const osMapsImportedRouteSchema = new mongoose.Schema({
  routeId: {type: String, unique: true},
  number: {type: Number, unique: true, sparse: true},
  url: {type: String},
  importedAt: {type: Number},
  ownerMemberId: {type: String},
  visibility: {type: String},
  gpxFile: fileNameData,
  color: {type: String},
  weight: {type: Number},
  opacity: {type: Number},
  waypoints: [{type: Object}],
  difficulty: {type: Object}
}, {collection: "osMapsImportedRoutes"});

export const osMapsImportedRoute: mongoose.Model<OsMapsImportedRouteRecord> = ensureModel("osMapsImportedRoute", osMapsImportedRouteSchema);
