import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import http from "http";
import { ContactsListResponse, FoldersListResponse } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:folders";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function folders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);

    const opts = {
      limit: 10,
      offset: 0
    };

    const response: {
      response: http.IncomingMessage,
      body: any
    } = await apiInstance.getFolders(opts.limit, opts.offset);
    const foldersListResponse: FoldersListResponse = response.body;
    successfulResponse({req, res, response: foldersListResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
