import WebSocket from "ws";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import {
  ImageMigrationProgress,
  ImageMigrationRequest,
  ImageMigrationScanRequest
} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { scanForExternalImages, scanForUniqueHosts } from "./image-migration-scanner";
import { migrateImages } from "./image-migration-engine";

const debugLog = debug(envConfig.logNamespace("image-migration-ws-handler"));
debugLog.enabled = true;

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

export async function handleImageMigrationScanHosts(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleImageMigrationScanHosts:scanning for unique hosts");

  try {
    sendProgress(ws, "Scanning database for external image hosts...");
    const hosts = await scanForUniqueHosts();
    const summary = `Found ${hosts.length} unique external hosts`;
    debugLog("handleImageMigrationScanHosts:completed:", summary);
    sendComplete(ws, summary, { hosts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Host scan failed";
    debugLog("handleImageMigrationScanHosts:error:", message);
    sendError(ws, message);
  }
}

export async function handleImageMigrationScan(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleImageMigrationScan:received request:", data);

  try {
    const request: ImageMigrationScanRequest = {
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

    sendProgress(ws, `Starting scan for images from host: ${request.hostPattern}`);

    if (request.scanAlbums) {
      sendProgress(ws, "Scanning albums for external images...");
    }
    if (request.scanPageContent) {
      sendProgress(ws, "Scanning page content for external images...");
    }
    if (request.scanGroupEvents) {
      sendProgress(ws, "Scanning group events for external images...");
    }
    if (request.scanSocialEvents) {
      sendProgress(ws, "Scanning social events for external images...");
    }

    const result = await scanForExternalImages(request);

    const summary = `Scan complete: Found ${result.totalImages} images across ${result.totalPages} sources in ${result.scanDurationMs}ms`;
    debugLog("handleImageMigrationScan:completed:", summary);

    sendComplete(ws, summary, { scanResult: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    debugLog("handleImageMigrationScan:error:", message);
    sendError(ws, message);
  }
}

export async function handleImageMigrationExecute(ws: WebSocket, data: any): Promise<void> {
  debugLog("handleImageMigrationExecute:received request with", data?.images?.length, "images, maxImageSize:", data?.maxImageSize);

  try {
    const request: ImageMigrationRequest = {
      images: data?.images || [],
      targetRootFolder: data?.targetRootFolder || "site-content",
      maxImageSize: data?.maxImageSize || 0
    };

    if (!request.images.length) {
      sendError(ws, "No images selected for migration");
      return;
    }

    const resizeNote = request.maxImageSize > 0 ? ` (resizing to max ${request.maxImageSize} bytes)` : "";
    sendProgress(ws, `Starting migration of ${request.images.length} images to ${request.targetRootFolder}${resizeNote}`);

    const progressCallback = (progress: ImageMigrationProgress) => {
      sendProgress(
        ws,
        `Migrating: ${progress.processedImages}/${progress.totalImages} (${progress.percent}%) - ${progress.currentImage}`,
        { progress }
      );
    };

    const result = await migrateImages(request, progressCallback);

    const summary = `Migration complete: ${result.successCount} succeeded, ${result.failureCount} failed`;
    debugLog("handleImageMigrationExecute:completed:", summary);

    sendComplete(ws, summary, { migrationResult: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Migration failed";
    debugLog("handleImageMigrationExecute:error:", message);
    sendError(ws, message);
  }
}
