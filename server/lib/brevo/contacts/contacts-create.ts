import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import {
  CreateContactRequestWithObjectAttributes,
  MailConfig
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import http from "http";
import { handleError, mapStatusMappedResponseSingleInput, successfulResponse } from "../common/messages";
import { scheduleBrevo } from "../common/rate-limiting";
import { ensureMemberContactAttributes, stripUnavailableMemberAttributes } from "./member-contact-attributes";
import { ContactsApi } from "@getbrevo/brevo";

const messageType = "brevo:contacts:create";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactsCreate(req: Request, res: Response): Promise<any> {
  try {
    const brevoConfig: MailConfig = await configuredBrevo();
    const apiInstance: ContactsApi = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const createContactRequests: CreateContactRequestWithObjectAttributes[] = req.body;
    const availableMemberAttributes = await ensureMemberContactAttributes();
    debugLog("received", createContactRequests.length, "createContactRequests:", createContactRequests);
    const responses = await Promise.all(createContactRequests.map(async (createContactRequest: CreateContactRequestWithObjectAttributes) => {
      const createContact = new SibApiV3Sdk.CreateContact();
      createContact.email = createContactRequest.email;
      createContact.listIds = createContactRequest.listIds;
      createContact.attributes = stripUnavailableMemberAttributes(createContactRequest.attributes, availableMemberAttributes);
      createContact.extId = createContactRequest.extId;
      debugLog("making createContactRequest:", createContactRequests.indexOf(createContactRequest) + 1, "of", createContactRequests.length);
      const response: {
        response: http.IncomingMessage,
        body?: any
      } = await scheduleBrevo(() => {
        debugLog("creating contact:", createContact);
        return apiInstance.createContact(createContact);
      });
      return mapStatusMappedResponseSingleInput(createContactRequest.email, response, 201, 204);
    }));
    debugLog("createContactRequests:", createContactRequests, "responses:", responses);
    successfulResponse({req, res, response: responses, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
