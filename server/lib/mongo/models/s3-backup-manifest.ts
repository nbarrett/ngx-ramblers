import mongoose from "mongoose";
import { values } from "es-toolkit/compat";
import { ensureModel } from "../utils/model-utils";
import {
  BackupSessionStatus,
  S3BackupAction,
  S3BackupManifest,
  S3BackupManifestEntry
} from "../../../../projects/ngx-ramblers/src/app/models/backup-session.model";

const s3BackupManifestEntrySchema = new mongoose.Schema({
  key: { type: String, required: true },
  eTag: { type: String, required: true },
  size: { type: Number, required: true },
  lastModified: { type: String, required: true },
  action: { type: String, required: true, enum: values(S3BackupAction) }
}, { _id: false });

const s3BackupManifestSchema = new mongoose.Schema({
  timestamp: { type: String, required: true },
  site: { type: String, required: true },
  sourceBucket: { type: String, required: true },
  backupBucket: { type: String, required: true },
  backupPrefix: { type: String, required: true },
  mongoTimestamp: { type: String },
  entries: [s3BackupManifestEntrySchema],
  totalObjects: { type: Number, required: true, default: 0 },
  copiedObjects: { type: Number, required: true, default: 0 },
  skippedObjects: { type: Number, required: true, default: 0 },
  totalSizeBytes: { type: Number, required: true, default: 0 },
  copiedSizeBytes: { type: Number, required: true, default: 0 },
  durationMs: { type: Number, required: true, default: 0 },
  status: {
    type: String,
    required: true,
    enum: values(BackupSessionStatus),
    default: BackupSessionStatus.PENDING
  },
  error: { type: String }
}, { collection: "s3BackupManifests", timestamps: true });

s3BackupManifestSchema.index({ site: 1, timestamp: -1 });
s3BackupManifestSchema.index({ timestamp: -1 });

export { S3BackupManifest, S3BackupManifestEntry };

export const s3BackupManifest: mongoose.Model<S3BackupManifest> = ensureModel<S3BackupManifest>("s3BackupManifest", s3BackupManifestSchema);
