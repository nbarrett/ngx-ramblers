import { Request, Response } from "express";
import { MailchimpApiError, MailchimpConfig, MailchimpErrorResponse, MailchimpHttpErrorResponse } from "../../../projects/ngx-ramblers/src/app/models/mailchimp.model";
import { isUndefined } from "es-toolkit/compat";

export function successfulResponse(req: Request, res: Response, response, messageType, debug) {
  debug("successfulResponse:", JSON.stringify(response));
  res.json({request: {messageType}, response});
}

export function unsuccessfulResponse(req: Request, res: Response, error: MailchimpApiError, messageType, debug) {
  if (isMailchimpHttpErrorResponse(error)) {
    const mailchimpErrorResponse: MailchimpErrorResponse = JSON.parse(error.response.text);
    debug("unsuccessfulResponse:MailchimpHttpErrorResponse:", mailchimpErrorResponse);
    res.status(error.status).json({request: {messageType}, error: mailchimpErrorResponse});
  } else if (isError(error)) {
    const errorResponse = {code: error.name, message: error.message, stack: error.stack};
    debug("unsuccessfulResponse:Error response:", errorResponse);
    res.status(500).json({request: {messageType}, error: errorResponse});
  } else if (isMailchimpErrorResponse(error)) {
    debug("unsuccessfulResponse:MailchimpHttpErrorResponse:", error);
    res.status(error.status).json({request: {messageType}, error});
  } else {
    debug("unsuccessfulResponse:Unknown response:", error);
    res.status(500).json({request: {messageType}, error});
  }
}

export function logRequestData(messageType: string, requestData: any, debug, req?: Request) {
  debug(messageType, "request", JSON.stringify(requestData), req ? "url: " + req.url : null);
}

export function debug(messageType, requestData, debug): void {
  debug(messageType, "request", JSON.stringify(requestData));
}

export function listTypeToId(req: Request, debug, config: MailchimpConfig): string {
  const listId = config.lists[req.params.listType];
  debug("Mapping list type:" + req.params.listType + "-> mailchimp list Id", listId);
  return listId;
}

function isMailchimpHttpErrorResponse(object: MailchimpApiError): object is MailchimpHttpErrorResponse {
  return !isUndefined((object as MailchimpHttpErrorResponse)?.response?.status);
}

function isMailchimpErrorResponse(object: MailchimpErrorResponse): object is MailchimpErrorResponse {
  return !isUndefined((object as MailchimpErrorResponse)?.instance);
}

function isError(object: MailchimpApiError): object is Error {
  return !isUndefined((object as Error)?.stack);
}
