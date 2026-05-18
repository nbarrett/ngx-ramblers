import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";

export interface MemberEmailSendDocument {
  id?: string;
  memberId: string;
  email?: string;
  notificationConfigId?: string;
  subject?: string;
  jobId?: string;
  sentAt: number;
  sentBy?: string;
}

const memberEmailSendSchema = new mongoose.Schema({
  memberId: { type: String, required: true, index: true },
  email: { type: String },
  notificationConfigId: { type: String, index: true },
  subject: { type: String },
  jobId: { type: String },
  sentAt: { type: Number, required: true },
  sentBy: { type: String }
}, { collection: "memberEmailSends" });

memberEmailSendSchema.index({ memberId: 1, notificationConfigId: 1 });

export const memberEmailSend: mongoose.Model<MemberEmailSendDocument> = ensureModel<MemberEmailSendDocument>("member-email-send", memberEmailSendSchema);
