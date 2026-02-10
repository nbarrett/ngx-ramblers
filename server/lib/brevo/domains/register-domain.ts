import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { findDomainByName, registerDomain as registerDomainApi, domainConfiguration } from "./domain-management";

const messageType = "brevo:domains:register";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function registerDomainRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({request: {messageType}, error: "Domain name is required"});
      return;
    }

    const existing = await findDomainByName(name);
    if (existing) {
      const config = await domainConfiguration(name);
      successfulResponse({req, res, response: {id: existing.id, domainName: name, alreadyRegistered: true, dnsRecords: config.dnsRecords}, messageType, debugLog});
      return;
    }

    const result = await registerDomainApi(name);
    successfulResponse({req, res, response: result, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
