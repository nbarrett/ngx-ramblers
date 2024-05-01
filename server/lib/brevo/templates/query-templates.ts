import * as SibApiV3Sdk from "@getbrevo/brevo";
import { GetSmtpTemplates } from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import {
  DEFAULT_TEMPLATE_OPTIONS,
  MailTemplate,
  MailTemplates,
  TemplateOptions
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import * as http from "http";

const messageType = "brevo:query-templates";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

export async function queryTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {

  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
    const templateOptions: TemplateOptions = req.body || DEFAULT_TEMPLATE_OPTIONS;
    debugLog("received templateOptions:", templateOptions);
    const response: {
      response: http.IncomingMessage,
      body: GetSmtpTemplates
    } = await apiInstance.getSmtpTemplates(templateOptions?.templateStatus);
    debugLog("received response.body.templates:", response.body.templates);
    const templates: MailTemplate[] = response.body.templates?.map(template => ({
      createdAt: template.createdAt,
      sender: {name: template.sender.name, email: template.sender.email, id: +template.sender.id},
      subject: template.subject,
      doiTemplate: template.doiTemplate,
      modifiedAt: template.modifiedAt,
      toField: template.toField,
      name: template.name,
      replyTo: template.replyTo,
      id: template.id,
      tag: template.tag,
      isActive: template.isActive,
      testSent: template.testSent,
      htmlContent: null
    })) || [];
    const mailTemplatesResponse: MailTemplates = {
      count: response.body.count || 0,
      templates
    };
    successfulResponse({req, res, response: mailTemplatesResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
