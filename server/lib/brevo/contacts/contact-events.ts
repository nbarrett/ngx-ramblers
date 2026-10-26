import debug from "debug";
import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import {
  BrevoEmailEvent,
  BrevoEmailEventReport,
  BrevoEventType,
  BrevoTransactionalEmailSummary
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { mergeTransactionalSendsIntoEvents } from "../../../../projects/ngx-ramblers/src/app/functions/brevo-contact-activity";
import { scheduleBrevo } from "../common/rate-limiting";
import { clampDateRange } from "../common/date-range";
import { dateTimeNow } from "../../shared/dates";
import { Brevo, BrevoClient } from "@getbrevo/brevo";
import { normaliseEmail } from "../../../../projects/ngx-ramblers/src/app/functions/strings";
import { SortDirection } from "../../../../projects/ngx-ramblers/src/app/models/sort.model";

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

async function loadTransactionalSends(
  client: BrevoClient,
  email: string,
  startDate: string | undefined,
  endDate: string | undefined,
  sort: SortDirection
): Promise<BrevoTransactionalEmailSummary[]> {
  try {
    const sends = await scheduleBrevo(() => client.transactionalEmails.getTransacEmailsList({
      email,
      startDate,
      endDate,
      sort,
      limit: MAX_LIMIT,
      offset: 0
    }));
    return (sends.transactionalEmails ?? []) as BrevoTransactionalEmailSummary[];
  } catch (sendError) {
    debugLog("getTransacEmailsList failed", email, sendError);
    return [];
  }
}

function activityDateRange(rawStartDate: string | undefined, rawEndDate: string | undefined, days: number): { startDate: string | undefined; endDate: string | undefined } {
  const nowUtc = dateTimeNow().toUTC();
  const todayUtc = nowUtc.toISODate() ?? undefined;
  const fromDays = nowUtc.minus({days: days - 1}).toISODate() ?? undefined;
  return clampDateRange(rawStartDate ?? fromDays, rawEndDate ?? todayUtc);
}

export async function contactEvents(req: Request, res: Response): Promise<void> {
  try {
    const identifier = String(req.params.identifier || "").trim();
    if (!identifier) {
      res.status(400).json({ error: "identifier is required" });
      return;
    }
    const email = identifier.includes("@") ? (normaliseEmail(identifier) || identifier) : identifier;
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const offset = parsePositiveInt(req.query.offset, 0) || 0;
    const rawStartDate = isString(req.query.startDate) ? req.query.startDate : undefined;
    const rawEndDate = isString(req.query.endDate) ? req.query.endDate : undefined;
    const days = parsePositiveInt(req.query.days, DEFAULT_DAYS, 90);
    const { startDate, endDate } = activityDateRange(rawStartDate, rawEndDate, days);
    const sort = req.query.sort === SortDirection.ASC ? SortDirection.ASC : SortDirection.DESC;
    const event = isString(req.query.event) ? req.query.event as Brevo.GetEmailEventReportRequest["event"] : undefined;
    const client = await brevoClient();
    const data = await scheduleBrevo(() => client.transactionalEmails.getEmailEventReport({
      limit,
      offset,
      startDate,
      endDate,
      email,
      event,
      sort
    }));
    const statsEvents: BrevoEmailEvent[] = data.events ?? [];
    const sendRows = offset === 0 && email.includes("@") && (!event || event === BrevoEventType.REQUESTS)
      ? await loadTransactionalSends(client, email, startDate, endDate, sort)
      : [];
    const body: BrevoEmailEventReport = {
      events: mergeTransactionalSendsIntoEvents(statsEvents, sendRows, sort),
      nextOffset: offset + statsEvents.length,
      hasMore: statsEvents.length === limit
    };
    successfulResponse({ req, res, response: body, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
