import debug from "debug";
import { Request, Response } from "express";
import { handleError, mapStatusMappedResponseSingleInput, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import {
  ContactsDeleteRequest,
  NumberOrString,
  StatusMappedResponseSingleInput
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { isString } from "es-toolkit/compat";
import { scheduleBrevo } from "../common/rate-limiting";
import { snapshotBrevoContact } from "./contact-snapshot";
import { pluraliseWithCount } from "../../shared/string-utils";

interface AuthenticatedDeleteRequest extends Request {
  user?: { memberId?: string; userName?: string };
}

const messageType = "brevo:contacts-delete";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

export async function deleteBrevoContacts(ids: NumberOrString[], snapshotBy?: string): Promise<StatusMappedResponseSingleInput[]> {
  const client = await brevoClient();
  const total = ids.length;
  debugLog("Processing", pluraliseWithCount(total, "contact deletion request"));
  const responses: StatusMappedResponseSingleInput[] = await Promise.all(ids.map(async (id: NumberOrString, index: number) => {
    const position = `${index + 1} of ${total}`;
    await snapshotBrevoContact(id, snapshotBy);
    const identifier: string = isString(id) ? encodeURIComponent(id) : id.toString();
    const response = await scheduleBrevo(() => client.contacts.deleteContact({identifier}).withRawResponse());
    const mapped = mapStatusMappedResponseSingleInput(id, response, 204);
    debugLog("Deleted Brevo contact", id, `(${position})`, "status", mapped.status);
    return mapped;
  }));
  debugLog("Completed", responses.length, "of", pluraliseWithCount(total, "contact deletion request"));
  return responses;
}

export async function contactsDelete(req: Request, res: Response): Promise<void> {
  try {
    const request: ContactsDeleteRequest = req.body;
    const snapshotBy = (req as AuthenticatedDeleteRequest).user?.userName;
    const responses: StatusMappedResponseSingleInput[] = await deleteBrevoContacts(request.ids, snapshotBy);
    successfulResponse({req, res, response: responses, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
