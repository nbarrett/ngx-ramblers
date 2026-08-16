import mongoose from "mongoose";
import { values } from "es-toolkit/compat";
import { ensureModel } from "../utils/model-utils";
import { OsMapsExportJobResult, OsMapsExportJobStatus } from "../../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { fileNameData } from "./banner";

const osMapsExportResultSchema = new mongoose.Schema({
  jobId: {type: String, unique: true},
  status: {type: String, enum: values(OsMapsExportJobStatus)},
  walkId: {type: String},
  routeUrls: [{type: String}],
  gpxFiles: [fileNameData],
  error: {type: String},
  createdAt: {type: Number},
  completedAt: {type: Number}
}, {collection: "osMapsExportResults"});

export const osMapsExportResult: mongoose.Model<OsMapsExportJobResult> = ensureModel("osMapsExportResult", osMapsExportResultSchema);
