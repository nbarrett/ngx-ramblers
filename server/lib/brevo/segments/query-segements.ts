import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import {
  DEFAULT_REQUEST_OPTIONS,
  MailConfig,
  OptionalRequestOptions,
  SegmentsResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import { ContactsApi, GetSegmentsSegments } from "@getbrevo/brevo";
import http from "http";
import { handleError, successfulResponse } from "../common/messages";

const messageType = "brevo:segments:query";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function querySegments(req: Request, res: Response): Promise<any> {
  try {
    const brevoConfig: MailConfig = await configuredBrevo();
    const apiInstance: ContactsApi = new SibApiV3Sdk.ContactsApi();
    apiInstance.setApiKey(SibApiV3Sdk.ContactsApiApiKeys.apiKey, brevoConfig.apiKey);
    const requestOptions: OptionalRequestOptions = req.body || DEFAULT_REQUEST_OPTIONS;
    debugLog("about to query with requestOptions:", requestOptions);
    const apiResponse: {
      response: http.IncomingMessage,
      body?: any
    } = await apiInstance.getSegments(requestOptions.limit, requestOptions.offset, requestOptions.sort, requestOptions.options);

    const response: SegmentsResponse = {
      count: apiResponse.body.count,
      segments: apiResponse.body.segments.map((segment: GetSegmentsSegments) => ({segment}))
    };
    debugLog("apiResponse:", apiResponse, "response:", response);
    successfulResponse({req, res, response, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
