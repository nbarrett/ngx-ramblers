import * as SibApiV3Sdk from "@getbrevo/brevo";
import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { AccountResponse } from "../../../../projects/ngx-ramblers/src/app/models/brevo.model";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { Account, AccountMergeFields } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:account";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

export async function fetchBrevoAccount(): Promise<Account> {
  const brevoConfig = await configuredBrevo();
  const apiInstance = new SibApiV3Sdk.AccountApi();
  apiInstance.setApiKey(SibApiV3Sdk.AccountApiApiKeys.apiKey, brevoConfig.apiKey);
  const accountResponse: AccountResponse = await apiInstance.getAccount();
  return accountResponse.body;
}

export async function accountMergeFieldsFor(): Promise<AccountMergeFields> {
  try {
    const account = await fetchBrevoAccount();
    return {
      STREET: account?.address?.street ?? "",
      POSTCODE: account?.address?.zipCode ?? "",
      TOWN: account?.address?.city ?? ""
    };
  } catch (error) {
    debugLog("accountMergeFieldsFor failed, returning empty fields:", error);
    return { STREET: "", POSTCODE: "", TOWN: "" };
  }
}

export async function queryAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const account = await fetchBrevoAccount();
    successfulResponse({req, res, response: account, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
