import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { Request, Response } from "express";
import http from "http";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { BrevoContactDetails } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:contact-info";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactInfo(req: Request, res: Response): Promise<void> {
  try {
    const identifier = String(req.params.identifier || "").trim();
    if (!identifier) {
      res.status(400).json({ error: "identifier is required" });
      return;
    }
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const response: { response: http.IncomingMessage, body: any } = await apiInstance.getContactInfo(identifier);
    const body: BrevoContactDetails = response.body;
    successfulResponse({ req, res, response: body, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
