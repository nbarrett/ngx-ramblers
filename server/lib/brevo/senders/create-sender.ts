import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import http from "http";
import { CreateSenderResponse, Sender } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { CreateSender } from "@getbrevo/brevo/model/createSender";

const messageType = "brevo:senders:create";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function createSender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.SendersApi();
    apiInstance.setApiKey(SibApiV3Sdk.SendersApiApiKeys.apiKey, brevoConfig.apiKey);
    const request: Sender = req.body;

    const opts: CreateSender = new SibApiV3Sdk.CreateSender();
    opts.email = request.email;
    opts.name = request.name;
    debugLog("createSender: opts:", opts);
    const response: { response: http.IncomingMessage, body: any } = await apiInstance.createSender(opts);
    const senderResponse: CreateSenderResponse = response.body;
    successfulResponse({req, res, response: senderResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
