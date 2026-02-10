import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { authenticateSendingDomain } from "./domain-authentication";

const messageType = "brevo:domains:authenticate";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function authenticateDomainRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const domainName = req.params.domainName;
    const result = await authenticateSendingDomain(domainName);
    successfulResponse({req, res, response: result, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
