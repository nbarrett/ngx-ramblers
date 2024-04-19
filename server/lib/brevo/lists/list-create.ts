import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import http from "http";
import { ListCreateRequest, ListsResponse } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:lists:list-create";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

export async function listCreate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const listCreateRequest: ListCreateRequest = req.body;
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const createList = new SibApiV3Sdk.CreateList();
    createList.name = listCreateRequest.name;
    createList.folderId = listCreateRequest.folderId;
    debugLog("createList request received:", createList);
    const response: { response: http.IncomingMessage, body: any } = await apiInstance.createList(createList);
    const listsResponse: ListsResponse = response.body;
    successfulResponse({req, res, response: listsResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
