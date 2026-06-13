import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { Sender } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:senders:update";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function updateSender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await brevoClient();
    const senderId = Number(req.params.senderId);
    const request: Sender = req.body;
    debugLog("updateSender: senderId:", senderId, "name:", request.name, "email:", request.email);
    await scheduleBrevo(() => client.senders.updateSender({senderId, name: request.name, email: request.email}));
    successfulResponse({req, res, response: {updated: true}, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
