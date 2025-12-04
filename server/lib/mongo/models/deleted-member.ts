import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { DeletedMember } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const deletedMemberSchema = new mongoose.Schema({
  deletedAt: {type: Number},
  deletedBy: {type: String},
  memberId: {type: String},
  membershipNumber: {type: String},
}, {collection: "deletedMembers"});

export const deletedMember: mongoose.Model<DeletedMember> = ensureModel<DeletedMember>("deleted-member", deletedMemberSchema);
