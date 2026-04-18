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
debugLog.enabled = false;

export interface BrevoSenderSummary {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

async function fetchBrevoSendersBody(apiKey: string): Promise<any> {
  const apiInstance = new SibApiV3Sdk.SendersApi();
  apiInstance.setApiKey(SibApiV3Sdk.SendersApiApiKeys.apiKey, apiKey);
  const response: { response: http.IncomingMessage, body: any } = await apiInstance.getSenders();
  return response.body;
}

export async function listBrevoSenders(apiKey: string): Promise<BrevoSenderSummary[]> {
  const body = await fetchBrevoSendersBody(apiKey);
  return (body?.senders || []) as BrevoSenderSummary[];
}

export async function senders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const body = await fetchBrevoSendersBody(brevoConfig.apiKey);
    const listsResponse: ListsResponse = body;
    successfulResponse({req, res, response: listsResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
