import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { DeletedMember } from "../../../../projects/ngx-ramblers/src/app/models/member.model";

const deletedMemberSchema = new mongoose.Schema({
  deletedAt: {type: Number},
  deletedBy: {type: String},
  memberId: {type: String},
  membershipNumber: {type: String},
  firstName: {type: String},
  lastName: {type: String},
  displayName: {type: String},
  email: {type: String},
  mobileNumber: {type: String},
  postcode: {type: String},
  userName: {type: String},
  contactId: {type: String},
  salesforceId: {type: String},
  salesforceMemberRef: {type: String},
  brevoContactId: {type: mongoose.Schema.Types.Mixed},
  membershipExpiryDate: {type: Number},
  createdDate: {type: Number},
}, {collection: "deletedMembers"});

deletedMemberSchema.index({deletedAt: 1});

export const deletedMember: mongoose.Model<DeletedMember> = ensureModel<DeletedMember>("deleted-member", deletedMemberSchema);
