import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { Request, Response } from "express";
import http from "http";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { BrevoCampaignListResponse, BrevoCampaignSummary } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:query-campaigns";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function queryCampaigns(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Number.parseInt(String(req.query.limit ?? "100"), 10) || 100, 100);
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.EmailCampaignsApi();
    apiInstance.setApiKey(SibApiV3Sdk.EmailCampaignsApiApiKeys.apiKey, brevoConfig.apiKey);
    const response: { response: http.IncomingMessage, body: any } = await scheduleBrevo(() => apiInstance.getEmailCampaigns(
      undefined, undefined, undefined, undefined, undefined, limit, 0, "desc", true
    ));
    const campaigns: BrevoCampaignSummary[] = (response.body?.campaigns || []).map((campaign: any) => ({
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
