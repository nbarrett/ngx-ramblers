import { Request, Response } from "express";
import { CreateEmailCampaign, HttpError, SendSmtpEmail } from "@getbrevo/brevo";
import debug from "debug";
import http from "http";
import {
  CreateCampaignRequest,
  SendSmtpEmailRequest,
  StatusMappedResponseMultipleInputs,
  StatusMappedResponseSingleInput,
  TemplateResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { queryTemplateContent } from "../transactional-mail/query-template-content";
import { KeyValue } from "../../../../projects/ngx-ramblers/src/app/services/enums";
import { extractParametersFrom } from "../../../../projects/ngx-ramblers/src/app/common/mail-parameters";
import { replaceAll } from "../../shared/string-utils";

export async function performTemplateSubstitution(emailRequest: SendSmtpEmailRequest | CreateCampaignRequest,
                                                  sendSmtpEmail: SendSmtpEmail | CreateEmailCampaign,
                                                  debugLog: debug.Debugger): Promise<SendSmtpEmail | CreateEmailCampaign> {
  const priorDebugValue = debugLog.enabled;
  debugLog.enabled = false;

  if (emailRequest.templateId) {
    debugLog("performing template substitution in email content for templateId", emailRequest.templateId);
    const templateResponse: TemplateResponse = await queryTemplateContent(emailRequest.templateId);
    const parametersAndValues: KeyValue<any>[] = extractParametersFrom(emailRequest.params, true);
    debugLog("parametersAndValues:", parametersAndValues);
    const htmlContent: string = parametersAndValues.reduce(
      (templateContent, keyValue) => {
        debugLog(`Replacing ${keyValue.key} with ${keyValue.value} in ${templateContent}`);
        return replaceAll(keyValue.key, keyValue.value, templateContent) as string;
      },
      templateResponse.htmlContent,
    );
    debugLog(`Setting final htmlContent to ${htmlContent}`);
    sendSmtpEmail.htmlContent = htmlContent;
  } else {
    debugLog(`Using supplied htmlContent`, emailRequest.htmlContent);
    sendSmtpEmail.htmlContent = emailRequest.htmlContent;
  }
  debugLog.enabled = priorDebugValue;
  return sendSmtpEmail;
}

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

