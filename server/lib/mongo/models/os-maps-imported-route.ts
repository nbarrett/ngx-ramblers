import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { FileNameData } from "../../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { fileNameData } from "./banner";

export interface OsMapsImportedRouteRecord {
  routeId: string;
  url: string;
  importedAt: number;
  gpxFile?: FileNameData | null;
  color?: string | null;
  weight?: number | null;
  opacity?: number | null;
}

const osMapsImportedRouteSchema = new mongoose.Schema({
  routeId: {type: String, unique: true},
  url: {type: String},
  importedAt: {type: Number},
  gpxFile: fileNameData,
  color: {type: String},
  weight: {type: Number},
  opacity: {type: Number}
}, {collection: "osMapsImportedRoutes"});

export const osMapsImportedRoute: mongoose.Model<OsMapsImportedRouteRecord> = ensureModel("osMapsImportedRoute", osMapsImportedRouteSchema);
