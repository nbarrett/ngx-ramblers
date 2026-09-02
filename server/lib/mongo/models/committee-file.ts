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
    rsvps: { type: [{ email: String, name: String, status: String, respondedAt: Number }] },
    organiserEmail: { type: String },
    organiserName: { type: String },
    createdBy: { type: String },
    createdByName: { type: String },
    minutesEmailedAt: { type: Number },
    startedAt: { type: Number },
    endedAt: { type: Number },
    committeePagePath: { type: String },
    minutesSummaryPending: { type: Boolean },
  }
}, { collection: "committeeFiles" });

committeeFileSchema.plugin(uniqueValidator);

export default mongoose.model("committee-file", committeeFileSchema);
