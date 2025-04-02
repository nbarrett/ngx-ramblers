import { NextFunction, Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import debug from "debug";
import { configuredBrevo } from "../brevo-config";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import { CreateSmtpEmail, SendSmtpEmail } from "@getbrevo/brevo";
import { handleError, performTemplateSubstitution, successfulResponse } from "../common/messages";
import * as http from "http";
import { SendSmtpEmailRequest } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:send-transactional-mail";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));

debugLog.enabled = false;


export async function sendTransactionalMail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
    const emailRequest: SendSmtpEmailRequest = req.body;
    const sendSmtpEmail: SendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = emailRequest.subject;
    sendSmtpEmail.sender = emailRequest.sender;
    sendSmtpEmail.to = emailRequest.to;
    if (emailRequest.cc) {
      sendSmtpEmail.cc = emailRequest.cc;
    }
    sendSmtpEmail.replyTo = emailRequest.replyTo;
    sendSmtpEmail.headers = emailRequest.headers;
    sendSmtpEmail.params = emailRequest.params;
    await performTemplateSubstitution(emailRequest, sendSmtpEmail, debugLog);
    debugLog("About to send mail with supplied sendSmtpEmail:", sendSmtpEmail);
    apiInstance.sendTransacEmail(sendSmtpEmail).then((data: {
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

