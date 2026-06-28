import debug from "debug";
import express, { Request, Response } from "express";
import { verifyRamblersUploadSignature } from "./integration-worker-crypto";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {
  IntegrationWorkerResizeProgressCallback,
  IntegrationWorkerResizeResultCallback,
  ResizeImageMode
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { MessageType, ProgressResponse } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { ContentMetadata } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import * as crudController from "../mongo/controllers/crud-controller";
import { contentMetadata as contentMetadataModel } from "../mongo/models/content-metadata";
import * as transforms from "../mongo/controllers/transforms";
import { clearResizeQueueState, completeResizeSession, currentResizeSession, ImageResizeSession, resizeQueueState, setResizeQueueState } from "../aws/image-resize-session-registry";

const debugLog = debug(envConfig.logNamespace("integration-worker-resize-callback-routes"));
debugLog.enabled = true;

const router = express.Router();

router.get("/status/:contentMetadataId", async (req: Request, res: Response) => {
  const { contentMetadataId } = req.params;
  const state = resizeQueueState(contentMetadataId);
  if (state) {
    res.json(state);
  } else {
    res.status(404).json({ message: "No active resize queue state for this content metadata" });
  }
});

router.post("/progress", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({ error: "Invalid integration worker callback signature" });
    return;
  }
  const body = req.body as IntegrationWorkerResizeProgressCallback;
  const session = currentResizeSession(body?.jobId);
  if (!session) {
    debugLog("progress: no active resize session for jobId:", body?.jobId);
    res.status(404).json({ error: `No resize session for jobId ${body?.jobId}` });
    return;
  }
  emitProgress(session, body);
  res.json({ ok: true });
});

router.post("/result", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({ error: "Invalid integration worker callback signature" });
    return;
  }
  const body = req.body as IntegrationWorkerResizeResultCallback;
  const session = currentResizeSession(body?.jobId);
  if (!session) {
    debugLog("result: no active resize session for jobId:", body?.jobId);
    res.status(404).json({ error: `No resize session for jobId ${body?.jobId}` });
    return;
  }
  try {
    await emitResult(session, body);
  } finally {
    completeResizeSession(body.jobId);
    closeSession(session);
  }
  res.json({ ok: true });
});

function emitProgress(session: ImageResizeSession, event: IntegrationWorkerResizeProgressCallback): void {
  if (event.level === "error") {
    sendToSession(session, { type: MessageType.ERROR, data: { message: event.message, request: session.resizeRequest } });
    return;
  }
  const progressResponse: ProgressResponse = { message: event.message, percent: event.percent, queued: event.queued };
  const contentMetadataId = session.resizeRequest.id;
  if (contentMetadataId) {
    setResizeQueueState(contentMetadataId, progressResponse);
  }
  sendToSession(session, { type: MessageType.PROGRESS, data: progressResponse });
}

function clearStateForSession(session: ImageResizeSession): void {
  const contentMetadataId = session.resizeRequest.id;
  if (contentMetadataId) {
    clearResizeQueueState(contentMetadataId);
  }
}

async function emitResult(session: ImageResizeSession, result: IntegrationWorkerResizeResultCallback): Promise<void> {
  if (result.status === "error") {
    clearStateForSession(session);
    sendToSession(session, {
      type: MessageType.ERROR,
      data: { message: "Image resize operation failed", error: result.errorMessage, request: session.resizeRequest }
    });
    return;
  }
  if (session.mode === ResizeImageMode.UNSAVED) {
    clearStateForSession(session);
    sendToSession(session, {
      type: MessageType.COMPLETE,
      data: { request: session.resizeRequest, action: ApiAction.UPDATE, response: result.outputItems || [] }
    });
    return;
  }
  try {
    const controller = crudController.create<ContentMetadata>(contentMetadataModel);
    const contentMetadata = result.contentMetadata;
    const response = contentMetadata.id
      ? await controller.updateDocument({ body: contentMetadata })
      : await controller.createDocument({ body: contentMetadata });
    clearStateForSession(session);
    sendToSession(session, {
      type: MessageType.COMPLETE,
      data: { request: session.resizeRequest, action: result.action, response }
    });
  } catch (error) {
    debugLog("result: failed to persist content metadata for jobId:", result.jobId, "error:", (error as Error).message);
    sendToSession(session, {
      type: MessageType.ERROR,
      data: { message: "Failed to save resized content metadata", error: transforms.parseError(error), request: session.resizeRequest }
    });
  }
}

function sendToSession(session: ImageResizeSession, message: object): void {
  try {
    session.ws.send(JSON.stringify(message));
  } catch (wsError) {
    debugLog("ws.send failed for jobId:", session.jobId, "error:", (wsError as Error).message);
  }
}

function closeSession(session: ImageResizeSession): void {
  try {
    session.ws.close();
  } catch (wsError) {
    debugLog("ws.close failed for jobId:", session.jobId, "error:", (wsError as Error).message);
  }
}

function requestIsSigned(req: Request): boolean {
  const secret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  if (!secret) {
    return false;
  }
  const signature = req.header("x-ramblers-upload-signature") || "";
  return verifyRamblersUploadSignature(JSON.stringify(req.body ?? {}), secret, signature);
}

export const integrationWorkerResizeCallbackRoutes = router;
