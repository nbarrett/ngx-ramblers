import { NextFunction, Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import { CreateSmtpEmail, SendSmtpEmail } from "@getbrevo/brevo";
import { handleError, successfulResponse } from "../common/messages";
import * as http from "http";
import { SendSmtpEmailRequest, TemplateResponse } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { queryTemplateContent } from "./query-template-content";
import { KeyValue } from "../../../../projects/ngx-ramblers/src/app/services/enums";
import { replaceAll } from "../../shared/string-utils";
import { extractParametersFrom } from "../../../../projects/ngx-ramblers/src/app/common/mail-parameters";

const messageType = "brevo:send-transactional-mail";
const debugLog = debug(envConfig.logNamespace(messageType));

debugLog.enabled = true;

export async function sendTransactionalMail(req: Request, res: Response, next: NextFunction): Promise<void> {

  const brevoConfig = await configuredBrevo();
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
  const emailRequest: SendSmtpEmailRequest = req.body;
  const sendSmtpEmail: SendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = emailRequest.subject;
  sendSmtpEmail.sender = emailRequest.sender;
  sendSmtpEmail.to = emailRequest.to;
  sendSmtpEmail.replyTo = emailRequest.replyTo;
  sendSmtpEmail.headers = emailRequest.headers;
  sendSmtpEmail.params = emailRequest.params;
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
    debugLog(`Using supplied htmlContent ${emailRequest.htmlContent}`);
    sendSmtpEmail.htmlContent = emailRequest.htmlContent;
  }
  debugLog(`About to send mail with  supplied htmlContent ${sendSmtpEmail}`);
  apiInstance.sendTransacEmail(sendSmtpEmail).then((data: {
    response: http.IncomingMessage;
    body: CreateSmtpEmail
  }) => {
    debugLog("API called successfully. Returned data: " + JSON.stringify(data));
    successfulResponse({req, res, response: data, messageType, debugLog});
  }).catch((error: any) => {
    handleError(req, res, messageType, debugLog, error);
  });
}

