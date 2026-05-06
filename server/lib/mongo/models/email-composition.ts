import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";

export type EmailCompositionStatus = "draft" | "sent";

export interface EmailCompositionDocument {
  id?: string;
  ownerMemberId: string;
  status: EmailCompositionStatus;
  shared: boolean;
  title: string;
  state: any;
  createdAt: number;
  updatedAt: number;
  updatedBy: string;
  sentAt?: number;
  sentRecipientCount?: number;
}

const emailCompositionSchema = new mongoose.Schema({
  ownerMemberId: { type: String, required: true, index: true },
  status: { type: String, required: true, enum: ["draft", "sent"], default: "draft", index: true },
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

export const emailComposition: mongoose.Model<EmailCompositionDocument> = ensureModel<EmailCompositionDocument>("email-composition", emailCompositionSchema);
