import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { listDomains } from "./domain-management";

const messageType = "brevo:domains:list";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function domainsList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const domains = await listDomains();
    successfulResponse({req, res, response: domains, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
