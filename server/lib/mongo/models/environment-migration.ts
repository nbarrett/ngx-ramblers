import mongoose from "mongoose";
import { values } from "es-toolkit/compat";
import { ensureModel } from "../utils/model-utils";
import { dateTimeNow } from "../../shared/dates";
import {
  EnvironmentMigrationAudit,
  EnvironmentMigrationMode,
  EnvironmentMigrationPhase,
  EnvironmentMigrationStatus
} from "../../../../projects/ngx-ramblers/src/app/models/environment-migration.model";

const mongoSummarySchema = {
  cluster: { type: String, required: true },
  db: { type: String, required: true },
  username: { type: String, required: true },
  uriSummary: { type: String, required: true }
};

const environmentMigrationSchema = new mongoose.Schema({
  migrationId: { type: String, required: true, unique: true },
  environment: { type: String, required: true },
  mode: { type: String, required: true, enum: values(EnvironmentMigrationMode) },
  status: { type: String, required: true, enum: values(EnvironmentMigrationStatus) },
  phase: { type: String, required: true, enum: values(EnvironmentMigrationPhase) },
  dryRun: { type: Boolean, required: true },
  startTime: { type: Date, required: true, default: () => dateTimeNow().toJSDate() },
  endTime: { type: Date },
  backupPath: { type: String },
  backupName: { type: String },
  backupLocation: { type: String },
  sourceMongo: mongoSummarySchema,
  targetMongo: mongoSummarySchema,
  executionId: { type: String },
  executionStartedAt: { type: Date },
  heartbeatAt: { type: Date },
  verification: { type: mongoose.Schema.Types.Mixed },
  s3Backups: { type: mongoose.Schema.Types.Mixed },
  s3Restores: { type: mongoose.Schema.Types.Mixed },
  rollbackInfo: { type: mongoose.Schema.Types.Mixed },
  rotatedAt: { type: Date },
  error: { type: String },
  requestedBy: { type: String }
}, { collection: "environmentMigrations", timestamps: true });

environmentMigrationSchema.index({ environment: 1, startTime: -1 });
environmentMigrationSchema.index({ status: 1 });
environmentMigrationSchema.index({ heartbeatAt: 1 });

export const environmentMigration: mongoose.Model<EnvironmentMigrationAudit> = ensureModel<EnvironmentMigrationAudit>("environmentMigration", environmentMigrationSchema);
