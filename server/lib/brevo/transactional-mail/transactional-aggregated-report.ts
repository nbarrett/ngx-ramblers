import debug from "debug";
import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { Brevo } from "@getbrevo/brevo";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { clampDateRange } from "../common/date-range";
import { BrevoTransactionalAggregatedReport } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:transactional-aggregated-report";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export function transactionalReport(response: Brevo.GetAggregatedSmtpReportResponse): BrevoTransactionalAggregatedReport {
  const hardBouncesCount = response.hardBounces ?? 0;
  const softBouncesCount = response.softBounces ?? 0;
  return {
    sentCount: response.requests ?? 0,
    deliveredCount: response.delivered ?? 0,
    openedCount: response.opens ?? 0,
    clickedCount: response.clicks ?? 0,
    bouncedCount: hardBouncesCount + softBouncesCount,
    unsubscribedCount: response.unsubscribed ?? 0,
    complaintsCount: response.spamReports ?? 0,
    hardBouncesCount,
    softBouncesCount,
    spamReportCount: response.spamReports ?? 0,
    blockedCount: response.blocked ?? 0
  };
}

export async function transactionalAggregatedReport(req: Request, res: Response): Promise<void> {
  try {
    const rawStartDate = isString(req.query.startDate) ? req.query.startDate : undefined;
    const rawEndDate = isString(req.query.endDate) ? req.query.endDate : undefined;
    const days = rawStartDate || rawEndDate ? undefined : 30;
    const { startDate, endDate } = clampDateRange(rawStartDate, rawEndDate);
    const client = await brevoClient();
    const result = await scheduleBrevo(() => client.transactionalEmails.getAggregatedSmtpReport({
      startDate,
      endDate,
      days
    }));
    successfulResponse({ req, res, response: transactionalReport(result), messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
