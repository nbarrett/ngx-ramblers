import { NextFunction, Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import { CreateSmtpEmail, SendSmtpEmail } from "@getbrevo/brevo";
import { handleError, performTemplateSubstitution, successfulResponse } from "../common/messages";
import * as http from "http";
import { SendSmtpEmailRequest } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { htmlToPlainText } from "../../shared/string-utils";
import { keys } from "es-toolkit/compat";

const messageType = "brevo:send-transactional-mail";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));

debugLog.enabled = false;

function mergeHeaders(existing: object | undefined, emailRequest: SendSmtpEmailRequest): object | undefined {
  const merged: Record<string, any> = {...(existing as Record<string, any> || {})};
  const replyToEmail = emailRequest.replyTo?.email;
  const hasListUnsubscribe = keys(merged).some(key => key.toLowerCase() === "list-unsubscribe");
  if (!hasListUnsubscribe && replyToEmail) {
    merged["List-Unsubscribe"] = `<mailto:${replyToEmail}?subject=unsubscribe>`;
  }
  return keys(merged).length ? merged : undefined;
}

export async function sendTransactionalEmailRequest(emailRequest: SendSmtpEmailRequest,
                                                    transactionalDebugLog: debug.Debugger): Promise<{
  response: http.IncomingMessage;
  body: CreateSmtpEmail
}> {
  const brevoConfig = await configuredBrevo();
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
  const sendSmtpEmail: SendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = emailRequest.subject;
  sendSmtpEmail.sender = emailRequest.sender;
  sendSmtpEmail.to = emailRequest.to;
  const bcc = emailRequest.bcc?.length > 0 ? emailRequest.bcc : emailRequest.cc;
  if (bcc) {
    sendSmtpEmail.bcc = bcc;
  }
  sendSmtpEmail.replyTo = emailRequest.replyTo;
  sendSmtpEmail.headers = mergeHeaders(emailRequest.headers, emailRequest);
  sendSmtpEmail.params = emailRequest.params;
  await performTemplateSubstitution(emailRequest, sendSmtpEmail, transactionalDebugLog);
  if (sendSmtpEmail.htmlContent && !sendSmtpEmail.textContent) {
    const textContent = htmlToPlainText(sendSmtpEmail.htmlContent);
    if (textContent) {
      sendSmtpEmail.textContent = textContent;
    }
  }
  transactionalDebugLog("About to send mail with supplied sendSmtpEmail:", sendSmtpEmail);
  return apiInstance.sendTransacEmail(sendSmtpEmail);
}

export async function sendTransactionalMail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const emailRequest: SendSmtpEmailRequest = req.body;
    sendTransactionalEmailRequest(emailRequest, debugLog).then((data: {
      response: http.IncomingMessage;
      body: CreateSmtpEmail
    }) => {
      debugLog("API called successfully. Returned data: " + JSON.stringify(data));
      successfulResponse({req, res, response: data, messageType, debugLog});
    }).catch((error: any) => {
      handleError(req, res, messageType, debugLog, error);
    });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
