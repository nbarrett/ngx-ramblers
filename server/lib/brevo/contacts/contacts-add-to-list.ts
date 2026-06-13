import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { ContactsAddOrRemoveRequest } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:contacts-add-to-list";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactsAddToList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await brevoClient();
    const request: ContactsAddOrRemoveRequest = req.body;
    const listId: number = request.listId;
    const response = await scheduleBrevo(() => client.contacts.addContactToList({listId, body: {ids: request.ids}}));
    successfulResponse({req, res, response, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
