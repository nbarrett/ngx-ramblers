import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { CreateContactRequest } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { handleError, successfulResponse } from "../common/messages";

const messageType = "brevo:contacts:update";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactUpdate(req: Request, res: Response): Promise<any> {
  try {
    const client = await brevoClient();
    const createContactRequest: CreateContactRequest = req.body;
    const identifier = createContactRequest.email;
    const response = await scheduleBrevo(() => client.contacts.updateContact({identifier, ext_id: createContactRequest.extId}).withRawResponse());
    debugLog("response", response);
    successfulResponse({req, res, response: response.data, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
