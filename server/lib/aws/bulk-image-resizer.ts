import { S3 } from "@aws-sdk/client-s3";
import { queryAWSConfig } from "./aws-controllers";
import * as crudController from "../mongo/controllers/crud-controller";
import { contentMetadata as contentMetadataModel } from "../mongo/models/content-metadata";
import {
  ContentMetadata,
  ContentMetadataItem,
  ContentMetadataResizeRequest
} from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import * as transforms from "../mongo/controllers/transforms";
import { AWSConfig } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import WebSocket from "ws";
import { MessageType, ProgressResponse } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { resizeSavedImagesToS3, resizeUnsavedImageItems, ResizeReporter, SavedImagesResizeResult } from "./image-resize-engine";

const debugLog = debug(envConfig.logNamespace("s3-image-resize"));
debugLog.enabled = false;

const s3 = new S3({});
const config: AWSConfig = queryAWSConfig();

function webSocketReporter(ws: WebSocket): ResizeReporter {
  return {
    progress(message: string, percent: number): void {
      const progressMessage: ProgressResponse = {message, percent};
      ws.send(JSON.stringify({type: MessageType.PROGRESS, data: progressMessage}));
    }
  };
}

export async function resizeSavedImages(ws: WebSocket, contentMetadataResizeRequest: ContentMetadataResizeRequest): Promise<void> {
  try {
    const controller = crudController.create<ContentMetadata>(contentMetadataModel);
    const contentMetadataSource: ContentMetadata = await controller.findDocumentById(contentMetadataResizeRequest.id);
    const result: SavedImagesResizeResult = await resizeSavedImagesToS3(s3, config.bucket, contentMetadataResizeRequest, contentMetadataSource, webSocketReporter(ws));
    const contentMetadata = result.contentMetadata;
    const response = contentMetadata.id
      ? await controller.updateDocument({body: contentMetadata})
      : await controller.createDocument({body: contentMetadata});
    ws.send(JSON.stringify({
      type: MessageType.COMPLETE,
      data: {
        request: contentMetadataResizeRequest,
        action: result.action,
        response,
      },
    }));
    ws.close();
  } catch (error) {
    debugLog(`❌ Resize operation failed:`, (error as Error).message);
    ws.send(JSON.stringify({
      type: MessageType.ERROR,
      data: {
        message: "Image resize operation failed",
        error: transforms.parseError(error),
        request: contentMetadataResizeRequest
      }
    }));
    ws.close();
  }
}

export async function resizeUnsavedImages(ws: WebSocket, contentMetadataResizeRequest: ContentMetadataResizeRequest): Promise<void> {
  try {
    const outputItems: ContentMetadataItem[] = await resizeUnsavedImageItems(contentMetadataResizeRequest, webSocketReporter(ws));
    ws.send(JSON.stringify({
      type: MessageType.COMPLETE,
      data: {
        request: contentMetadataResizeRequest,
        action: ApiAction.UPDATE,
        response: outputItems,
      },
    }));
    ws.close();
  } catch (error) {
    debugLog(`❌ Resize operation failed:`, (error as Error).message);
    ws.send(JSON.stringify({
      type: MessageType.ERROR,
      data: {
        message: "Image resize operation failed",
        error: transforms.parseError(error),
        request: contentMetadataResizeRequest
      }
    }));
    ws.close();
  }
}
