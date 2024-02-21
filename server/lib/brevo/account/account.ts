import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { AccountResponse } from "../../../../projects/ngx-ramblers/src/app/models/brevo.model";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { Account } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:account";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function queryAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const brevoConfig = await configuredBrevo();
    const apiInstance = new SibApiV3Sdk.AccountApi();
    apiInstance.setApiKey(SibApiV3Sdk.AccountApiApiKeys.apiKey, brevoConfig.apiKey);
    const accountResponse: AccountResponse = await apiInstance.getAccount();
    const account: Account = accountResponse.body;
    successfulResponse(req, res, account, messageType, debugLog);
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
