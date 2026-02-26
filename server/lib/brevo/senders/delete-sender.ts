import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import http from "http";

const messageType = "brevo:senders:delete";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function deleteSender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.SendersApi();
    apiInstance.setApiKey(SibApiV3Sdk.SendersApiApiKeys.apiKey, brevoConfig.apiKey);
    const senderId = Number(req.params.senderId);
    debugLog("deleteSender: senderId:", senderId);
    await apiInstance.deleteSender(senderId);
    await delay(500);
    const sendersResponse: { response: http.IncomingMessage; body: any } = await apiInstance.getSenders();
    const stillExists = (sendersResponse.body?.senders || []).some(sender => sender.id === senderId);
    if (stillExists) {
      throw new Error(`Brevo did not delete sender ${senderId}. The sender may be protected or still in use.`);
    }
    successfulResponse({req, res, response: {deleted: true, senderId}, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
