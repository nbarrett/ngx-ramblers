import debug from "debug";
import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
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
    const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
    const offset = parsePositiveInt(req.query.offset, 0) || 0;
    const templateId = req.query.templateId ? parsePositiveInt(req.query.templateId, 0) : undefined;
    const messageId = isString(req.query.messageId) ? req.query.messageId : undefined;
    const startDate = isString(req.query.startDate) ? req.query.startDate : undefined;
    const endDate = isString(req.query.endDate) ? req.query.endDate : undefined;
    const client = await brevoClient();
    const response = await scheduleBrevo(() => client.transactionalEmails.getTransacEmailsList({
      email: email || undefined,
      templateId,
      messageId,
      startDate,
      endDate,
      sort: req.query.sort === "asc" ? "asc" : "desc",
      limit,
      offset
    }));
    const body: BrevoTransactionalEmailListResponse = {
      count: response.count ?? 0,
      transactionalEmails: response.transactionalEmails ?? []
    };
    successfulResponse({ req, res, response: body, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
