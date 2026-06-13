import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { ListUpdateRequest } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:lists:list-update";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function listUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await brevoClient();
    const listUpdateRequest: ListUpdateRequest = req.body;
    const updateRequest = listUpdateRequest.name
      ? {listId: listUpdateRequest.listId, name: listUpdateRequest.name}
      : {listId: listUpdateRequest.listId, folderId: listUpdateRequest.folderId};
    debugLog("updateList request received:", updateRequest, "with listId:", listUpdateRequest.listId);
    const response = await scheduleBrevo(() => client.contacts.updateList(updateRequest));
    successfulResponse({req, res, response, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
