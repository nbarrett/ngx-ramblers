import mongoose from "mongoose";
import { VolunteerImportAudit } from "../../../../projects/ngx-ramblers/src/app/models/volunteer-import.model";
import { ensureModel } from "../utils/model-utils";

const volunteerImportAuditSchema = new mongoose.Schema({
  groupCode: {type: String, required: true},
  fileNames: [String],
  summary: {type: mongoose.Schema.Types.Mixed, required: true},
  reviewQueue: {type: mongoose.Schema.Types.Mixed},
  parishesWritten: {type: Number, required: true},
  assignmentsWritten: {type: Number, required: true},
  contactsWritten: {type: Number, required: true},
  errors: [String],
  createdAt: {type: Number, required: true},
  createdBy: {type: String, required: true}
}, {collection: "volunteerImportAudit"});

volunteerImportAuditSchema.index({groupCode: 1, createdAt: -1});

export const volunteerImportAudit: mongoose.Model<VolunteerImportAudit> = ensureModel<VolunteerImportAudit>("volunteer-import-audit", volunteerImportAuditSchema);
