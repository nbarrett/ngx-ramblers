import { BrevoClient } from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";

const messageType = "brevo:senders:delete";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function deleteBrevoSenderById(apiKey: string, senderId: number): Promise<void> {
  const client = new BrevoClient({apiKey});
  await scheduleBrevo(() => client.senders.deleteSender({senderId}));
  await delay(500);
  const sendersResponse = await scheduleBrevo(() => client.senders.getSenders());
  const stillExists = (sendersResponse.senders ?? []).some(sender => sender.id === senderId);
  if (stillExists) {
    throw new Error(`Brevo did not delete sender ${senderId}. The sender may be protected or still in use.`);
  }
}

export async function deleteSender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const senderId = Number(req.params.senderId);
    debugLog("deleteSender: senderId:", senderId);
    await deleteBrevoSenderById(brevoConfig.apiKey, senderId);
    successfulResponse({req, res, response: {deleted: true, senderId}, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
