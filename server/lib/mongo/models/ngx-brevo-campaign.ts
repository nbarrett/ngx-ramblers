import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { NgxBrevoCampaignRecord } from "../../../../projects/ngx-ramblers/src/app/models/brevo-campaign-queue.model";

const ngxBrevoCampaignSchema = new mongoose.Schema({
  campaignId: {type: Number, required: true, unique: true, index: true},
  name: {type: String, default: ""},
  createdAt: {type: Number, required: true}
}, {collection: "ngxBrevoCampaigns"});

export const ngxBrevoCampaign: mongoose.Model<NgxBrevoCampaignRecord> = ensureModel<NgxBrevoCampaignRecord>("ngx-brevo-campaign", ngxBrevoCampaignSchema);
