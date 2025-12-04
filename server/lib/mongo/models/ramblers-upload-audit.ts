import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { RamblersUploadAudit } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";

export const ramblersUploadAudit: mongoose.Model<RamblersUploadAudit> = ensureModel<RamblersUploadAudit>("ramblers-upload-audit", new mongoose.Schema({
    auditTime: {type: Number},
    record: {type: Number},
    errorResponse: {type: Object},
    fileName: {type: String},
    message: {type: String},
    status: {type: String},
    type: {type: String},
  }, {collection: "ramblersUploadAudit"}));
