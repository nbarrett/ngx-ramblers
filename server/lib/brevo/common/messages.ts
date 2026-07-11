import { Request, Response } from "express";
import { Brevo, BrevoError } from "@getbrevo/brevo";
import debug from "debug";
import {
  BrandingMode,
  CreateCampaignRequest,
  extractOverrideKeys,
  overrideKeyToLabel,
  SendSmtpEmailRequest,
  StatusMappedResponseMultipleInputs,
  StatusMappedResponseSingleInput,
  TemplateOverride,
  TemplateOverrides,
  TemplateOverrideState,
  TemplateOverrideType,
  TemplateRenderRequest
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { KeyValue } from "../../../../projects/ngx-ramblers/src/app/functions/enums";
import { extractParametersFrom } from "../../../../projects/ngx-ramblers/src/app/common/mail-parameters";
import { toCampaignContactTokens } from "../../../../projects/ngx-ramblers/src/app/common/campaign-contact-tokens";
import { replaceAll } from "../../shared/string-utils";
import { ramblersEmailLayout } from "../templates/ramblers-email-layout";
import { unbrandedEmailLayout } from "../templates/unbranded-email-layout";
import { RAMBLERS_EMAIL_TOKENS } from "../templates/ramblers-design-tokens";
import { readLocalTemplate } from "../templates/local-template-reader";
import { renderMarkdownToHtml } from "../../shared/markdown-renderer";
import { errorResponse } from "../../shared/error-response";
import { logBrevoError } from "./error-log";
import { toPairs, isObject, isString, keys } from "es-toolkit/compat";

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

export function resolveTemplateOverride(overrides: TemplateOverrides | undefined, key: string): TemplateOverride | undefined {
  const raw: any = overrides?.[key];
  if (!raw) {
    return undefined;
  }
  if (isString(raw)) {
    return {type: TemplateOverrideType.IMAGE, state: TemplateOverrideState.CUSTOM, imageUrl: raw};
  }
  return raw as TemplateOverride;
}

const CONTENT_BLOCK_REGEX = /\{%\s*block\s+([A-Z_]+)\s*%\}([\s\S]*?)\{%\s*endblock\s*%\}/g;

export function extractContentBlockKeys(html: string): string[] {
  const matches = html.match(CONTENT_BLOCK_REGEX) || [];
  return [...new Set(matches.map((match: string) => match.replace(/\{%\s*block\s+|\s*%\}[\s\S]*$/g, "")))];
}

export function extractContentBlockDefaults(html: string): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const match of html.matchAll(CONTENT_BLOCK_REGEX)) {
    defaults[match[1]] = (match[2] ?? "").trim();
  }
  return defaults;
}

export function decodeBraceTokens(html: string): string {
  return html.replace(/%7B%7B/gi, "{{").replace(/%7D%7D/gi, "}}");
}

const EMAIL_BODY_CONTENT_WIDTH = RAMBLERS_EMAIL_TOKENS.maxWidth - 60;

export function constrainBodyImages(html: string): string {
  return html.replace(/<img\b([^>]*?)\s*\/?>/gi, (_match, rawAttrs: string) => {
    const styleMatch = rawAttrs.match(/style="([^"]*)"/i);
    const existingStyle = (styleMatch ? styleMatch[1] : "").replace(/;\s*$/, "");
    const sizedMatch = existingStyle.match(/width:\s*(\d+)px/i);
    const attrsWithoutWidth = rawAttrs.replace(/\swidth="[^"]*"/gi, "");
    if (sizedMatch) {
      const px = Math.min(parseInt(sizedMatch[1], 10), EMAIL_BODY_CONTENT_WIDTH);
      const style = `${existingStyle.replace(/width:\s*\d+px/i, `width:${px}px`)};max-width:100%;height:auto`;
      const withStyle = styleMatch ? attrsWithoutWidth.replace(/style="[^"]*"/i, `style="${style}"`) : `${attrsWithoutWidth} style="${style}"`;
      return `<img${withStyle} width="${px}">`;
    }
    const style = `${existingStyle ? `${existingStyle};` : ""}width:100%;max-width:${EMAIL_BODY_CONTENT_WIDTH}px;height:auto`;
    const withStyle = styleMatch ? attrsWithoutWidth.replace(/style="[^"]*"/i, `style="${style}"`) : `${attrsWithoutWidth} style="${style}"`;
    return `<img${withStyle} width="${EMAIL_BODY_CONTENT_WIDTH}">`;
  });
}

export function renderMarkdownPreservingTokens(markdown: string): string {
  return constrainBodyImages(decodeBraceTokens(renderMarkdownToHtml(markdown ?? "")));
}

export function applyContentBlocks(html: string, overrides?: TemplateOverrides): string {
  return html.replace(CONTENT_BLOCK_REGEX, (_full: string, key: string, defaultContent: string) => {
    const override = resolveTemplateOverride(overrides, key);
    if (override?.state === TemplateOverrideState.OMITTED) {
      return "";
    }
    if (override?.state === TemplateOverrideState.CUSTOM && override?.type === TemplateOverrideType.CONTENT) {
      return renderMarkdownPreservingTokens(override.content ?? "");
    }
    return defaultContent;
  });
}

