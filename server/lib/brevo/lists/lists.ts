import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import http from "http";
import {
  OptionalRequestOptions,
  ListCreateRequest,
  ListsResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:lists";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

export async function lists(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const createList = new SibApiV3Sdk.CreateList();
    const listCreateRequest: ListCreateRequest = req.body;
    debugLog("received listCreateRequest:", listCreateRequest);
    createList.name = listCreateRequest.name || req.query.name?.toString();
    createList.folderId = +(listCreateRequest.folderId || req.query.folderId?.toString());
    const opts: OptionalRequestOptions = {limit: 10, offset: 0};
    const response: {
      response: http.IncomingMessage,
      body: any
    } = await apiInstance.getLists(opts.limit, opts.offset, opts.sort);
    const listsResponse: ListsResponse = {
      lists: response?.body?.lists || [],
      count: response?.body?.count || 0
    };
    debugLog("returning listsResponse:", listsResponse);
    successfulResponse({req, res, response: listsResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
