import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { ScheduledTaskRunRecord } from "../../../../projects/ngx-ramblers/src/app/models/scheduled-task.model";

const scheduledTaskRunSchema = new mongoose.Schema({
  taskId: {type: String, required: true, index: true},
  startedAt: {type: String, required: true, index: true},
  completedAt: {type: String, default: null},
  status: {type: String, required: true},
  message: {type: String, default: null}
}, {collection: "scheduledTaskRuns"});

export const scheduledTaskRun: mongoose.Model<ScheduledTaskRunRecord> = ensureModel<ScheduledTaskRunRecord>("scheduled-task-run", scheduledTaskRunSchema);
