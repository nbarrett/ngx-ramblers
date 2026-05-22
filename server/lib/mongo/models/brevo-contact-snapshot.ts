import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { BrevoContactSnapshot } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const brevoContactSnapshotSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  memberId: { type: String, index: true },
  brevoContactId: { type: Number },
  contactDetails: { type: mongoose.Schema.Types.Mixed },
  campaignStats: { type: mongoose.Schema.Types.Mixed },
  events: { type: [mongoose.Schema.Types.Mixed], default: [] },
  snapshotAt: { type: Number, required: true },
  snapshotBy: { type: String }
}, { collection: "brevoContactSnapshots" });

export const brevoContactSnapshot: mongoose.Model<BrevoContactSnapshot> = ensureModel<BrevoContactSnapshot>("brevo-contact-snapshot", brevoContactSnapshotSchema);
