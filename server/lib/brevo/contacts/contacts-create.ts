import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { brevoClient } from "../brevo-config";
import { CreateContactRequestWithObjectAttributes } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { Brevo } from "@getbrevo/brevo";
import { handleError, mapStatusMappedResponseSingleInput, successfulResponse } from "../common/messages";
import { scheduleBrevo } from "../common/rate-limiting";
import { ensureMemberContactAttributes, stripUnavailableMemberAttributes } from "./member-contact-attributes";

const messageType = "brevo:contacts:create";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactsCreate(req: Request, res: Response): Promise<any> {
  try {
    const client = await brevoClient();
    const createContactRequests: CreateContactRequestWithObjectAttributes[] = req.body;
    const availableMemberAttributes = await ensureMemberContactAttributes();
    debugLog("received", createContactRequests.length, "createContactRequests:", createContactRequests);
    const responses = await Promise.all(createContactRequests.map(async (createContactRequest: CreateContactRequestWithObjectAttributes) => {
      const createContact: Brevo.CreateContactRequest = {
        email: createContactRequest.email,
        listIds: createContactRequest.listIds,
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
