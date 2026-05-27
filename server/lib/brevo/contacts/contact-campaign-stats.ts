import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { Request, Response } from "express";
import http from "http";
import { isString } from "es-toolkit/compat";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { BrevoContactCampaignStats } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:contact-campaign-stats";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactCampaignStats(req: Request, res: Response): Promise<void> {
  try {
    const identifier = String(req.params.identifier || "").trim();
    if (!identifier) {
      res.status(400).json({ error: "identifier is required" });
      return;
    }
    const startDate = isString(req.query.startDate) ? req.query.startDate : undefined;
    const endDate = isString(req.query.endDate) ? req.query.endDate : undefined;
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const response: { response: http.IncomingMessage, body: any } = await scheduleBrevo(() => apiInstance.getContactStats(identifier, startDate, endDate));
    const body: BrevoContactCampaignStats = response.body;
    successfulResponse({ req, res, response: body, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
