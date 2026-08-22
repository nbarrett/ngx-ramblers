import mongoose from "mongoose";
import uniqueValidator from "mongoose-unique-validator";

const committeeFileSchema = new mongoose.Schema({
  createdDate: { type: Number },
  eventDate: { type: Number },
  postcode: { type: String },
  fileType: { type: String },
  fileNameData: {
    rootFolder: { type: String },
    originalFileName: { type: String },
    awsFileName: { type: String },
    title: { type: String },
  },
  document: {
    title: { type: String },
    markdown: { type: String },
    templateId: { type: String },
  },
  meeting: {
    format: { type: String },
    room: { type: String, index: true },
    location: { type: String },
    title: { type: String },
    durationMinutes: { type: Number },
    invited: { type: Boolean },
    invitedMemberIds: { type: [String] },
    invitedRecipients: { type: [{ email: String, name: String }] },
    invitedListId: { type: Number },
    createdBy: { type: String },
    createdByName: { type: String },
  }
}, { collection: "committeeFiles" });

committeeFileSchema.plugin(uniqueValidator);

export default mongoose.model("committee-file", committeeFileSchema);
