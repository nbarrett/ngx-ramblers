import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import {
  OptionalRequestOptions,
  ListCreateRequest
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const messageType = "brevo:lists";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function lists(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await brevoClient();
    const listCreateRequest: ListCreateRequest = req.body;
    debugLog("received listCreateRequest:", listCreateRequest);
    const opts: OptionalRequestOptions = {limit: 10, offset: 0};
    const response = await scheduleBrevo(() => client.contacts.getLists({limit: opts.limit, offset: opts.offset, sort: opts.sort}));
    const listsResponse = {
      lists: response.lists ?? [],
      count: response.count ?? 0
    };
    debugLog("returning listsResponse:", listsResponse);
    successfulResponse({req, res, response: listsResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
