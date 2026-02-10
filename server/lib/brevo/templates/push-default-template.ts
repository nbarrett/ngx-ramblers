import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { handleError, successfulResponse } from "../common/messages";
import { updateTemplate } from "./template-management";
import { readLocalTemplate } from "./local-template-reader";
import {
  PushDefaultTemplateRequest,
  PushDefaultTemplateResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:push-default-template";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

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
