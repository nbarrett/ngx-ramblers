import mongoose from "mongoose";

export const ramblersUploadAudit: mongoose.Model<mongoose.Document> = mongoose.model("ramblers-upload-audit",
  new mongoose.Schema({
    auditTime: {type: Number},
    record: {type: Number},
    errorResponse: {type: Object},
    fileName: {type: String},
    message: {type: String},
    status: {type: String},
    type: {type: String},
  }, {collection: "ramblersUploadAudit"}));
