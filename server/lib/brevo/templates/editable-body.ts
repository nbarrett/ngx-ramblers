import debug from "debug";
import { Request, Response } from "express";
import { TemplateOverrides } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { envConfig } from "../../env-config/env-config";
import { applyContentBlocksAsMarkdown, handleError, successfulResponse } from "../common/messages";
import { readLocalTemplate } from "./local-template-reader";

const messageType = "brevo:editable-body";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const SHELL_MESSAGE_FIELDS = ["subject", "BANNER_IMAGE_SOURCE", "ADDRESS_LINE", "BODY_CONTENT", "BODY_CONTENT_TOP", "BODY_CONTENT_BOTTOM", "ACCENT_COLOR"];

function stripShell(markdown: string): string {
  const withoutConditionals = markdown.replace(/\{%\s*if[\s\S]*?\{%\s*endif\s*%\}/g, "");
  const withoutShellFields = SHELL_MESSAGE_FIELDS.reduce(
    (content, field) => content.replace(new RegExp(`\\{\\{\\s*params\\.messageMergeFields\\.${field}\\s*\\}\\}`, "g"), ""),
    withoutConditionals);
  return withoutShellFields
    .replace(/^#{1,6}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inlineOverrideImages(markdown: string, overrides?: TemplateOverrides): string {
  return markdown.replace(/\{\{\s*override\.([A-Z_]+)\s*\}\}/g, (_full, key) => {
    const imageUrl = overrides?.[key]?.imageUrl;
    return imageUrl ? `![${key}](${imageUrl})` : `*[Image: ${key} - to be added]*`;
  });
}

export function editableBodyMarkdown(templateName: string, overrides?: TemplateOverrides): string {
  const raw = readLocalTemplate(templateName);
  return raw ? stripShell(inlineOverrideImages(applyContentBlocksAsMarkdown(raw, overrides), overrides)) : "";
}

export async function editableBodyContent(req: Request, res: Response): Promise<void> {
  try {
    const templateName: string = req.body?.templateName;
    const overrides: TemplateOverrides | undefined = req.body?.templateOverrides;
    const body = templateName ? editableBodyMarkdown(templateName, overrides) : "";
    debugLog("editable body for", templateName, "length:", body.length);
    successfulResponse({req, res, response: {templateName, body}, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
