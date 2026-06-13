import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
const messageType = "brevo:lists:list-delete";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function listDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await brevoClient();
    const listId: number = +req.query.listId;
    const response = await scheduleBrevo(() => client.contacts.deleteList({listId}));
    successfulResponse({req, res, response, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
