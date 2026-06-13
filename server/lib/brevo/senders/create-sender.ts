import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { Sender } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { Brevo, BrevoClient } from "@getbrevo/brevo";

const messageType = "brevo:senders:create";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function registerBrevoSender(apiKey: string, name: string, email: string): Promise<Brevo.CreateSenderResponse> {
  const client = new BrevoClient({apiKey});
  debugLog("registerBrevoSender: opts:", {email, name});
  return scheduleBrevo(() => client.senders.createSender({email, name}));
}

export async function createSender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const request: Sender = req.body;
    const senderResponse = await registerBrevoSender(brevoConfig.apiKey, request.name, request.email);
    successfulResponse({req, res, response: senderResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
