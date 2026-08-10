import mongoose from "mongoose";
import { VolunteerExportAudit } from "../../../../projects/ngx-ramblers/src/app/models/volunteer-import.model";
import { ensureModel } from "../utils/model-utils";

const volunteerExportAuditSchema = new mongoose.Schema({
  groupCode: {type: String, required: true},
  reportType: {type: String, required: true},
  fileName: {type: String, required: true},
  rowCount: {type: Number, required: true},
  createdAt: {type: Number, required: true},
  createdBy: {type: String, required: true}
}, {collection: "volunteerExportAudit"});

volunteerExportAuditSchema.index({groupCode: 1, createdAt: -1});

export const volunteerExportAudit: mongoose.Model<VolunteerExportAudit> = ensureModel<VolunteerExportAudit>("volunteer-export-audit", volunteerExportAuditSchema);
