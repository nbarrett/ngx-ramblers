import debug from "debug";
import { Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";

const messageType = "brevo:transactional-email-content";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function transactionalEmailContent(req: Request, res: Response): Promise<void> {
  try {
    const uuid = String(req.params.uuid || "").trim();
    if (!uuid) {
      res.status(400).json({ error: "uuid is required" });
      return;
    }
    const client = await brevoClient();
    const response = await scheduleBrevo(() => client.transactionalEmails.getTransacEmailContent({uuid}));
    successfulResponse({ req, res, response, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
