import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import uniqueValidator from "mongoose-unique-validator";
import { ParishAllocation } from "../../../../projects/ngx-ramblers/src/app/models/parish-map.model";

const parishAllocationSchema = new mongoose.Schema({
  groupCode: {type: String, required: true},
  parishCode: {type: String, required: true},
  parishName: {type: String},
  status: {type: String, required: true},
  assignee: {type: String},
  assigneeMemberId: {type: String},
  notes: {type: String},
  updatedAt: {type: Number},
  updatedBy: {type: String}
}, {collection: "parishAllocations"});

parishAllocationSchema.index({groupCode: 1, parishCode: 1}, {unique: true});
parishAllocationSchema.plugin(uniqueValidator);

export const parishAllocation: mongoose.Model<ParishAllocation> = ensureModel<ParishAllocation>("parishAllocation", parishAllocationSchema);
