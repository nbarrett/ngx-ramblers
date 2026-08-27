import { Request, Response } from "express";
import debug from "debug";
import { isArray, isString } from "es-toolkit/compat";
import { InboxThread, InboxThreadFolder, InboxThreadIdsRequest, InboxThreadUpdateResult } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { envConfig } from "../env-config/env-config";
import { errorResponse } from "../shared/error-response";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import { defaultTenantSlug } from "./inbox-aliases";
import { permittedInboxRoleTypes } from "./inbox-access";
import { permanentlyDeleteThreads } from "./inbox-deleted";

const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace(messageType));
const errorDebugLog = createErrorDebugLog(messageType);

export async function permanentlyDeleteSelectedThreads(req: Request, res: Response): Promise<void> {
  try {
    const request = req.body as InboxThreadIdsRequest;
    const validIds = isArray(request?.threadIds) && request.threadIds.length > 0 && request.threadIds.every(isString);
    if (!validIds) {
      res.status(400).json({request: {messageType}, error: "threadIds are required"});
    } else {
      const threadIds = [...new Set(request.threadIds)];
      const tenantSlug = defaultTenantSlug();
      const threads = await inboxThreadModel.find({_id: {$in: threadIds}, tenantSlug}).lean() as InboxThread[];
      const permittedRoleTypes = await permittedInboxRoleTypes(req);
      const allFound = threads.length === threadIds.length;
      const allAccessible = threads.every(thread => permittedRoleTypes.includes(thread.roleType));
      const allDeleted = threads.every(thread => thread.folder === InboxThreadFolder.DELETED);
      if (!allFound) {
        res.status(404).json({request: {messageType}, error: "One or more conversations were not found"});
      } else if (!allAccessible) {
        res.status(403).json({request: {messageType}, error: "You do not have access to one or more conversations"});
      } else if (!allDeleted) {
        res.status(400).json({request: {messageType}, error: "Only conversations in Deleted can be permanently deleted in bulk"});
      } else {
        const response: InboxThreadUpdateResult = await permanentlyDeleteThreads(threadIds, tenantSlug);
        debugLog(`permanently deleted ${response.modified} of ${response.matched} selected threads`);
        res.json({request: {messageType}, response});
      }
    }
  } catch (error) {
    errorDebugLog("Error permanently deleting selected inbox threads:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}
