import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { mkdirSync, writeFileSync } from "fs";
import { isArray, isBoolean } from "es-toolkit/compat";
import { envConfig } from "../../env-config/env-config";
import { handleError, sanitiseBrevoTemplate, successfulResponse } from "../common/messages";
import { listTemplates } from "./template-management";
import { queryTemplateContent } from "../transactional-mail/query-template-content";
import { resolveClientPath } from "../../shared/path-utils";
import { BREVO_TEMPLATES_DIR, localTemplatePath } from "./local-template-reader";
import {
  MailTemplate,
  SnapshotTemplateFailure,
  SnapshotTemplateSaved,
  SnapshotTemplatesRequest,
  SnapshotTemplatesResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { readLocalTemplate } from "./local-template-reader";

const messageType = "brevo:snapshot-templates";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

function filterTemplates(templates: MailTemplate[], request: SnapshotTemplatesRequest): MailTemplate[] {
  const templateIds = isArray(request.templateIds) ? request.templateIds : [];
  const templateNames = isArray(request.templateNames) ? request.templateNames : [];
  const filterByIds = templateIds.length > 0;
  const filterByNames = templateNames.length > 0;
  return templates.filter(template => {
    const matchesId = filterByIds ? templateIds.includes(template.id) : true;
    const matchesName = filterByNames ? templateNames.includes(template.name) : true;
    return matchesId && matchesName;
  });
}

export async function snapshotTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (envConfig.env !== "development") {
      return res.status(403).json({
        message: "Template snapshot is only available in development environments",
        error: "Forbidden"
      });
    }
    const request: SnapshotTemplatesRequest = req.body || {};
    const templateStatus = isBoolean(request.templateStatus) ? request.templateStatus : null;
    const sanitisedHtml = isBoolean(request.sanitiseHtml) ? request.sanitiseHtml : true;
    const templatesResponse = await listTemplates(templateStatus);
    const templatesToSnapshot = filterTemplates(templatesResponse.templates, request);
    const outputDirectory = resolveClientPath(BREVO_TEMPLATES_DIR);
    mkdirSync(outputDirectory, {recursive: true});
    const savedTemplates: SnapshotTemplateSaved[] = [];
    const failedTemplates: SnapshotTemplateFailure[] = [];
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    for (const template of templatesToSnapshot) {
      try {
        if (template.name.includes("/") || template.name.includes("\\")) {
          failedTemplates.push({
            templateId: template.id,
            templateName: template.name,
            reason: "Template name contains invalid path characters"
          });
          continue;
        }
        const templateResponse = await queryTemplateContent(template.id);
        const htmlContent = templateResponse?.htmlContent;
        if (!htmlContent) {
          failedTemplates.push({
            templateId: template.id,
            templateName: template.name,
            reason: "No HTML content returned"
          });
          continue;
        }
        const filePath = localTemplatePath(template.name);
        const localContent = readLocalTemplate(template.name);
        const contentToSave = sanitisedHtml ? sanitiseBrevoTemplate(htmlContent) : htmlContent;
        if (localContent === contentToSave) {
          unchangedCount += 1;
          continue;
        }
        if (localContent) {
          updatedCount += 1;
        } else {
          createdCount += 1;
        }
        writeFileSync(filePath, contentToSave, "utf-8");
        savedTemplates.push({templateId: template.id, templateName: template.name, filePath});
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        failedTemplates.push({templateId: template.id, templateName: template.name, reason});
      }
    }

    const savedCount = createdCount + updatedCount;
    const response: SnapshotTemplatesResponse = {
      totalTemplates: templatesResponse.templates.length,
      templatesRequested: templatesToSnapshot.length,
      outputDirectory: BREVO_TEMPLATES_DIR,
      sanitisedHtml,
      createdCount,
      updatedCount,
      unchangedCount,
      savedCount,
      savedTemplates,
      failedTemplates
    };
    successfulResponse({req, res, response, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
