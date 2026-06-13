import debug from "debug";
import { NextFunction, Request, Response } from "express";
import { handleError, successfulResponse } from "../common/messages";
import { envConfig } from "../../env-config/env-config";
import { brevoClient } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
const messageType = "brevo:folders";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

export async function folders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await brevoClient();
    const response = await scheduleBrevo(() => client.contacts.getFolders({limit: 10, offset: 0}));
    const foldersListResponse = {
      folders: response.folders ?? [],
      count: response.count ?? 0
    };
    successfulResponse({req, res, response: foldersListResponse, messageType, debugLog});
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
