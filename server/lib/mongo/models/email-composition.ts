import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { EmailCompositionDocument, EmailCompositionKind, EmailCompositionStatus } from "../../../../projects/ngx-ramblers/src/app/models/email-composer.model";

const emailCompositionSchema = new mongoose.Schema({
  ownerMemberId: { type: String, required: true, index: true },
  status: { type: String, required: true, enum: [EmailCompositionStatus.Draft, EmailCompositionStatus.Sent], default: EmailCompositionStatus.Draft, index: true },
  kind: { type: String, required: true, enum: [EmailCompositionKind.STANDARD, EmailCompositionKind.NEWSLETTER, EmailCompositionKind.RELEASE_NOTE_UPDATE], default: EmailCompositionKind.STANDARD, index: true },
  shared: { type: Boolean, required: true, default: false, index: true },
  title: { type: String, required: true },
  state: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
  updatedBy: { type: String },
  sentAt: { type: Number },
  sentRecipientCount: { type: Number }
}, { collection: "emailCompositions" });

emailCompositionSchema.index({ ownerMemberId: 1, status: 1, updatedAt: -1 });
emailCompositionSchema.index({ shared: 1, status: 1, updatedAt: -1 });
emailCompositionSchema.index({ status: 1, sentAt: -1 });
emailCompositionSchema.index({ kind: 1, status: 1, sentAt: -1 });

export const emailComposition: mongoose.Model<EmailCompositionDocument> = ensureModel<EmailCompositionDocument>("email-composition", emailCompositionSchema);
