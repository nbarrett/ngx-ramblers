import mongoose from "mongoose";

const deletedMemberSchema = new mongoose.Schema({
  deletedAt: {type: Number},
  deletedBy: {type: String},
  memberId: {type: String},
  membershipNumber: {type: String},
}, {collection: "deletedMembers"});

export const deletedMember: mongoose.Model<mongoose.Document> = mongoose.model("deleted-member", deletedMemberSchema);
