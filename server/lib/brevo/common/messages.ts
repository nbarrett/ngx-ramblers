import { Request, Response } from "express";
import { HttpError } from "@getbrevo/brevo";
import debug from "debug";
import http from "http";
import {
  StatusMappedResponseMultipleInputs,
  StatusMappedResponseSingleInput
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

export function mapStatusMappedResponseSingleInput(id: any, response: BrevoResponse, ...expectedHttpResponseCodes: number[]): StatusMappedResponseSingleInput {
  return {
    id,
    success: expectedHttpResponseCodes.includes(response.response.statusCode) ,
    status: response.response.statusCode,
    message: response.response.statusMessage,
    responseBody: response.body
  };
}

export function mapStatusMappedResponseMultipleInputs(ids: any[], response: BrevoResponse, ...expectedHttpResponseCodes: number[]): StatusMappedResponseMultipleInputs {
  return {
    ids,
    success: expectedHttpResponseCodes.includes(response.response.statusCode) ,
    status: response.response.statusCode,
    message: response.response.statusMessage,
    responseBody: response.body
  };
}

export function successfulResponse(successfulResponse: SuccessfulResponse) {
  successfulResponse.debugLog("successfulResponse:", JSON.stringify(successfulResponse.response));
  successfulResponse.res.status(successfulResponse.status || 200).json({
    request: {messageType: successfulResponse.messageType},
    response: successfulResponse.response
  });
}

export function handleError(req: Request, res: Response, messageType: string, debugLog: any, error: HttpError) {
  if (error instanceof HttpError) {
    debugLog(messageType, "API call failed with HttpError: body", error.body, "statusCode:", error.statusCode);
    res.status(error.statusCode).json({request: {messageType}, error: error.body});
  } else {
    res.status(500).json({request: {messageType}, error});
  }
}

export interface SuccessfulResponse {
  req?: Request,
  res?: Response,
  response: any,
  messageType?: string,
  debugLog: debug.Debugger
  status?: number;
}

export interface BrevoResponse {
  response: http.IncomingMessage;
  body?: any;
}

