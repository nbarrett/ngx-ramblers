import WebSocket from "ws";
import crypto from "crypto";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import {
  ContentMetadata,
  ContentMetadataResizeRequest
} from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { ResizeImageMode } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import * as crudController from "../mongo/controllers/crud-controller";
import { contentMetadata as contentMetadataModel } from "../mongo/models/content-metadata";
import * as transforms from "../mongo/controllers/transforms";
import { dateTimeNowAsValue } from "../shared/dates";
import { resizeSavedImages, resizeUnsavedImages } from "./bulk-image-resizer";
import { completeResizeSession, registerResizeSession } from "./image-resize-session-registry";
import { integrationWorkerConfiguredForResize, submitResizeJobToIntegrationWorker } from "../ramblers/integration-worker-resize-client";

const debugLog = debug(envConfig.logNamespace("image-resize-dispatcher"));
debugLog.enabled = true;

export async function dispatchResizeSavedImages(ws: WebSocket, request: ContentMetadataResizeRequest): Promise<void> {
  if (!integrationWorkerConfiguredForResize()) {
    debugLog("no integration worker configured - resizing saved images locally");
    await resizeSavedImages(ws, request);
    return;
  }
  let jobId: string | null = null;
  try {
    const controller = crudController.create<ContentMetadata>(contentMetadataModel);
    const source: ContentMetadata = await controller.findDocumentById(request.id);
    jobId = crypto.randomUUID();
    registerResizeSession({ jobId, ws, mode: ResizeImageMode.SAVED, resizeRequest: request, startedAt: dateTimeNowAsValue() });
    debugLog("routing saved-image resize to integration worker jobId:", jobId);
    try {
      await submitResizeJobToIntegrationWorker(jobId, ResizeImageMode.SAVED, request, source);
    } catch (submitError) {
      completeResizeSession(jobId);
      jobId = null;
      throw submitError;
    }
  } catch (error) {
    reportDispatchError(ws, request, error);
    if (jobId) {
      completeResizeSession(jobId);
    }
  }
}

export async function dispatchResizeUnsavedImages(ws: WebSocket, request: ContentMetadataResizeRequest): Promise<void> {
  if (!integrationWorkerConfiguredForResize()) {
    debugLog("no integration worker configured - resizing unsaved images locally");
    await resizeUnsavedImages(ws, request);
    return;
  }
  let jobId: string | null = null;
  try {
    jobId = crypto.randomUUID();
    registerResizeSession({ jobId, ws, mode: ResizeImageMode.UNSAVED, resizeRequest: request, startedAt: dateTimeNowAsValue() });
    debugLog("routing unsaved-image resize to integration worker jobId:", jobId);
    try {
      await submitResizeJobToIntegrationWorker(jobId, ResizeImageMode.UNSAVED, request);
    } catch (submitError) {
      completeResizeSession(jobId);
      jobId = null;
      throw submitError;
    }
  } catch (error) {
    reportDispatchError(ws, request, error);
    if (jobId) {
      completeResizeSession(jobId);
    }
  }
}

function reportDispatchError(ws: WebSocket, request: ContentMetadataResizeRequest, error: unknown): void {
  debugLog("resize dispatch error:", (error as Error)?.message);
  try {
    ws.send(JSON.stringify({
      type: MessageType.ERROR,
      data: { message: "Image resize operation failed", error: transforms.parseError(error), request }
    }));
    ws.close();
  } catch (wsError) {
    debugLog("failed to report dispatch error to ws:", (wsError as Error).message);
  }
}
