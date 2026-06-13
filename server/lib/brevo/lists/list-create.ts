import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { ListCreateRequest } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:lists:list-create";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function listCreate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await brevoClient();
    const listCreateRequest: ListCreateRequest = req.body;
    debugLog("createList request received:", listCreateRequest);
    const response = await scheduleBrevo(() => client.contacts.createList({name: listCreateRequest.name, folderId: listCreateRequest.folderId}));
    successfulResponse({req, res, response, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
