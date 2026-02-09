import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { readFileSync, existsSync } from "fs";
import { envConfig } from "../../env-config/env-config";
import { handleError, successfulResponse } from "../common/messages";
import { updateTemplate } from "./template-management";
import { resolveClientPath } from "../../shared/path-utils";
import {
  PushDefaultTemplateRequest,
  PushDefaultTemplateResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:push-default-template";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

function localTemplatePath(templateName: string): string {
  return resolveClientPath(`projects/ngx-ramblers/src/brevo/templates/${templateName}.html`);
}

function readLocalTemplate(templateName: string): string | null {
  const templatePath = localTemplatePath(templateName);
  debugLog("reading local template from", templatePath);
  if (!existsSync(templatePath)) {
    debugLog("local template not found at", templatePath);
    return null;
  }
  return readFileSync(templatePath, "utf-8");
}

export async function pushDefaultTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request: PushDefaultTemplateRequest = req.body;
    debugLog("received push request:", request);
    const htmlContent = readLocalTemplate(request.templateName);
    if (!htmlContent) {
      const response: PushDefaultTemplateResponse = {
        templateId: request.templateId,
        templateName: request.templateName,
        pushed: false,
        message: `No local template found for "${request.templateName}"`
      };
      successfulResponse({req, res, response, messageType, debugLog});
      return;
    }
    await updateTemplate({templateId: request.templateId, htmlContent});
    const response: PushDefaultTemplateResponse = {
      templateId: request.templateId,
      templateName: request.templateName,
      pushed: true,
      message: `Successfully pushed local template "${request.templateName}" to Brevo template ${request.templateId}`
    };
    debugLog("push completed:", response);
    successfulResponse({req, res, response, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
