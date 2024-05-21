import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import http from "http";
import { ListsResponse } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:senders";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

export async function senders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.SendersApi();
    apiInstance.setApiKey(SibApiV3Sdk.SendersApiApiKeys.apiKey, brevoConfig.apiKey);
    const response: { response: http.IncomingMessage, body: any } = await apiInstance.getSenders();
    const listsResponse: ListsResponse = response.body;
    successfulResponse({req, res, response: listsResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
