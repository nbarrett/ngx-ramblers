import { Brevo, BrevoClient } from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";

const messageType = "brevo:senders";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

async function fetchBrevoSendersBody(apiKey: string): Promise<Brevo.GetSendersResponse> {
  const client = new BrevoClient({apiKey});
  return scheduleBrevo(() => client.senders.getSenders());
}

export async function listBrevoSenders(apiKey: string): Promise<Brevo.GetSendersResponse.Senders.Item[]> {
  const body = await fetchBrevoSendersBody(apiKey);
  return body.senders ?? [];
}

export async function senders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const body = await fetchBrevoSendersBody(brevoConfig.apiKey);
    successfulResponse({req, res, response: body, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
