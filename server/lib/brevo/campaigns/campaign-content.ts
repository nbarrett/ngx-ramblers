import debug from "debug";
import { Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { BrevoCampaignContent } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:campaign-content";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function campaignContent(req: Request, res: Response): Promise<void> {
  try {
    const campaignId = Number.parseInt(String(req.params.campaignId), 10);
    const client = await brevoClient();
    const campaign = await scheduleBrevo(() => client.emailCampaigns.getEmailCampaign({campaignId}));
    const body: BrevoCampaignContent = {
      id: campaign.id ?? campaignId,
      subject: campaign.subject,
      htmlContent: campaign.htmlContent || "",
      sender: campaign.sender ? { name: campaign.sender.name, email: campaign.sender.email } : undefined,
      sentDate: campaign.sentDate
    };
    successfulResponse({ req, res, response: body, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
