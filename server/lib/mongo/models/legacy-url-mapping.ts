import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";

const LegacyUrlMappingSchema = new mongoose.Schema({
  legacyDomain: { type: String, required: true },
  legacyPath: { type: String, required: true },
  legacyFragment: { type: String },
  legacyFullUrl: { type: String, required: true },
  title: { type: String },
  httpStatus: { type: Number },
  contentType: { type: String },
  lastModified: { type: String },
  targetPath: { type: String },
  confidence: { type: String, default: "unmapped" },
  matchMethod: { type: String },
  status: { type: String, default: "pending" },
  redirectType: { type: Number, default: 301 },
  hitCount: { type: Number, default: 0 },
  lastHitDate: { type: Number },
  createdDate: { type: Number },
  updatedDate: { type: Number },
  updatedBy: { type: String },
  scrapeBatchId: { type: String }
}, { collection: "legacyUrlMappings" });

LegacyUrlMappingSchema.index({ legacyDomain: 1, legacyPath: 1, legacyFragment: 1 }, { unique: true });
LegacyUrlMappingSchema.index({ status: 1 });
LegacyUrlMappingSchema.index({ confidence: 1 });

export const legacyUrlMapping = ensureModel("legacy-url-mapping", LegacyUrlMappingSchema);
