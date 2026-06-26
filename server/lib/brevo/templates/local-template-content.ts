import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { handleError, successfulResponse } from "../common/messages";
import { localTemplateNames, readLocalTemplate } from "./local-template-reader";

const messageType = "brevo:local-template-content";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function localTemplateContent(req: Request, res: Response): Promise<void> {
  try {
    const templateName: string = req.body?.templateName;
    const htmlContent: string | null = templateName ? readLocalTemplate(templateName) : null;
    debugLog("local template content for", templateName, "length:", htmlContent?.length || 0);
    successfulResponse({req, res, response: {templateName, htmlContent}, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}

export async function localTemplateNamesList(req: Request, res: Response): Promise<void> {
  try {
    const templateNames: string[] = localTemplateNames();
    debugLog("local template names:", templateNames);
    successfulResponse({req, res, response: {templateNames}, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
