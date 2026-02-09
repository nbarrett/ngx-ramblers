import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";

const messageType = "brevo:senders:delete";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function deleteSender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.SendersApi();
    apiInstance.setApiKey(SibApiV3Sdk.SendersApiApiKeys.apiKey, brevoConfig.apiKey);
    const senderId = Number(req.params.senderId);
    debugLog("deleteSender: senderId:", senderId);
    await apiInstance.deleteSender(senderId);
    successfulResponse({req, res, response: {deleted: true}, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
