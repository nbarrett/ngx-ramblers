import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import http from "http";
import { ContactsListResponse } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:contacts";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contacts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);

    const opts = {
      limit: 1000,
      offset: 0
    };

    const response: {
      response: http.IncomingMessage,
      body: any
    } = await apiInstance.getContacts(opts.limit, opts.offset);
    const contactsListResponse: ContactsListResponse = response.body;
    successfulResponse({req, res, response: contactsListResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
