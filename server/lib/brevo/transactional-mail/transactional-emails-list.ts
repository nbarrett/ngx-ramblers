import debug from "debug";
import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { Brevo } from "@getbrevo/brevo";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { clampDateRange } from "../common/date-range";
import {
  BrevoTransactionalEmailListResponse,
  BrevoTransactionalEmailSummary
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { enrichTransactionalEmailOrigins } from "./enrich-transactional-origins";

const messageType = "brevo:transactional-emails-list";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DEFAULT_EVENT_DAYS = 30;

function parsePositiveInt(value: any, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

function hasIdentityFilter(email: string, templateId: number | undefined, messageId: string | undefined): boolean {
  return Boolean(email || templateId || messageId);
}

function mapEventToSummary(event: Brevo.GetEmailEventReportResponse.Events.Item): BrevoTransactionalEmailSummary {
  return {
    email: event.email ?? "",
    subject: event.subject ?? "",
    templateId: event.templateId,
    messageId: event.messageId ?? "",
    uuid: "",
    date: event.date ?? "",
    from: event.from
  };
}

export async function transactionalEmailsList(req: Request, res: Response): Promise<void> {
  try {
    const email = isString(req.query.email) ? req.query.email.trim() : "";
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const offset = parsePositiveInt(req.query.offset, 0) || 0;
    const templateId = req.query.templateId ? parsePositiveInt(req.query.templateId, 0) : undefined;
    const messageId = isString(req.query.messageId) ? req.query.messageId : undefined;
    const rawStartDate = isString(req.query.startDate) ? req.query.startDate : undefined;
    const rawEndDate = isString(req.query.endDate) ? req.query.endDate : undefined;
    const sort = req.query.sort === "asc" ? "asc" : "desc";
    const client = await brevoClient();
    if (hasIdentityFilter(email, templateId, messageId)) {
      const response = await scheduleBrevo(() => client.transactionalEmails.getTransacEmailsList({
        email: email || undefined,
        templateId,
        messageId,
        startDate: rawStartDate,
        endDate: rawEndDate,
        sort,
        limit,
        offset
      }));
      const transactionalEmails = await enrichTransactionalEmailOrigins(
        (response.transactionalEmails ?? []) as BrevoTransactionalEmailSummary[]
      );
      const body: BrevoTransactionalEmailListResponse = {
        count: response.count ?? transactionalEmails.length,
        transactionalEmails
      };
      successfulResponse({ req, res, response: body, messageType, debugLog });
    } else {
      const { startDate, endDate } = clampDateRange(rawStartDate, rawEndDate);
      const days = startDate || endDate ? undefined : DEFAULT_EVENT_DAYS;
      const event = isString(req.query.event)
        ? req.query.event as Brevo.GetEmailEventReportRequest["event"]
        : "requests";
      const response = await scheduleBrevo(() => client.transactionalEmails.getEmailEventReport({
        limit,
        offset,
        startDate,
        endDate,
        days,
        event,
        sort
      }));
      const transactionalEmails = await enrichTransactionalEmailOrigins(
        (response.events ?? []).map(mapEventToSummary)
      );
      const body: BrevoTransactionalEmailListResponse = {
        count: transactionalEmails.length,
        transactionalEmails
      };
      successfulResponse({ req, res, response: body, messageType, debugLog });
    }
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
