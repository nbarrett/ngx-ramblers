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
  }
}, { collection: "committeeFiles" });

committeeFileSchema.plugin(uniqueValidator);

export default mongoose.model("committee-file", committeeFileSchema);
