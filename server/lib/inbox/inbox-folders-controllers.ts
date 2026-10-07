import { Request, Response } from "express";
import debug from "debug";
import { isString, values } from "es-toolkit/compat";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { envConfig } from "../env-config/env-config";
import { errorResponse } from "../shared/error-response";
import { inboxFolder as inboxFolderModel } from "../mongo/models/inbox-folder";
import { inboxThread as inboxThreadModel } from "../mongo/models/inbox-thread";
import {
  foldersExcludedFromInboxList,
  InboxFolderDeleteContents,
  InboxThreadMoveRequest,
  InboxUserFolder,
  InboxUserFoldersResponse,
  InboxUserFolderView
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { inboxFolderSlug, uniqueInboxFolderSlug } from "../../../projects/ngx-ramblers/src/app/functions/inbox-thread";
import { permittedInboxRoleTypes, requestingMemberId } from "./inbox-access";
import { defaultTenantSlug } from "./inbox-aliases";
import { conversationCount, unreadConditionForMember } from "./inbox-unread-counts";
import { moveUserFolderThreadsToDeleted } from "./inbox-deleted";

const messageType = "inbox";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = createErrorDebugLog(messageType);

function folderId(folder: InboxUserFolder): string {
  return folder.id || String((folder as unknown as {_id?: {toString(): string}})._id || "");
}

function trimmedFolderName(value: unknown): string {
  return isString(value) ? value.trim() : "";
}

function folderView(folder: InboxUserFolder, unreadCount: number): InboxUserFolderView {
  return {
    id: folderId(folder),
    name: folder.name,
    slug: folder.slug || inboxFolderSlug(folder.name),
    sortIndex: folder.sortIndex,
    unreadCount
  };
}

async function uniqueFolderSlugForTenant(tenantSlug: string, name: string, excludeId?: string): Promise<string> {
  const folders = await inboxFolderModel.find({tenantSlug}).select("slug name").lean() as InboxUserFolder[];
  const taken = folders
    .filter(folder => folderId(folder) !== excludeId)
    .map(folder => folder.slug || inboxFolderSlug(folder.name));
  return uniqueInboxFolderSlug(inboxFolderSlug(name), taken);
}

export async function listInboxFolders(req: Request, res: Response): Promise<void> {
  try {
    const allowedRoleTypes = await permittedInboxRoleTypes(req);
    const folders = await inboxFolderModel.find({tenantSlug: defaultTenantSlug()}).sort({sortIndex: 1, name: 1}).lean() as InboxUserFolder[];
    const memberId = requestingMemberId(req);
    const views = await Promise.all(folders.map(async folder => {
      const unreadCount = allowedRoleTypes.length === 0
        ? 0
        : await conversationCount({
          tenantSlug: defaultTenantSlug(),
          roleType: {$in: allowedRoleTypes},
          folder: {$nin: foldersExcludedFromInboxList()},
          userFolderId: folderId(folder),
          ...unreadConditionForMember(memberId)
        });
      return folderView(folder, unreadCount);
    }));
    const response: InboxUserFoldersResponse = {folders: views};
    res.json({request: {messageType}, response});
  } catch (error) {
    errorDebugLog("Error listing inbox folders:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

export async function createInboxFolder(req: Request, res: Response): Promise<void> {
  try {
    const name = trimmedFolderName(req.body?.name);
    if (!name) {
      res.status(400).json({request: {messageType}, error: "A folder name is required"});
    } else {
      const tenantSlug = defaultTenantSlug();
      const highest = await inboxFolderModel.findOne({tenantSlug}).sort({sortIndex: -1}).select("sortIndex").lean() as {sortIndex?: number} | null;
      const slug = await uniqueFolderSlugForTenant(tenantSlug, name);
      const created = await inboxFolderModel.create({
        tenantSlug,
        name,
        slug,
        sortIndex: (highest?.sortIndex ?? -1) + 1,
        createdByMemberId: requestingMemberId(req)
      });
      res.json({request: {messageType}, response: folderView(created, 0)});
    }
  } catch (error) {
    errorDebugLog("Error creating inbox folder:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

export async function renameInboxFolder(req: Request, res: Response): Promise<void> {
  try {
    const name = trimmedFolderName(req.body?.name);
    if (!name) {
      res.status(400).json({request: {messageType}, error: "A folder name is required"});
    } else {
      const tenantSlug = defaultTenantSlug();
      const slug = await uniqueFolderSlugForTenant(tenantSlug, name, req.params.id);
      const updated = await inboxFolderModel.findOneAndUpdate(
        {_id: req.params.id, tenantSlug},
        {$set: {name, slug}},
        {new: true}
      ).lean() as InboxUserFolder | null;
      if (!updated) {
        res.status(404).json({request: {messageType}, error: "Folder not found"});
      } else {
        res.json({request: {messageType}, response: folderView(updated, 0)});
      }
    }
  } catch (error) {
    errorDebugLog("Error renaming inbox folder:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

export async function deleteInboxFolder(req: Request, res: Response): Promise<void> {
  try {
    const contents = isString(req.query.contents) ? req.query.contents : "";
    if (!values(InboxFolderDeleteContents).includes(contents as InboxFolderDeleteContents)) {
      res.status(400).json({request: {messageType}, error: "Choose whether mail stays in Inbox or moves to Deleted"});
    } else {
      const tenantSlug = defaultTenantSlug();
      const existing = await inboxFolderModel.findOne({_id: req.params.id, tenantSlug}).lean() as InboxUserFolder | null;
      if (!existing) {
        res.status(404).json({request: {messageType}, error: "Folder not found"});
      } else {
        if (contents === InboxFolderDeleteContents.DELETED) {
          await moveUserFolderThreadsToDeleted(req.params.id, tenantSlug);
        } else {
          await inboxThreadModel.updateMany(
            {tenantSlug, userFolderId: req.params.id},
            {$unset: {userFolderId: 1}}
          );
        }
        await inboxFolderModel.deleteOne({_id: req.params.id, tenantSlug});
        res.json({request: {messageType}, response: {deleted: true, contents}});
      }
    }
  } catch (error) {
    errorDebugLog("Error deleting inbox folder:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}

export async function moveThreadsToUserFolder(req: Request, res: Response): Promise<void> {
  try {
    const allowedRoleTypes = await permittedInboxRoleTypes(req);
    const body = req.body as InboxThreadMoveRequest;
    const threadIds = (body?.threadIds ?? []).filter(id => isString(id) && id);
    const userFolderId = body?.userFolderId ?? null;
    if (threadIds.length === 0) {
      res.status(400).json({request: {messageType}, error: "Select at least one conversation"});
    } else if (userFolderId && !(await inboxFolderModel.exists({_id: userFolderId, tenantSlug: defaultTenantSlug()}))) {
      res.status(404).json({request: {messageType}, error: "Folder not found"});
    } else {
      const filter = {
        _id: {$in: threadIds},
        tenantSlug: defaultTenantSlug(),
        roleType: {$in: allowedRoleTypes},
        folder: {$nin: foldersExcludedFromInboxList()}
      };
      const update = userFolderId
        ? {$set: {userFolderId}}
        : {$unset: {userFolderId: 1}};
      const result = await inboxThreadModel.updateMany(filter, update);
      res.json({
        request: {messageType},
        response: {matched: result.matchedCount, modified: result.modifiedCount}
      });
    }
  } catch (error) {
    errorDebugLog("Error moving conversations to a folder:", (error as Error).message);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
}
