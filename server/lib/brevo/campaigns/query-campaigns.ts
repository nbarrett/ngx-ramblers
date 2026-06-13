import debug from "debug";
import { Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { BrevoCampaignListResponse, BrevoCampaignSummary } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:query-campaigns";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function queryCampaigns(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Number.parseInt(String(req.query.limit ?? "100"), 10) || 100, 100);
    const client = await brevoClient();
    const response = await scheduleBrevo(() => client.emailCampaigns.getEmailCampaigns({
      limit, offset: 0, sort: "desc", excludeHtmlContent: true
    }));
    const campaigns: BrevoCampaignSummary[] = (response?.campaigns || []).map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      sender: campaign.sender ? { name: campaign.sender.name, email: campaign.sender.email } : undefined
    }));
    const body: BrevoCampaignListResponse = { campaigns };
    successfulResponse({ req, res, response: body, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
