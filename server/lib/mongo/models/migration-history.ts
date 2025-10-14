import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema({
  time: { type: Number },
  status: { type: String },
  message: { type: String }
}, { _id: false });

const MigrationHistorySchema = new mongoose.Schema({
  createdDate: { type: Number },
  siteIdentifier: { type: String },
  siteName: { type: String },
  persistData: { type: Boolean },
  uploadTos3: { type: Boolean },
  completedDate: { type: Number },
  status: { type: String },
  summary: { type: String },
  auditLog: [AuditLogSchema]
}, { collection: "migrationHistory" });

export const migrationHistory = mongoose.model("migration-history", MigrationHistorySchema);

