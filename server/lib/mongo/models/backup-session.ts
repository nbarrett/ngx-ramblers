import mongoose from "mongoose";
import { values } from "es-toolkit/compat";
import { ensureModel } from "../utils/model-utils";
import {
  BackupSessionStatus,
  BackupSessionTrigger,
  BackupSessionType
} from "../../../../projects/ngx-ramblers/src/app/models/backup-session.model";

export interface BackupSession {
  _id?: string;
  sessionId: string;
  type: BackupSessionType;
  environment: string;
  database: string;
  collections?: string[];
  status: BackupSessionStatus;
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
    triggeredBy: BackupSessionTrigger;
  };
}

const backupSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: values(BackupSessionType) },
  environment: { type: String, required: true },
  database: { type: String, required: true },
  collections: [{ type: String }],
  status: {
    type: String,
    required: true,
    enum: values(BackupSessionStatus),
    default: BackupSessionStatus.PENDING
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
    triggeredBy: { type: String, enum: values(BackupSessionTrigger), default: BackupSessionTrigger.WEB }
  }
}, { collection: "backupSessions", timestamps: true });

backupSessionSchema.index({ environment: 1 });
backupSessionSchema.index({ startTime: -1 });

export const backupSession: mongoose.Model<BackupSession> = ensureModel<BackupSession>("backupSession", backupSessionSchema);