function templateOverrideImageReplacement(override: TemplateOverride | undefined, label: string): string {
  if (override?.state === TemplateOverrideState.OMITTED) {
    return "";
  }
  if (override?.state === TemplateOverrideState.CUSTOM && override?.imageUrl) {
    return `<img src="${override.imageUrl}" alt="${label}" style="max-width:100%;height:auto;display:block">`;
  }
  return `<em style="color:#757575">[${label} — To Be Added By Your Webmaster]</em>`;
}

const DEV_IMAGE_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

export function normaliseOverrideImageHost(imageUrl: string | undefined, baseHref: string): string | undefined {
  if (!imageUrl || !baseHref) {
    return imageUrl;
  }
  const base = baseHref.replace(/\/+$/, "");
  if (DEV_IMAGE_ORIGIN.test(imageUrl)) {
    return imageUrl.replace(DEV_IMAGE_ORIGIN, base);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(imageUrl) || imageUrl.startsWith("//")) {
    return imageUrl;
  }
  return `${base}/${imageUrl.replace(/^\/+/, "")}`;
}

export function withNormalisedOverrideImageHosts(overrides: TemplateOverrides | undefined, baseHref: string): TemplateOverrides | undefined {
  if (!overrides || !baseHref) {
    return overrides;
  }
  return Object.fromEntries(toPairs(overrides).map(([key, override]) => {
    const imageUrl = (override as TemplateOverride)?.imageUrl;
    return imageUrl
      ? [key, {...override, imageUrl: normaliseOverrideImageHost(imageUrl, baseHref)}]
      : [key, override];
  })) as TemplateOverrides;
}

