import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { Account } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { withRamblersRegisteredOffice } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-legal.model";

const messageType = "brevo:account";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

export async function fetchBrevoAccount(): Promise<Account> {
  const client = await brevoClient();
  const account: Account = await scheduleBrevo(() => client.account.getAccount());
  const synced = withRamblersRegisteredOffice(account);
  if (account?.address?.street !== synced.address?.street
    || account?.address?.zipCode !== synced.address?.zipCode
    || account?.address?.city !== synced.address?.city) {
    debugLog("replacing Brevo account address with registered office", {from: account?.address, to: synced.address});
  }
  return synced;
}

export async function queryAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const account = await fetchBrevoAccount();
    successfulResponse({req, res, response: account, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
