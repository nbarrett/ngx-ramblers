import mongoose from "mongoose";
import { values } from "es-toolkit/compat";
import { ensureModel } from "../utils/model-utils";
import { OsDataHubApiKeyJobResult, OsDataHubApiKeyJobStatus } from "../../../../projects/ngx-ramblers/src/app/models/os-data-hub-api-key.model";

const osDataHubApiKeyResultSchema = new mongoose.Schema({
  jobId: {type: String, unique: true},
  projectName: {type: String},
  status: {type: String, enum: values(OsDataHubApiKeyJobStatus)},
  apiKey: {type: String},
  created: {type: Boolean},
  error: {type: String},
  createdAt: {type: Number},
  completedAt: {type: Number}
}, {collection: "osDataHubApiKeyResults"});

export const osDataHubApiKeyResult: mongoose.Model<OsDataHubApiKeyJobResult> = ensureModel("osDataHubApiKeyResult", osDataHubApiKeyResultSchema);
