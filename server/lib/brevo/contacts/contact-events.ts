import debug from "debug";
import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { BrevoEmailEventReport } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { scheduleBrevo } from "../common/rate-limiting";
import { Brevo } from "@getbrevo/brevo";

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
    const event = isString(req.query.event) ? req.query.event as Brevo.GetEmailEventReportRequest["event"] : undefined;
    const client = await brevoClient();
    const data = await scheduleBrevo(() => client.transactionalEmails.getEmailEventReport({
      limit,
      offset,
      startDate,
      endDate,
      days,
      email: identifier,
      event,
      sort
    }));
    const body: BrevoEmailEventReport = { events: data.events ?? [] };
    successfulResponse({ req, res, response: body, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
