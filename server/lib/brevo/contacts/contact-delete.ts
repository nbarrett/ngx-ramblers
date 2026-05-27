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
import { scheduleBrevo } from "../common/rate-limiting";
import { snapshotBrevoContact } from "./contact-snapshot";

interface AuthenticatedDeleteRequest extends Request {
  user?: { memberId?: string; userName?: string };
}

const messageType = "brevo:contacts-delete";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

export async function contactsDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const request: ContactsDeleteRequest = req.body;
    const snapshotBy = (req as AuthenticatedDeleteRequest).user?.userName;
    const total = request.ids.length;
    debugLog("Processing", total, "contact deletion request(s)");
    const responses: StatusMappedResponseSingleInput[] = await Promise.all(request.ids.map(async (id: NumberOrString, index: number) => {
      const position = `${index + 1} of ${total}`;
      await snapshotBrevoContact(id, snapshotBy);
      const identifier: string = isString(id) ? encodeURIComponent(id) : id.toString();
      const response: {
        response: http.IncomingMessage,
        body?: any
      } = await scheduleBrevo(() => apiInstance.deleteContact(identifier));
      const mapped = mapStatusMappedResponseSingleInput(id, response, 204);
      debugLog("Deleted Brevo contact", id, `(${position})`, "status", mapped.status);
      return mapped;
    })).then((statusOnlyResponses: StatusMappedResponseSingleInput[]) => {
      debugLog("Completed", statusOnlyResponses.length, "of", total, "contact deletion request(s)");
      return statusOnlyResponses;
    });
    successfulResponse({req, res, response: responses, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}

