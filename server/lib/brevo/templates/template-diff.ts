import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { readFileSync, existsSync } from "fs";
import { envConfig } from "../../env-config/env-config";
import { handleError, successfulResponse } from "../common/messages";
import { queryTemplateContent } from "../transactional-mail/query-template-content";
import { resolveClientPath } from "../../shared/path-utils";
import {
  TemplateDiffRequest,
  TemplateDiffResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:template-diff";
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

function normaliseHtml(html: string): string {
  return html.replace(/\s+/g, " ").trim();
}

export async function templateDiff(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request: TemplateDiffRequest = req.body;
    debugLog("received diff request:", request);
    const localContent = readLocalTemplate(request.templateName);
    if (!localContent) {
      const response: TemplateDiffResponse = {
        templateId: request.templateId,
        templateName: request.templateName,
        hasLocalTemplate: false,
        matchesLocal: false,
        brevoContentLength: 0,
        localContentLength: 0
      };
      successfulResponse({req, res, response, messageType, debugLog});
      return;
    }
    const brevoTemplate = await queryTemplateContent(request.templateId);
    const brevoContent = brevoTemplate?.htmlContent || "";
    const normalisedBrevo = normaliseHtml(brevoContent);
    const normalisedLocal = normaliseHtml(localContent);
    debugLog("normalised brevo length:", normalisedBrevo.length, "normalised local length:", normalisedLocal.length);
    const response: TemplateDiffResponse = {
      templateId: request.templateId,
      templateName: request.templateName,
      hasLocalTemplate: true,
      matchesLocal: normalisedBrevo === normalisedLocal,
      brevoContentLength: brevoContent.length,
      localContentLength: localContent.length
    };
    debugLog("diff result:", response);
    successfulResponse({req, res, response, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
