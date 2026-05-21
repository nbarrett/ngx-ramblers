import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { Request, Response } from "express";
import http from "http";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { BrevoTransactionalEmailContent } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:transactional-email-content";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function transactionalEmailContent(req: Request, res: Response): Promise<void> {
  try {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) {
      res.status(400).json({ error: "uuid is required" });
      return;
    }
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
    const response: { response: http.IncomingMessage, body: any } = await apiInstance.getTransacEmailContent(uuid);
    const body: BrevoTransactionalEmailContent = response.body;
    successfulResponse({ req, res, response: body, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
