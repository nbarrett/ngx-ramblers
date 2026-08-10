import mongoose from "mongoose";
import { values } from "es-toolkit/compat";
import { VolunteerAssignment, VolunteerAssignmentCoverage, VolunteerAssignmentIdentityStatus, VolunteerAssignmentScope, VolunteerAssignmentStatus, VolunteerRoleType } from "../../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { ensureModel } from "../utils/model-utils";

const volunteerAssignmentSchema = new mongoose.Schema({
  groupCode: {type: String, required: true},
  scope: {type: String, enum: values(VolunteerAssignmentScope), default: VolunteerAssignmentScope.PARISH},
  parishCode: {type: String},
  rightsOfWayGroupCode: {type: String},
  sectorCode: {type: String},
  supporterId: {type: String},
  unresolvedName: {type: String},
  sourceReference: {type: String},
  identityStatus: {type: String, enum: values(VolunteerAssignmentIdentityStatus), required: true},
  roleType: {type: String, enum: values(VolunteerRoleType), required: true},
  coverage: {type: String, enum: values(VolunteerAssignmentCoverage), required: true},
  status: {type: String, enum: values(VolunteerAssignmentStatus), required: true},
  effectiveFrom: {type: Number, required: false, default: null},
  effectiveTo: {type: Number},
  notes: {type: String},
  createdAt: {type: Number, required: true},
  createdBy: {type: String, required: true},
  updatedAt: {type: Number, required: true},
  updatedBy: {type: String, required: true}
}, {collection: "volunteerAssignments"});

volunteerAssignmentSchema.index({groupCode: 1, parishCode: 1, status: 1, roleType: 1});
volunteerAssignmentSchema.index({groupCode: 1, supporterId: 1, status: 1});
volunteerAssignmentSchema.index({groupCode: 1, scope: 1, rightsOfWayGroupCode: 1, status: 1});
volunteerAssignmentSchema.index({sourceReference: 1}, {unique: true, sparse: true});

export const volunteerAssignment: mongoose.Model<VolunteerAssignment> = ensureModel<VolunteerAssignment>("volunteer-assignment", volunteerAssignmentSchema);
