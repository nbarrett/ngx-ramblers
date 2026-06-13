import debug from "debug";
import { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import { handleErrorAllowingNotFound, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";

const messageType = "brevo:contact-campaign-stats";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function contactCampaignStats(req: Request, res: Response): Promise<void> {
  try {
    const identifier = String(req.params.identifier || "").trim();
    if (!identifier) {
      res.status(400).json({ error: "identifier is required" });
      return;
    }
    const startDate = isString(req.query.startDate) ? req.query.startDate : undefined;
    const endDate = isString(req.query.endDate) ? req.query.endDate : undefined;
    const client = await brevoClient();
    const response = await scheduleBrevo(() => client.contacts.getContactStats({identifier, startDate, endDate}));
    successfulResponse({ req, res, response, messageType, debugLog });
  } catch (error) {
    handleErrorAllowingNotFound(req, res, messageType, debugLog, error);
  }
}
