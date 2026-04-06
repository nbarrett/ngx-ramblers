import { NextFunction, Request, Response } from "express";
import debug from "debug";
import { SendSmtpEmail } from "@getbrevo/brevo";
import { envConfig } from "../../env-config/env-config";
import { handleError, performTemplateSubstitution, successfulResponse } from "../common/messages";
import { TemplateRenderRequest, TemplateRenderResponse } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:render-template-preview";
const debugLog = debug(envConfig.logNamespace(messageType));

debugLog.enabled = false;

export async function renderTemplatePreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const renderRequest: TemplateRenderRequest = req.body;
    const sendSmtpEmail = new SendSmtpEmail();
    await performTemplateSubstitution(renderRequest, sendSmtpEmail, debugLog);
    const response: TemplateRenderResponse = {
      htmlContent: sendSmtpEmail.htmlContent || ""
    };
    successfulResponse({ req, res, response, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
