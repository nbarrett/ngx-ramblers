import mongoose from "mongoose";
import { values } from "es-toolkit/compat";
import { ensureModel } from "../utils/model-utils";
import { ExternalContactType } from "../../../../projects/ngx-ramblers/src/app/models/external-recipient.model";

export interface ExternalRecipientDocument {
  id?: string;
  email: string;
  name?: string;
  organisationName?: string;
  contactName?: string;
  roleTitle?: string;
  telephone?: string;
  postalAddress?: string;
  contactType?: ExternalContactType;
  parishCodes?: string[];
  localAuthorityCodes?: string[];
  sectorCodes?: string[];
  rightsOfWayGroupCodes?: string[];
  supporterId?: string | null;
  notes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt?: number;
  updatedBy?: string;
  lastUsedAt?: number;
  lastUsedBy?: string;
}

const externalRecipientSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name: { type: String },
  organisationName: { type: String },
  contactName: { type: String },
  roleTitle: { type: String },
  telephone: { type: String },
  postalAddress: { type: String },
  contactType: { type: String, enum: values(ExternalContactType) },
  parishCodes: [{ type: String }],
  localAuthorityCodes: [{ type: String }],
  sectorCodes: [{ type: String }],
  rightsOfWayGroupCodes: [{ type: String }],
  supporterId: { type: String },
  notes: { type: String },
  createdBy: { type: String, required: true },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number },
  updatedBy: { type: String },
  lastUsedAt: { type: Number },
  lastUsedBy: { type: String }
}, { collection: "externalRecipients" });

externalRecipientSchema.index({ contactType: 1 });
externalRecipientSchema.index({ parishCodes: 1 });
externalRecipientSchema.index({ supporterId: 1 });

export const externalRecipient: mongoose.Model<ExternalRecipientDocument> = ensureModel<ExternalRecipientDocument>("external-recipient", externalRecipientSchema);
