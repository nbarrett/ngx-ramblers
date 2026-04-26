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
import { buildUnsubscribeApiUrl, buildUnsubscribeUrl } from "../contacts/unsubscribe-token";
import { member } from "../../mongo/models/member";

const messageType = "brevo:send-transactional-mail";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));

debugLog.enabled = false;

function recipientEmail(emailRequest: SendSmtpEmailRequest): string | undefined {
  const fromMember = emailRequest.params?.memberMergeFields?.EMAIL;
  if (fromMember) return fromMember;
  const firstTo = emailRequest.to?.[0]?.email;
  return firstTo;
}

function appUrl(emailRequest: SendSmtpEmailRequest): string | undefined {
  return emailRequest.params?.systemMergeFields?.APP_URL;
}

function buildListUnsubscribeHeader(apiUrl: string, replyToEmail: string | undefined): string {
  const parts = [`<${apiUrl}>`];
  if (replyToEmail) {
    parts.push(`<mailto:${replyToEmail}?subject=unsubscribe>`);
  }
  return parts.join(", ");
}

function mergeHeaders(existing: object | undefined, emailRequest: SendSmtpEmailRequest, apiUnsubscribeUrl: string | null): object | undefined {
  const merged: Record<string, any> = {...(existing as Record<string, any> || {})};
  const replyToEmail = emailRequest.replyTo?.email;
  const hasListUnsubscribe = keys(merged).some(key => key.toLowerCase() === "list-unsubscribe");
  if (!hasListUnsubscribe) {
    if (apiUnsubscribeUrl) {
      merged["List-Unsubscribe"] = buildListUnsubscribeHeader(apiUnsubscribeUrl, replyToEmail);
      merged["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    } else if (replyToEmail) {
      merged["List-Unsubscribe"] = `<mailto:${replyToEmail}?subject=unsubscribe>`;
    }
  }
  return keys(merged).length ? merged : undefined;
}

async function deriveListIdFromMember(email: string): Promise<number | undefined> {
  try {
    const matched = await member.findOne(
      { email: email.toLowerCase() },
      { _id: 1, mail: 1 }
    ).lean().exec() as any;
    const subscribed: Array<{ id: number; subscribed: boolean }> = (matched?.mail?.subscriptions || []).filter((sub: any) => sub?.subscribed);
    if (subscribed.length === 1) return subscribed[0].id;
    return undefined;
  } catch (error: any) {
    debugLog("deriveListIdFromMember:failed", email, error?.message || error);
    return undefined;
  }
}

async function injectUnsubscribeContext(emailRequest: SendSmtpEmailRequest, overrideBaseUrl?: string): Promise<{ apiUrl: string | null }> {
  const email = recipientEmail(emailRequest);
  const pageBaseUrl = appUrl(emailRequest);
  const apiBaseUrl = overrideBaseUrl || pageBaseUrl;
  if (!email || !pageBaseUrl || !apiBaseUrl) {
    return { apiUrl: null };
  }
  const senderEmail = emailRequest.sender?.email || emailRequest.replyTo?.email;
  const listId = emailRequest.listId ?? await deriveListIdFromMember(email);
  try {
    const pageUrl = await buildUnsubscribeUrl(email, pageBaseUrl, senderEmail, listId);
    const apiUrl = await buildUnsubscribeApiUrl(email, apiBaseUrl, senderEmail, listId);
    if (emailRequest.params?.memberMergeFields) {
      emailRequest.params.memberMergeFields.UNSUBSCRIBE_URL = pageUrl;
    }
    return { apiUrl };
  } catch (error: any) {
    debugLog("injectUnsubscribeContext:failed", email, error?.message || error);
    return { apiUrl: null };
  }
}

export async function sendTransactionalEmailRequest(emailRequest: SendSmtpEmailRequest,
                                                    transactionalDebugLog: debug.Debugger,
                                                    unsubscribeBaseUrlOverride?: string): Promise<{
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
  const { apiUrl: apiUnsubscribeUrl } = await injectUnsubscribeContext(emailRequest, unsubscribeBaseUrlOverride);
  sendSmtpEmail.headers = mergeHeaders(emailRequest.headers, emailRequest, apiUnsubscribeUrl);
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
    const liveBaseUrl = `${req.protocol}://${req.get("host")}`;
    sendTransactionalEmailRequest(emailRequest, debugLog, liveBaseUrl).then((data: {
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
