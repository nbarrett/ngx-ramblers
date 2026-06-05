import debug from "debug";
import { Request, Response } from "express";
import { TemplateOverrides } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { envConfig } from "../../env-config/env-config";
import { applyContentBlocks, handleError, successfulResponse } from "../common/messages";
import { contentBlockHtmlToMarkdown } from "../common/content-block-markdown";
import { readLocalTemplate } from "./local-template-reader";

const messageType = "brevo:editable-body";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const SHELL_MESSAGE_FIELDS = ["subject", "BANNER_IMAGE_SOURCE", "ADDRESS_LINE", "BODY_CONTENT_TOP", "BODY_CONTENT_BOTTOM", "ACCENT_COLOR"];

function stripShell(html: string): string {
  const withoutConditionals = html.replace(/\{%\s*if[\s\S]*?\{%\s*endif\s*%\}/g, "");
  const withoutShellFields = SHELL_MESSAGE_FIELDS.reduce(
    (content, field) => content.replace(new RegExp(`\\{\\{\\s*params\\.messageMergeFields\\.${field}\\s*\\}\\}`, "g"), ""),
    withoutConditionals);
  return withoutShellFields.replace(/<(h[1-6]|p)>\s*<\/\1>/g, "");
}

function inlineOverrideImages(html: string, overrides?: TemplateOverrides): string {
  return html.replace(/\{\{\s*override\.([A-Z_]+)\s*\}\}/g, (_full, key) => {
    const imageUrl = overrides?.[key]?.imageUrl;
    return imageUrl
      ? `<p><img src="${imageUrl}" alt="${key}"></p>`
      : `<p><em>[Image: ${key} - to be added]</em></p>`;
  });
}

export function editableBodyMarkdown(templateName: string, overrides?: TemplateOverrides): string {
  const raw = readLocalTemplate(templateName);
  if (!raw) {
    return "";
  }
  const withBlocks = applyContentBlocks(raw, overrides);
  const withImages = inlineOverrideImages(withBlocks, overrides);
  return contentBlockHtmlToMarkdown(stripShell(withImages));
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
