import { Request, Response } from "express";
import { CreateEmailCampaign, HttpError, SendSmtpEmail } from "@getbrevo/brevo";
import debug from "debug";
import http from "http";
import {
  CreateCampaignRequest,
  extractOverrideKeys,
  overrideKeyToLabel,
  SendSmtpEmailRequest,
  StatusMappedResponseMultipleInputs,
  StatusMappedResponseSingleInput,
  TemplateRenderRequest,
  TemplateResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { queryTemplateContent } from "../transactional-mail/query-template-content";
import { KeyValue } from "../../../../projects/ngx-ramblers/src/app/functions/enums";
import { extractParametersFrom } from "../../../../projects/ngx-ramblers/src/app/common/mail-parameters";
import { replaceAll } from "../../shared/string-utils";
import { ramblersEmailLayout } from "../templates/ramblers-email-layout";
import { errorResponse } from "../../shared/error-response";

function valueAtPath(source: Record<string, any>, path: string): any {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function truthy(value: any): boolean {
  return !!(value && `${value}`.trim());
}

export function applyBrevoConditionals(html: string, params?: Record<string, any>): string {
  return html.replace(/\{%\s*if\s+([^%]+?)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g, (_, rawPath: string, content: string) => {
    const conditionPath = rawPath.trim();
    return truthy(valueAtPath({ params }, conditionPath)) ? content : "";
  });
}

export function normaliseMergeFieldPlaceholders(html: string): string {
  return html
    .replace(/\{\{\s*(params\.\w+\.\w+)\s*\}\}/g, "{{$1}}")
    .replace(/\{\{\s*(override\.[A-Z_]+)\s*\}\}/g, "{{$1}}");
}

export function stripFroalaArtefacts(html: string): string {
  return html
    .replace(/\s*fr-original-style="[^"]*"/g, "")
    .replace(/\s*fr-original-class="[^"]*"/g, "")
    .replace(/\s*contenteditable="[^"]*"/g, "")
    .replace(/\s*data-placeholder="[^"]*"/g, "")
    .replace(/\u200b/g, "");
}

export function collapseFroalaPlaceholderSpans(html: string): string {
  return html
    .replace(/<span\s+class="placeholder rte-personalized-node fr-deletable"[^>]*>([^<]*)<\/span>\u200b?/g, "$1")
    .replace(/<span[^>]*>\s*(\{\{\s*override\.[A-Z_]+\s*}})\s*<\/span>/g, "$1");
}

const MERGE_FIELD_REGEX = /\{\{\s*params\.[a-zA-Z]+\.[A-Z_]+\s*}}/g;

function wrapToken(token: string): string {
  return `<span class="placeholder rte-personalized-node fr-deletable" contenteditable="false">${token}</span>`;
}

export function wrapMergeFieldsAsFroalaPlaceholders(html: string): string {
  const segments = html.split(/(<[^>]*>)/g);
  return segments.map(segment => segment.startsWith("<") ? segment : segment.replace(MERGE_FIELD_REGEX, wrapToken)).join("");
}

export function collapseBlankLines(html: string): string {
  return html.replace(/(<body[^>]*>)\n{2,}/g, "$1\n");
}

export function sanitiseBrevoTemplate(html: string): string {
  return collapseBlankLines(
    normaliseMergeFieldPlaceholders(
      collapseFroalaPlaceholderSpans(
        stripFroalaArtefacts(html)
      )
    )
  );
}

export function applyTemplateOverrides(html: string, overrides?: Record<string, string>): string {
  const keys = extractOverrideKeys(html);
  if (keys.length === 0) {
    return html;
  }
  return keys.reduce((content, key) => {
    const marker = `{{override.${key}}}`;
    const imageUrl = overrides?.[key];
    const label = overrideKeyToLabel(key);
    const replacement = imageUrl
      ? `<img src="${imageUrl}" alt="${label}" style="max-width:100%;height:auto;display:block">`
      : `<em style="color:#757575">[${label} — To Be Added By Your Webmaster]</em>`;
    return replaceAll(marker, replacement, content) as string;
  }, html);
}

export function inlineDefaultLinkStyles(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (match: string, attributes: string) => {
    const styleMatch = attributes.match(/\sstyle=(["'])(.*?)\1/i);
    if (!styleMatch) {
      return `<a${attributes} style="color:#c05711;text-decoration:underline;">`;
    }
    const styleQuote = styleMatch[1];
    const styleValue = styleMatch[2];
    const hasColour = /(^|;)\s*color\s*:/i.test(styleValue);
    const hasTextDecoration = /(^|;)\s*text-decoration\s*:/i.test(styleValue);
    const additions = [
      hasColour ? null : "color:#c05711",
      hasTextDecoration ? null : "text-decoration:underline"
    ].filter(Boolean).join(";");
    if (!additions) {
      return match;
    }
    const mergedStyleValue = `${styleValue}${styleValue.trim().endsWith(";") ? "" : ";"}${additions};`;
    return match.replace(styleMatch[0], ` style=${styleQuote}${mergedStyleValue}${styleQuote}`);
  });
}

export async function performTemplateSubstitution(emailRequest: SendSmtpEmailRequest | CreateCampaignRequest | TemplateRenderRequest,
                                                  sendSmtpEmail: SendSmtpEmail | CreateEmailCampaign,
                                                  debugLog: debug.Debugger): Promise<SendSmtpEmail | CreateEmailCampaign> {
  const priorDebugValue = debugLog.enabled;
  debugLog.enabled = false;
  try {
    if (emailRequest.templateId) {
      debugLog("performing template substitution in email content for templateId", emailRequest.templateId);
      const templateResponse: TemplateResponse = await queryTemplateContent(emailRequest.templateId);
      const sanitisedHtml = sanitiseBrevoTemplate(templateResponse.htmlContent);
      const overriddenHtml = applyTemplateOverrides(sanitisedHtml, emailRequest.templateOverrides);
      const wrappedHtml = ramblersEmailLayout(overriddenHtml);
      const parametersAndValues: KeyValue<any>[] = extractParametersFrom(emailRequest.params, true);
      debugLog("parametersAndValues:", parametersAndValues);
      const substitutedHtmlContent: string = parametersAndValues.reduce(
        (templateContent, keyValue) => {
          debugLog(`Replacing ${keyValue.key} with ${keyValue.value} in ${templateContent}`);
          return replaceAll(keyValue.key, keyValue.value, templateContent) as string;
        },
        wrappedHtml,
      );
      const htmlContent = inlineDefaultLinkStyles(applyBrevoConditionals(substitutedHtmlContent, emailRequest.params));
      debugLog(`Setting final htmlContent to ${htmlContent}`);
      sendSmtpEmail.htmlContent = htmlContent;
    } else {
      debugLog(`Using supplied htmlContent`, emailRequest.htmlContent);
      sendSmtpEmail.htmlContent = emailRequest.htmlContent;
    }
  } catch (error) {
    debugLog(`Error occurred`, error);
  } finally {
    debugLog.enabled = priorDebugValue;
  }
  return sendSmtpEmail;
}

export function mapStatusMappedResponseSingleInput(id: any, response: BrevoResponse, ...expectedHttpResponseCodes: number[]): StatusMappedResponseSingleInput {
  return {
    id,
    success: expectedHttpResponseCodes.includes(response.response.statusCode) ,
    status: response.response.statusCode,
    message: response.response.statusMessage,
    responseBody: response.body
  };
}

export function mapStatusMappedResponseMultipleInputs(ids: any[], response: BrevoResponse, ...expectedHttpResponseCodes: number[]): StatusMappedResponseMultipleInputs {
  return {
    ids,
    success: expectedHttpResponseCodes.includes(response.response.statusCode) ,
    status: response.response.statusCode,
    message: response.response.statusMessage,
    responseBody: response.body
  };
}

export function successfulResponse(successfulResponse: SuccessfulResponse) {
  successfulResponse.debugLog("successfulResponse:", JSON.stringify(successfulResponse.response));
  successfulResponse.res.status(successfulResponse.status || 200).json({
    request: {messageType: successfulResponse.messageType},
    response: successfulResponse.response
  });
}

export function handleError(req: Request, res: Response, messageType: string, debugLog: any, error: unknown) {
  const priorDebugValue = debugLog.enabled;
  debugLog.enabled = true;
  if (error instanceof HttpError) {
    debugLog(messageType, "API call failed with HttpError: body", error.body, "statusCode:", error.statusCode);
    res.status(error.statusCode).json({request: {messageType}, error: error.body});
  } else {
    debugLog(messageType, "API call failed with non-HttpError: body", error);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
  debugLog.enabled = priorDebugValue;
}

export interface SuccessfulResponse {
  req?: Request,
  res?: Response,
  response: any,
  messageType?: string,
  debugLog: debug.Debugger
  status?: number;
}

export interface BrevoResponse {
  response: http.IncomingMessage;
  body?: any;
}
