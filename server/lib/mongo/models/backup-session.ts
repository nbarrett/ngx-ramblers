import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";

export interface BackupSession {
  _id?: string;
  sessionId: string;
  type: "backup" | "restore";
  environment: string;
  database: string;
  collections?: string[];
  status: "pending" | "in_progress" | "completed" | "failed";
  startTime: Date;
  endTime?: Date;
  options: {
    scaleDown?: boolean;
    upload?: boolean;
    s3Bucket?: string;
    s3Region?: string;
    s3Prefix?: string;
    drop?: boolean;
    dryRun?: boolean;
    from?: string;
  };
  backupPath?: string;
  s3Location?: string;
  logs: string[];
  error?: string;
  metadata?: {
    user?: string;
    triggeredBy: "cli" | "web";
  };
}

const backupSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: ["backup", "restore"] },
  environment: { type: String, required: true },
  database: { type: String, required: true },
  collections: [{ type: String }],
  status: {
    type: String,
    required: true,
    enum: ["pending", "in_progress", "completed", "failed"],
    default: "pending"
  },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date },
  options: {
    scaleDown: { type: Boolean },
    upload: { type: Boolean },
    s3Bucket: { type: String },
    s3Region: { type: String },
    s3Prefix: { type: String },
    drop: { type: Boolean },
    dryRun: { type: Boolean },
    from: { type: String }
  },
  backupPath: { type: String },
  s3Location: { type: String },
  logs: [{ type: String }],
  error: { type: String },
  metadata: {
    user: { type: String },
    triggeredBy: { type: String, enum: ["cli", "web"], default: "web" }
  }
}, { collection: "backupSessions", timestamps: true });

backupSessionSchema.index({ environment: 1 });
backupSessionSchema.index({ startTime: -1 });

export const backupSession: mongoose.Model<BackupSession> = ensureModel<BackupSession>("backupSession", backupSessionSchema);
