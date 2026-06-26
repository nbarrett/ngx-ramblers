import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { brevoClient } from "../brevo-config";
import { CreateContactRequestWithObjectAttributes } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { Brevo } from "@getbrevo/brevo";
import { handleError, mapStatusMappedResponseSingleInput, successfulResponse } from "../common/messages";
import { scheduleBrevo } from "../common/rate-limiting";
import { ensureMemberContactAttributes, stripUnavailableMemberAttributes } from "./member-contact-attributes";
import { fetchExistingListIds, filterToExistingListIds } from "../lists/existing-list-ids";

const messageType = "brevo:contacts:create";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactsCreate(req: Request, res: Response): Promise<any> {
  try {
    const client = await brevoClient();
    const createContactRequests: CreateContactRequestWithObjectAttributes[] = req.body;
    const availableMemberAttributes = await ensureMemberContactAttributes();
    const existingListIds = await fetchExistingListIds(client);
    debugLog("received", createContactRequests.length, "createContactRequests:", createContactRequests);
    const responses = await Promise.all(createContactRequests.map(async (createContactRequest: CreateContactRequestWithObjectAttributes) => {
      const {valid: listIds, missing: missingListIds} = filterToExistingListIds(createContactRequest.listIds, existingListIds);
      if (missingListIds.length > 0) {
        debugLog("skipping list ids not present in the connected Brevo account:", missingListIds, "for", createContactRequest.email);
      }
      const createContact: Brevo.CreateContactRequest = {
        email: createContactRequest.email,
        listIds: listIds.length > 0 ? listIds : undefined,
        attributes: stripUnavailableMemberAttributes(createContactRequest.attributes, availableMemberAttributes) as unknown as Brevo.CreateContactRequest["attributes"],
        ext_id: createContactRequest.extId
      };
      debugLog("making createContactRequest:", createContactRequests.indexOf(createContactRequest) + 1, "of", createContactRequests.length);
      const response = await scheduleBrevo(() => {
        debugLog("creating contact:", createContact);
        return client.contacts.createContact(createContact).withRawResponse();
      });
      return mapStatusMappedResponseSingleInput(createContactRequest.email, response, 201, 204);
    }));
    debugLog("createContactRequests:", createContactRequests, "responses:", responses);
    successfulResponse({req, res, response: responses, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
