import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import http from "http";
import {
  ContactAddOrRemoveResponse,
  ContactsAddOrRemoveRequest
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:contacts-add-to-list";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactsAddToList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const request: ContactsAddOrRemoveRequest = req.body;
    const listId: number = request.listId
    const contactEmails = new SibApiV3Sdk.AddContactToList();
    contactEmails.ids = request.ids;
    const response: {
      response: http.IncomingMessage,
      body: any
    } = await apiInstance.addContactToList(listId, contactEmails);
    const contactRemoveFromListResponse: ContactAddOrRemoveResponse = response.body;
    successfulResponse({req, res, response: contactRemoveFromListResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
