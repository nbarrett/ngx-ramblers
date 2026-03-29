import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import {
  ContentMigrationProgress,
  ContentMigrationRequest,
  ContentMigrationScanRequest
} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { scanForExternalContent, scanForUniqueHosts } from "./image-migration-scanner";
import { migrateContent } from "./image-migration-engine";

const debugLog = debug(envConfig.logNamespace("content-migration-ws-handler"));
debugLog.enabled = true;

let migrationCancelled = false;

function decodeUrlForDisplay(value: string): string {
  if (!value) {
    return value;
  }
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function sendProgress(ws: WebSocket, message: string, data?: any): void {
  ws.send(JSON.stringify({
    type: MessageType.PROGRESS,
    data: { message, ...data }
  }));
}

function sendError(ws: WebSocket, message: string): void {
  ws.send(JSON.stringify({
    type: MessageType.ERROR,
    data: { action: ApiAction.QUERY, message }
  }));
}

function sendComplete(ws: WebSocket, message: string, data?: any): void {
  ws.send(JSON.stringify({
    type: MessageType.COMPLETE,
    data: { action: ApiAction.UPDATE, message, ...data }
  }));
}

function sendCancelled(ws: WebSocket, message: string, data?: any): void {
  ws.send(JSON.stringify({
    type: MessageType.CANCELLED,
    data: { action: ApiAction.UPDATE, message, ...data }
  }));
}

export async function handleContentMigrationScanHosts(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleContentMigrationScanHosts:scanning for unique hosts");

  try {
    sendProgress(ws, "Scanning database for external content hosts...");
    const hosts = await scanForUniqueHosts();
    const summary = `Found ${hosts.length} unique external hosts`;
    debugLog("handleContentMigrationScanHosts:completed:", summary);
    sendComplete(ws, summary, { hosts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Host scan failed";
    debugLog("handleContentMigrationScanHosts:error:", message);
    sendError(ws, message);
  }
}

export async function handleContentMigrationScan(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleContentMigrationScan:received request:", data);

  try {
    const request: ContentMigrationScanRequest = {
      hostPattern: data?.hostPattern || "",
      scanAlbums: data?.scanAlbums !== false,
      scanPageContent: data?.scanPageContent !== false,
      scanGroupEvents: data?.scanGroupEvents !== false,
      scanSocialEvents: data?.scanSocialEvents !== false
    };

    if (!request.hostPattern) {
      sendError(ws, "Host pattern is required");
      return;
    }

    sendProgress(ws, `Starting scan for external content from host: ${request.hostPattern}`);

    if (request.scanAlbums) {
      sendProgress(ws, "Scanning albums for external content...");
    }
    if (request.scanPageContent) {
      sendProgress(ws, "Scanning page content for external content...");
    }
    if (request.scanGroupEvents) {
      sendProgress(ws, "Scanning group events for external content...");
    }
    if (request.scanSocialEvents) {
      sendProgress(ws, "Scanning social events for external content...");
    }

    const result = await scanForExternalContent(request);

    const summary = `Scan complete: Found ${result.totalItems} items across ${result.totalPages} sources in ${result.scanDurationMs}ms`;
    debugLog("handleContentMigrationScan:completed:", summary);

    sendComplete(ws, summary, { scanResult: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    debugLog("handleContentMigrationScan:error:", message);
    sendError(ws, message);
  }
}

export async function handleContentMigrationExecute(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleContentMigrationExecute:received request with", data?.items?.length, "items, maxImageSize:", data?.maxImageSize);

  migrationCancelled = false;

  try {
    const request: ContentMigrationRequest = {
      items: data?.items || [],
      targetRootFolder: data?.targetRootFolder || "site-content",
      maxImageSize: data?.maxImageSize || 0
    };

    if (!request.items.length) {
      sendError(ws, "No items selected for migration");
      return;
    }

    const resizeNote = request.maxImageSize > 0 ? ` (resizing images to max ${request.maxImageSize} bytes)` : "";
    sendProgress(ws, `Starting migration of ${request.items.length} items to ${request.targetRootFolder}${resizeNote}`);

    const progressCallback = (progress: ContentMigrationProgress) => {
      const decodedItem = decodeUrlForDisplay(progress.currentItem);
      const decodedError = progress.errorMessage ? decodeUrlForDisplay(progress.errorMessage) : progress.errorMessage;
      sendProgress(ws, decodedItem, {
        progress: { ...progress, currentItem: decodedItem, errorMessage: decodedError }
      });
    };

    const isCancelled = () => migrationCancelled;

    const result = await migrateContent(request, progressCallback, isCancelled);

    if (result.cancelled) {
      const summary = `Migration cancelled: ${result.successCount} succeeded, ${result.failureCount} failed before cancellation`;
      debugLog("handleContentMigrationExecute:cancelled:", summary);
      sendCancelled(ws, summary, { migrationResult: result });
    } else {
      const summary = `Migration complete: ${result.successCount} succeeded, ${result.failureCount} failed`;
      debugLog("handleContentMigrationExecute:completed:", summary);
      sendComplete(ws, summary, { migrationResult: result });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Migration failed";
    debugLog("handleContentMigrationExecute:error:", message);
    sendError(ws, message);
  }
}

export async function handleContentMigrationCancel(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleContentMigrationCancel:cancellation requested");
  migrationCancelled = true;
  sendProgress(ws, "Cancellation requested, stopping after current item...");
}
