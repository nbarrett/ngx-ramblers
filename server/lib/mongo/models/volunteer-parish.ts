import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";
import { values } from "es-toolkit/compat";
import { VolunteerParish, VolunteerParishEligibility, VolunteerParishType } from "../../../../projects/ngx-ramblers/src/app/models/volunteer-management.model";
import { ensureModel } from "../utils/model-utils";

const volunteerParishSchema = new mongoose.Schema({
  groupCode: {type: String, required: true},
  parishCode: {type: String, required: true},
  parishName: {type: String, required: true},
  membershipGroupCode: {type: String},
  rightsOfWayGroupCode: {type: String},
  localAuthorityCode: {type: String},
  localAuthorityName: {type: String},
  sectorCode: {type: String},
  parishType: {type: String, enum: values(VolunteerParishType)},
  eligibility: {type: String, enum: values(VolunteerParishEligibility), required: true},
  notes: {type: String},
  updatedAt: {type: Number},
  updatedBy: {type: String}
}, {collection: "volunteerParishes"});

volunteerParishSchema.index({groupCode: 1, parishCode: 1}, {unique: true});
volunteerParishSchema.plugin(uniqueValidator);

export const volunteerParish: mongoose.Model<VolunteerParish> = ensureModel<VolunteerParish>("volunteer-parish", volunteerParishSchema);
