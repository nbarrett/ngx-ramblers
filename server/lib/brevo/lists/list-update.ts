import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import http from "http";
import { ListsResponse, ListUpdateRequest } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:lists:list-update";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function listUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const listUpdateRequest: ListUpdateRequest = req.body;
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const updateList = new SibApiV3Sdk.UpdateList();
    if (listUpdateRequest.name) {
      updateList.name = listUpdateRequest.name;
    } else {
      updateList.folderId = listUpdateRequest.folderId;
    }
    debugLog("updateList request received:", updateList, "with listId:", listUpdateRequest.listId);
    const response: {
      response: http.IncomingMessage,
      body?: any
    } = await apiInstance.updateList(listUpdateRequest.listId, updateList);
    const listsResponse: ListsResponse = response.body;
    successfulResponse({req, res, response: listsResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