export function applyTemplateOverrides(html: string, overrides?: TemplateOverrides): string {
  const keys = extractOverrideKeys(html);
  if (keys.length === 0) {
    return html;
  }
  return keys.reduce((content, key) => {
    const marker = `{{override.${key}}}`;
    const replacement = templateOverrideImageReplacement(resolveTemplateOverride(overrides, key), overrideKeyToLabel(key));
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

const SAFE_TEMPLATE_EXPRESSION = /^[A-Za-z_]\w*(\s*\.\s*[A-Za-z_]\w*)*$/;

export function escapeUnknownTemplateExpressions(html: string): string {
  if (!html) {
    return html;
  }
  return html.replace(/\{\{([\s\S]*?)\}\}/g, (match, inner) =>
    SAFE_TEMPLATE_EXPRESSION.test((inner ?? "").trim())
      ? match
      : match.replace(/\{\{/g, "&#123;&#123;").replace(/\}\}/g, "&#125;&#125;"));
}

export function renderBrandedTemplate(rawHtml: string,
                                     params: any,
                                     templateOverrides?: TemplateOverrides,
                                     campaign: boolean = false): string {
  const overrides = withNormalisedOverrideImageHosts(templateOverrides, params?.systemMergeFields?.APP_URL);
  const withContentBlocks = applyContentBlocks(rawHtml ?? "", overrides);
  const sanitisedHtml = sanitiseBrevoTemplate(withContentBlocks);
  const overriddenHtml = applyTemplateOverrides(sanitisedHtml, overrides);
  const wrappedHtml = ramblersEmailLayout(overriddenHtml);
  const personalisedHtml = campaign ? toCampaignContactTokens(wrappedHtml) : wrappedHtml;
  const substitutedHtmlContent = substituteTemplateParameters(personalisedHtml, params);
  return escapeUnknownTemplateExpressions(inlineDefaultLinkStyles(applyBrevoConditionals(substitutedHtmlContent, params)));
}

function substituteTemplateParameters(html: string, params: any): string {
  const parametersAndValues: KeyValue<any>[] = extractParametersFrom(params, true);
  return [0, 1, 2].reduce(
    (content) => parametersAndValues.reduce(
      (templateContent, keyValue) => replaceAll(keyValue.key, keyValue.value, templateContent) as string,
      content
    ),
    html
  );
}

export function composeShellAndBody(bodyMarkdown: string): string {
  const bodyPlacesContent = /\{\{\s*params\.messageMergeFields\.BODY_CONTENT\s*\}\}/.test(bodyMarkdown ?? "");
  return [
    "<h3>{{params.messageMergeFields.subject}}</h3>",
    "{% if params.messageMergeFields.ADDRESS_LINE %}<p>{{params.messageMergeFields.ADDRESS_LINE}}</p>{% endif %}",
    bodyPlacesContent ? "" : "{{params.messageMergeFields.BODY_CONTENT_TOP}}",
    renderMarkdownPreservingTokens(bodyMarkdown),
    bodyPlacesContent ? "" : "{{params.messageMergeFields.BODY_CONTENT_BOTTOM}}"
  ].filter(section => section).join("\n");
}

export function renderLocalBrandedTemplate(templateName: string,
                                          params: any,
                                          templateOverrides?: TemplateOverrides): string {
  const localHtml = readLocalTemplate(templateName);
  if (!localHtml) {
    throw new Error(`Local Brevo template "${templateName}" not found`);
  }
  return renderBrandedTemplate(localHtml, params, templateOverrides);
}

export async function performTemplateSubstitution(emailRequest: SendSmtpEmailRequest | CreateCampaignRequest | TemplateRenderRequest,
                                                  sendSmtpEmail: Brevo.SendTransacEmailRequest | Brevo.CreateEmailCampaignRequest,
                                                  debugLog: debug.Debugger,
                                                  campaign: boolean = false): Promise<Brevo.SendTransacEmailRequest | Brevo.CreateEmailCampaignRequest> {
  const priorDebugValue = debugLog.enabled;
  debugLog.enabled = false;
  try {
    const isUnbranded = emailRequest.brandingMode === BrandingMode.UNBRANDED;
    const localTemplateHtml = !isUnbranded && emailRequest.templateName
      ? readLocalTemplate(emailRequest.templateName)
      : null;
    if (isUnbranded) {
      debugLog("performing unbranded template substitution");
      const wrappedHtml = unbrandedEmailLayout(emailRequest.htmlContent ?? "");
      const substitutedHtmlContent = substituteTemplateParameters(wrappedHtml, emailRequest.params);
      sendSmtpEmail.htmlContent = inlineDefaultLinkStyles(applyBrevoConditionals(substitutedHtmlContent, emailRequest.params));
    } else if (emailRequest.body) {
      debugLog("performing template substitution from editable body");
      sendSmtpEmail.htmlContent = renderBrandedTemplate(composeShellAndBody(emailRequest.body), emailRequest.params, emailRequest.templateOverrides, campaign);
    } else if (localTemplateHtml) {
      debugLog("performing template substitution from local template", emailRequest.templateName);
      sendSmtpEmail.htmlContent = renderBrandedTemplate(localTemplateHtml, emailRequest.params, emailRequest.templateOverrides, campaign);
    } else {
      debugLog(`Using supplied htmlContent`, emailRequest.htmlContent);
      sendSmtpEmail.htmlContent = emailRequest.htmlContent;
    }
    if (isString(sendSmtpEmail.htmlContent)) {
      sendSmtpEmail.htmlContent = escapeUnknownTemplateExpressions(sendSmtpEmail.htmlContent);
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
    success: expectedHttpResponseCodes.includes(response.rawResponse.status),
    status: response.rawResponse.status,
    message: response.rawResponse.statusText ?? "",
    responseBody: response.data
  };
}

export function mapStatusMappedResponseMultipleInputs(ids: any[], response: BrevoResponse, ...expectedHttpResponseCodes: number[]): StatusMappedResponseMultipleInputs {
  return {
    ids,
    success: expectedHttpResponseCodes.includes(response.rawResponse.status),
    status: response.rawResponse.status,
    message: response.rawResponse.statusText ?? "",
    responseBody: response.data
  };
}

export function successfulResponse(successfulResponse: SuccessfulResponse) {
  successfulResponse.debugLog("successfulResponse:", JSON.stringify(successfulResponse.response));
  successfulResponse.res.status(successfulResponse.status || 200).json({
    request: {messageType: successfulResponse.messageType},
    response: successfulResponse.response
  });
}

function summariseRequestBody(body: unknown): unknown {
  if (!isObject(body)) {
    return body;
  }
  const heavyKeys = ["htmlContent", "html", "templateContent", "attachment"];
  const record = body as Record<string, any>;
  const trimmed = keys(record).reduce((accumulator, key) => {
    const value = record[key];
    accumulator[key] = heavyKeys.includes(key) && isString(value) ? `[omitted ${value.length} chars]` : value;
    return accumulator;
  }, {} as Record<string, any>);
  const serialised = JSON.stringify(trimmed);
  return serialised.length > 8000 ? `${serialised.slice(0, 8000)}…[truncated]` : trimmed;
}

export function handleError(req: Request, res: Response, messageType: string, _debugLog: any, error: unknown) {
  const brevoError = error instanceof BrevoError ? error : null;
  logBrevoError(messageType, error, {request: {method: req?.method, url: req?.originalUrl, body: summariseRequestBody(req?.body)}});
  if (brevoError) {
    res.status(brevoError.statusCode ?? 500).json({request: {messageType}, error: brevoError.body});
  } else {
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

export function handleErrorAllowingNotFound(req: Request, res: Response, messageType: string, debugLog: debug.Debugger, error: unknown) {
  const brevoError = error instanceof BrevoError ? error : null;
  if (brevoError?.statusCode === 404) {
    debugLog("%s: no Brevo contact for %s", messageType, req?.originalUrl);
    res.status(404).json({request: {messageType}, error: brevoError.body});
    return;
  }
  handleError(req, res, messageType, debugLog, error);
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
  data?: unknown;
  rawResponse: { status: number; statusText?: string; headers?: Headers };
}
