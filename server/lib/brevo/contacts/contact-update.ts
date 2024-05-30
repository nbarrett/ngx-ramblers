import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import { CreateContactRequest, MailConfig } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import http from "http";
import { handleError, successfulResponse } from "../common/messages";

const messageType = "brevo:contacts:update";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactUpdate(req: Request, res: Response): Promise<any> {
  try {
    const brevoConfig: MailConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    const updateContact = new SibApiV3Sdk.UpdateContact();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const createContactRequest: CreateContactRequest = req.body;
    const identifier = createContactRequest.email;
    updateContact.extId = createContactRequest.extId;
    const response: {
      response: http.IncomingMessage,
      body?: any
    } = await apiInstance.updateContact(identifier, updateContact);
    debugLog("response", response);
    successfulResponse({req, res, response: response.body, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
