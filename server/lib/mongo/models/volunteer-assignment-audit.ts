import mongoose from "mongoose";
import { values } from "es-toolkit/compat";
import { VolunteerAssignmentAudit, VolunteerAssignmentAuditAction, VolunteerRoleType } from "../../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { ensureModel } from "../utils/model-utils";

const volunteerAssignmentAuditSchema = new mongoose.Schema({
  groupCode: {type: String, required: true},
  assignmentId: {type: String, required: true},
  parishCode: {type: String, required: true},
  roleType: {type: String, enum: values(VolunteerRoleType), required: true},
  action: {type: String, enum: values(VolunteerAssignmentAuditAction), required: true},
  fieldChanges: [{fieldName: String, from: String, to: String}],
  performedAt: {type: Number, required: true},
  performedBy: {type: String, required: true}
}, {collection: "volunteerAssignmentAudit"});

volunteerAssignmentAuditSchema.index({groupCode: 1, assignmentId: 1, performedAt: -1});
volunteerAssignmentAuditSchema.index({groupCode: 1, performedAt: -1});

export const volunteerAssignmentAudit: mongoose.Model<VolunteerAssignmentAudit> = ensureModel<VolunteerAssignmentAudit>("volunteer-assignment-audit", volunteerAssignmentAuditSchema);
