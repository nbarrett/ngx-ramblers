import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { Sender } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:senders:update";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function updateSender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.SendersApi();
    apiInstance.setApiKey(SibApiV3Sdk.SendersApiApiKeys.apiKey, brevoConfig.apiKey);
    const senderId = Number(req.params.senderId);
    const request: Sender = req.body;
    const opts = new SibApiV3Sdk.UpdateSender();
    opts.name = request.name;
    opts.email = request.email;
    debugLog("updateSender: senderId:", senderId, "opts:", opts);
    await apiInstance.updateSender(senderId, opts);
    successfulResponse({req, res, response: {updated: true}, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
