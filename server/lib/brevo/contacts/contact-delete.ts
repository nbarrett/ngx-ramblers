import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, mapStatusMappedResponseSingleInput, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import http from "http";
import {
  ContactsDeleteRequest,
  NumberOrString,
  StatusMappedResponseSingleInput
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { isString } from "es-toolkit/compat";
import { createBottleneckWithRatePerSecond } from "../common/rate-limiting";

const messageType = "brevo:contacts-delete";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const limiter = createBottleneckWithRatePerSecond(10);

export async function contactsDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const request: ContactsDeleteRequest = req.body;
    const responses: StatusMappedResponseSingleInput[] = await Promise.all(request.ids.map(async (id: NumberOrString) => {
      const identifier: string = isString(id) ? encodeURIComponent(id) : id.toString();
      const response: {
        response: http.IncomingMessage,
        body?: any
      } = await limiter.schedule(() => apiInstance.deleteContact(identifier));
      return mapStatusMappedResponseSingleInput(id, response, 204);
    })).then((statusOnlyResponses: StatusMappedResponseSingleInput[]) => {
      debugLog("statusOnlyResponses:", statusOnlyResponses);
      return statusOnlyResponses;
    });
    successfulResponse({req, res, response: responses, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}

