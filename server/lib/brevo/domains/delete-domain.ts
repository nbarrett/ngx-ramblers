import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { deleteDomain as deleteDomainApi } from "./domain-management";

const messageType = "brevo:domains:delete";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function deleteDomainRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const domainName = req.params.domainName;
    await deleteDomainApi(domainName);
    successfulResponse({req, res, response: {deleted: true, domainName}, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
