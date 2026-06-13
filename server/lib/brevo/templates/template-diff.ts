import { keys } from "es-toolkit/compat";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { extractContentBlockDefaults, extractContentBlockKeys, handleError, successfulResponse } from "../common/messages";
import { contentBlockHtmlToMarkdown } from "../common/content-block-markdown";
import { readLocalTemplate } from "./local-template-reader";
import { BOOKING_EMAIL_BLOCK_KEYS, DEFAULT_BOOKING_EMAIL_BLOCKS } from "../transactional-mail/booking-template-resolver";
import { BookingEmailType } from "../../../../projects/ngx-ramblers/src/app/models/booking-config.model";
import {
  extractOverrideKeys,
  TemplateDiffRequest,
  TemplateDiffResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:template-diff";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function templateDiff(req: Request, res: Response, _next: NextFunction): Promise<void> {
  try {
    const request: TemplateDiffRequest = req.body;
    debugLog("received template introspection request:", request);
    const localContent = readLocalTemplate(request.templateName);
    const contentBlockDefaults: Record<string, string> = {};
    if (localContent) {
      const templateBlockHtml = extractContentBlockDefaults(localContent);
      keys(templateBlockHtml).forEach(key => {
        contentBlockDefaults[key] = contentBlockHtmlToMarkdown(templateBlockHtml[key]);
      });
    }
    if (request.includeBookingBlocks) {
      (keys(BOOKING_EMAIL_BLOCK_KEYS) as BookingEmailType[]).forEach(emailType => {
        contentBlockDefaults[BOOKING_EMAIL_BLOCK_KEYS[emailType]] = DEFAULT_BOOKING_EMAIL_BLOCKS[emailType].trim();
      });
    }
    const response: TemplateDiffResponse = {
      templateName: request.templateName,
      hasLocalTemplate: !!localContent,
      overrideKeys: localContent ? extractOverrideKeys(localContent) : [],
      contentBlockKeys: localContent ? extractContentBlockKeys(localContent) : [],
      contentBlockDefaults
    };
    debugLog("template introspection result:", response);
    successfulResponse({req, res, response, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
