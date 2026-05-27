import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { Request, Response } from "express";
import http from "http";
import { isString } from "es-toolkit/compat";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { BrevoTransactionalEmailListResponse } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:transactional-emails-list";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parsePositiveInt(value: any, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

export async function transactionalEmailsList(req: Request, res: Response): Promise<void> {
  try {
    const email = isString(req.query.email) ? req.query.email.trim() : "";
    if (!email) {
      res.status(400).json({ error: "email query parameter is required" });
      return;
    }
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const offset = parsePositiveInt(req.query.offset, 0) || 0;
    const templateId = req.query.templateId ? parsePositiveInt(req.query.templateId, 0) : undefined;
    const messageId = isString(req.query.messageId) ? req.query.messageId : undefined;
    const startDate = isString(req.query.startDate) ? req.query.startDate : undefined;
    const endDate = isString(req.query.endDate) ? req.query.endDate : undefined;
    const sort = req.query.sort === "asc" ? "asc" : "desc";
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
    const response: { response: http.IncomingMessage, body: any } = await scheduleBrevo(() => apiInstance.getTransacEmailsList(
      email,
      templateId,
      messageId,
      startDate,
      endDate,
      sort,
      limit,
      offset
    ));
    const body: BrevoTransactionalEmailListResponse = {
      count: response.body?.count ?? 0,
      transactionalEmails: response.body?.transactionalEmails || []
    };
    successfulResponse({ req, res, response: body, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
