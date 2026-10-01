import { Request, Response } from "express";
import debug from "debug";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { isArray, isString } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { errorResponse } from "../shared/error-response";
import { InboxThreadIdsRequest, InboxThreadRemapRequest, InboxThreadRemapResponse, InboxThreadUpdateResult, OrphanedInboxThreadsResponse } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { requireInboxConfigurationAdministrator } from "./inbox-access";
import { derivedAliases } from "./inbox-aliases";
import { folderlessThreadIds, orphanedInboxThreads, remapCandidatesFrom, remapInboxThreads, restoreThreadsToInbox } from "./inbox-orphaned-threads";
const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);
export async function listOrphanedThreads(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const [orphanedThreads, aliases, folderless] = await Promise.all([orphanedInboxThreads(), derivedAliases(), folderlessThreadIds()]);
      const affectedRoleTypes = [...new Set(orphanedThreads.map(orphaned => orphaned.thread.roleType))];
      const response: OrphanedInboxThreadsResponse = {
        orphanedThreads,
        totalCount: orphanedThreads.length,
        affectedRoleTypes,
        remapCandidates: remapCandidatesFrom(aliases),
        folderlessThreadIds: folderless
      };
      res.json({ request: { messageType }, response });
    }
  }
  catch (error) {
    errorDebugLog("Error detecting orphaned inbox threads:", (error as Error).message);
    res.status(500).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function remapOrphanedThreads(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const request = req.body as InboxThreadRemapRequest;
      if (!isArray(request?.threadIds) || request.threadIds.length === 0 || !isString(request?.targetRoleType)) {
        res.status(400).json({ request: { messageType }, error: "threadIds and a targetRoleType are required" });
      }
      else {
        const response: InboxThreadRemapResponse = await remapInboxThreads(request.threadIds, request.targetRoleType);
        res.json({ request: { messageType }, response });
      }
    }
  }
  catch (error) {
    errorDebugLog("Error remapping inbox threads:", (error as Error).message);
    res.status(400).json({ request: { messageType }, error: errorResponse(error) });
  }
}
export async function restoreOrphanedThreads(req: Request, res: Response): Promise<void> {
  try {
    if (requireInboxConfigurationAdministrator(req, res)) {
      const request = req.body as InboxThreadIdsRequest;
      if (!isArray(request?.threadIds) || request.threadIds.length === 0) {
        res.status(400).json({ request: { messageType }, error: "threadIds are required" });
      }
      else {
        const response: InboxThreadUpdateResult = await restoreThreadsToInbox(request.threadIds);
        res.json({ request: { messageType }, response });
      }
    }
  }
  catch (error) {
    errorDebugLog("Error restoring inbox threads to the inbox folder:", (error as Error).message);
    res.status(400).json({ request: { messageType }, error: errorResponse(error) });
  }
}
