import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const memberResourceSchema = new mongoose.Schema({
  data: {
    campaignSearchTerm: { type: String },
    campaignSearchField: { type: String },
    campaign: { type: Object },
    fileNameData: {
      originalFileName: { type: String },
      awsFileName: { type: String },
      title: { type: String },
    },
  },
  resourceType: { type: String },
  accessLevel: { type: String },
  createdDate: { type: Number },
  createdBy: { type: String },
  title: { type: String },
  resourceDate: { type: Number },
  description: { type: String },
  subject: { type: String }
}, { collection: "memberResources" });

memberResourceSchema.plugin(uniqueValidator);

export default mongoose.model("member-resource", memberResourceSchema);
