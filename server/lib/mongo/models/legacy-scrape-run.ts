import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";

const AuditLogSchema = new mongoose.Schema({
  time: { type: Number },
  status: { type: String },
  message: { type: String }
}, { _id: false });

const LegacyScrapeRunSchema = new mongoose.Schema({
  legacyDomain: { type: String, required: true },
  startedDate: { type: Number },
  completedDate: { type: Number },
  status: { type: String, default: "running" },
  urlsDiscovered: { type: Number, default: 0 },
  urlsMapped: { type: Number, default: 0 },
  urlsUnmapped: { type: Number, default: 0 },
  auditLog: [AuditLogSchema]
}, { collection: "legacyScrapeRuns" });

export const legacyScrapeRun = ensureModel("legacy-scrape-run", LegacyScrapeRunSchema);
