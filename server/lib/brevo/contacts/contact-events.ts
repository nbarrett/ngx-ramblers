import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { Request, Response } from "express";
import http from "http";
import { isString } from "es-toolkit/compat";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { BrevoEmailEventReport } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:contact-events";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_DAYS = 90;

function parsePositiveInt(value: any, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

export async function contactEvents(req: Request, res: Response): Promise<void> {
  try {
    const identifier = String(req.params.identifier || "").trim();
    if (!identifier) {
      res.status(400).json({ error: "identifier is required" });
      return;
    }
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const offset = parsePositiveInt(req.query.offset, 0) || 0;
    const days = req.query.startDate || req.query.endDate ? undefined : parsePositiveInt(req.query.days, DEFAULT_DAYS, 90);
    const startDate = isString(req.query.startDate) ? req.query.startDate : undefined;
    const endDate = isString(req.query.endDate) ? req.query.endDate : undefined;
    const sort = req.query.sort === "asc" ? "asc" : "desc";
    const event = isString(req.query.event) ? req.query.event as any : undefined;
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);
    const response: { response: http.IncomingMessage, body: any } = await apiInstance.getEmailEventReport(
      limit,
      offset,
      startDate,
      endDate,
      days,
      identifier,
      event,
      undefined,
      undefined,
      undefined,
      sort
    );
    const body: BrevoEmailEventReport = { events: response.body?.events || [] };
    successfulResponse({ req, res, response: body, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
