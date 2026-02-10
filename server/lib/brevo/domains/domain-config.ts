import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { domainConfiguration } from "./domain-management";

const messageType = "brevo:domains:config";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function domainConfigRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const domainName = req.params.domainName;
    const config = await domainConfiguration(domainName);
    successfulResponse({req, res, response: config, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
