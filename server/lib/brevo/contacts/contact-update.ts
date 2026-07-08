import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { ContactUpdateRequest } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { handleError, successfulResponse } from "../common/messages";
import { ensureMemberContactAttributes, stripUnavailableMemberAttributes } from "./member-contact-attributes";
import { deleteBrevoContacts } from "./contact-delete";

const messageType = "brevo:contacts:update";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

async function resolveDuplicateContactWithTargetEmail(client: Awaited<ReturnType<typeof brevoClient>>, contactUpdateRequest: ContactUpdateRequest): Promise<void> {
  const existingContact: any = await scheduleBrevo(() => client.contacts.getContactInfo({identifier: contactUpdateRequest.email})).catch(() => null);
  if (!existingContact || Number(existingContact.id) === Number(contactUpdateRequest.id)) {
    return;
  }
  const existingExtId = existingContact.ext_id ?? existingContact.attributes?.EXT_ID;
  if (existingExtId && existingExtId !== contactUpdateRequest.extId) {
    throw new Error(`The email address ${contactUpdateRequest.email} is already used by a different Brevo contact (id ${existingContact.id}) linked to another member`);
  }
  debugLog("deleting duplicate contact", existingContact.id, "already holding target email", contactUpdateRequest.email);
  await deleteBrevoContacts([existingContact.id], "duplicate-email-resolution");
}

export async function contactUpdate(req: Request, res: Response): Promise<any> {
  try {
    const client = await brevoClient();
    const contactUpdateRequest: ContactUpdateRequest = req.body;
    debugLog("updating contact", contactUpdateRequest.id, "with email", contactUpdateRequest.email);
    await resolveDuplicateContactWithTargetEmail(client, contactUpdateRequest);
    const availableMemberAttributes = await ensureMemberContactAttributes();
    const attributes = stripUnavailableMemberAttributes({
      ...(contactUpdateRequest.attributes ?? {}),
      EMAIL: contactUpdateRequest.email
    }, availableMemberAttributes) as unknown as Record<string, string>;
    const response = await scheduleBrevo(() => client.contacts.updateContact({
      identifier: contactUpdateRequest.id,
      identifierType: "contact_id",
      attributes,
      ...(contactUpdateRequest.extId ? {ext_id: contactUpdateRequest.extId} : {})
    }).withRawResponse());
    debugLog("response", response);
    successfulResponse({req, res, response: response.data, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
