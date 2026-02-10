import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import {
  DEFAULT_TEMPLATE_OPTIONS,
  MailTemplates,
  TemplateOptions
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { listTemplates } from "./template-management";
import { isBoolean } from "es-toolkit/compat";

const messageType = "brevo:query-templates";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function queryTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {

  try {
    const templateOptions: TemplateOptions = req.body || DEFAULT_TEMPLATE_OPTIONS;
    debugLog("received templateOptions:", templateOptions);
    const templateStatus = isBoolean(templateOptions?.templateStatus) ? templateOptions.templateStatus : null;
    const mailTemplatesResponse: MailTemplates = await listTemplates(templateStatus);
    successfulResponse({req, res, response: mailTemplatesResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
