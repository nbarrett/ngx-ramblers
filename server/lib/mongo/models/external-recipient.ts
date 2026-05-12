import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";

export interface ExternalRecipientDocument {
  id?: string;
  email: string;
  name?: string;
  createdBy: string;
  createdAt: number;
  lastUsedAt?: number;
  lastUsedBy?: string;
}

const externalRecipientSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name: { type: String },
  createdBy: { type: String, required: true },
  createdAt: { type: Number, required: true },
  lastUsedAt: { type: Number },
  lastUsedBy: { type: String }
}, { collection: "externalRecipients" });

export const externalRecipient: mongoose.Model<ExternalRecipientDocument> = ensureModel<ExternalRecipientDocument>("external-recipient", externalRecipientSchema);
