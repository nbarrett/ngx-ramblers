import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { ContactsAddOrRemoveRequest } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:contacts-remove-from-list";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactsRemoveFromList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await brevoClient();
    const requests: ContactsAddOrRemoveRequest[] = req.body;
    debugLog("received", requests.length, "requests:", requests);
    const contactRemoveFromListResponses = await Promise.all(requests.map(async (request: ContactsAddOrRemoveRequest) => {
      const listId: number = request.listId;
      return scheduleBrevo(() => client.contacts.removeContactFromList({listId, body: {ids: request.ids}}));
    }));
    debugLog("contactRemoveFromListResponses:", contactRemoveFromListResponses);
    successfulResponse({req, res, response: contactRemoveFromListResponses, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
