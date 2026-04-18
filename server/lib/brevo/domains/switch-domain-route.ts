import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { switchBrevoSendingDomain } from "./domain-switch";

const messageType = "brevo:domains:switch";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function switchDomainRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { newHostname, oldHostname, rewriteSenders } = req.body || {};
    if (!newHostname) {
      res.status(400).json({ error: "newHostname is required" });
      return;
    }
    const result = await switchBrevoSendingDomain({
      newHostname,
      oldHostname,
      rewriteSenders: rewriteSenders !== false
    });
    successfulResponse({req, res, response: result, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
