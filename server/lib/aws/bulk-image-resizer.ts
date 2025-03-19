import AWS from "aws-sdk";
import sharp from "sharp";
import { queryAWSConfig } from "./aws-controllers";
import * as crudController from "../mongo/controllers/crud-controller";
import { contentMetadata as contentMetadataModel } from "../mongo/models/content-metadata";
import {
  BASE64_PREFIX_JPEG,
  ContentMetadata,
  ContentMetadataItem,
  ContentMetadataResizeRequest
} from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { contentTypeFrom, extensionFrom } from "./aws-utils";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { cloneDeep } from "lodash";
import { generateUid, lastItemFrom, pluraliseWithCount } from "../shared/string-utils";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import * as transforms from "../mongo/controllers/transforms";
import { humanFileSize } from "../../../projects/ngx-ramblers/src/app/functions/file-utils";
import { AWSConfig } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { Buffer } from "node:buffer";
import WebSocket from "ws";
import { MessageType, ProgressResponse } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";

const debugLog = debug(envConfig.logNamespace("s3-image-resize"));
debugLog.enabled = false;
const debugNoLog = debug(envConfig.logNamespace("s3-image-resize-no-log"));
debugNoLog.enabled = false;

const s3 = new AWS.S3();
const config: AWSConfig = queryAWSConfig();

export async function resizeSavedImages(ws: WebSocket, contentMetadataResizeRequest: ContentMetadataResizeRequest): Promise<void> {
  try {
    const controller = crudController.create<ContentMetadata>(contentMetadataModel);
    const contentMetadataSource: ContentMetadata = await controller.findDocumentById(contentMetadataResizeRequest.id);
    const imagePaths: string[] = await listImages(contentMetadataSource);
    const totalImages = imagePaths.length;
    debugLog(`Found ${pluraliseWithCount(imagePaths.length, "image")} to resize`);
    const contentMetadata: ContentMetadata = contentMetadataResizeRequest.output
      ? {...cloneDeep(contentMetadataSource), ...contentMetadataResizeRequest.output, id: null}
      : contentMetadataSource;
    if (totalImages === 0) {
      ws.send(JSON.stringify({
        type:  MessageType.ERROR,
        data: "No images to resize",
        request: contentMetadataResizeRequest,
      }));
      ws.close();
    } else {
      for (const imagePath of imagePaths) {
        try {
          const downloadedImage: Buffer = await downloadImage(imagePath);
          const itemNumber = imagePaths.indexOf(imagePath) + 1;
          const resizedImage: Buffer = await resizeImage(downloadedImage, imagePath, contentMetadataResizeRequest.maxFileSize, 1200, ws, totalImages, itemNumber);
          if (resizedImage) {
            await uploadContentMetadataItem(contentMetadata, lastItemFrom(imagePath), resizedImage, ws, totalImages, itemNumber);
          }
        } catch (error) {
          ws.send(JSON.stringify({
            type: MessageType.COMPLETE,
            data: {
              message: `Image resize operation failed`,
              request: contentMetadataResizeRequest,
              error: transforms.parseError(error)
            }
          }));
        }
      }
      debugLog("✅ Image resize complete for", contentMetadataResizeRequest, contentMetadata.id
        ? "updating existing S3 items"
        : "creating new content metadata and S3 items:");
      const response = contentMetadata.id
        ? await controller.updateDocument({body: contentMetadata})
        : await controller.createDocument({body: contentMetadata});
      ws.send(JSON.stringify({
        type: MessageType.COMPLETE,
        data: {
          request: contentMetadataResizeRequest,
          action: contentMetadata.id ? ApiAction.CREATE : ApiAction.UPDATE,
          response,
        },
      }));
      ws.close();
    }
  } catch (error) {
    debugLog(`❌ Resize operation failed:`, (error as Error).message);
    ws.send(JSON.stringify({
      type:  MessageType.ERROR,
      data: {
        message: "Image resize operation failed",
        error: transforms.parseError(error),
        request: contentMetadataResizeRequest
      }
    }));
    ws.close();
  }
}

function bufferFromBase64(base64Content: string): Buffer {
  const base64Data = base64Content.replace(`${BASE64_PREFIX_JPEG},`, "");
  const from = Buffer.from(base64Data, "base64");
  debugNoLog(`✅ Buffer created from base64 content:`, base64Data, "->", from);
  return from;
}

function bufferToBase64(buffer: Buffer): string {
  const toString = buffer.toString("base64");
  debugNoLog(`✅ Buffer converted to base64 content:`, buffer, "->", toString);
  return `${BASE64_PREFIX_JPEG},${toString}`;
}

export async function resizeUnsavedImages(ws: WebSocket, contentMetadataResizeRequest: ContentMetadataResizeRequest): Promise<void> {
  try {
    const outputItems: ContentMetadataItem[] = cloneDeep(contentMetadataResizeRequest?.input);
    debugLog(`Found ${pluraliseWithCount(contentMetadataResizeRequest?.input?.length, "unsaved image")} to resize`);
    const totalImages = contentMetadataResizeRequest?.input?.length;
    if (totalImages > 0) {
      for (const outputItem of outputItems) {
        const itemNumber = outputItems.indexOf(outputItem) + 1;
        try {
          const base64Content: string = outputItem.base64Content;
          const downloadedImage: Buffer = bufferFromBase64(base64Content);
          const resizedImage: Buffer = await resizeImage(downloadedImage, outputItem.originalFileName, contentMetadataResizeRequest.maxFileSize, 1200, ws, totalImages, itemNumber);
          if (resizedImage) {
            outputItem.base64Content = bufferToBase64(resizedImage);
          }
        } catch (error) {
          debugLog(`❌ Error processing item:`, outputItem, error);
          ws.send(JSON.stringify({
            type:  MessageType.ERROR,
            data: {
              message: "Image resize operation failed",
              error: transforms.parseError(error),
              request: contentMetadataResizeRequest
            }
          }));
          ws.close();
        }
      }
      debugLog(`✅ Image resize complete for ${pluraliseWithCount(contentMetadataResizeRequest?.input?.length, "unsaved image")} - returning ${pluraliseWithCount(outputItems?.length, "response item")}`);
      ws.send(JSON.stringify({
        type: MessageType.COMPLETE,
        data: {
          request: contentMetadataResizeRequest,
          action: ApiAction.UPDATE,
          response: outputItems,
        },
      }));
      ws.close();
    } else {
      ws.send(JSON.stringify({
        type:  MessageType.ERROR,
        data: {
          message: "No images to resize",
          request: contentMetadataResizeRequest
        }
      }));
      ws.close();
    }
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

async function listImages(contentMetadata: ContentMetadata): Promise<string[]> {
  debugLog(`ℹ️ Listing ${(config.bucket)} objects in ${contentMetadata.rootFolder}/${contentMetadata.name}`);
  const params: AWS.S3.ListObjectsV2Request = {
    Bucket: config.bucket,
    Prefix: `${contentMetadata.rootFolder}/${contentMetadata.name}`
  };
  const {Contents} = await s3.listObjectsV2(params).promise();
  const fileNames = contentMetadata.files.map(item => lastItemFrom(item.image));
  const objects = Contents || [];
  debugLog(`✅️ Found ${objects.length} ${(config.bucket)} objects in ${contentMetadata.rootFolder}/${contentMetadata.name}`);
  return objects
    .map(obj => obj.Key)
    .filter(key => {
      const searchElement = lastItemFrom(key);
      const match = fileNames.includes(searchElement);
      debugNoLog(`ℹ️ Checking ${searchElement} against ${fileNames} -> ${match}`);
      return match;
    });
}

async function downloadImage(imagePath: string): Promise<Buffer> {
  const params: AWS.S3.GetObjectRequest = {Bucket: config.bucket, Key: imagePath};
  const {Body} = await s3.getObject(params).promise();
  return Body as Buffer;
}

async function uploadImage(imageName: string, buffer: Buffer, contentMetadata: ContentMetadata): Promise<string> {
  const uploadImageName = contentMetadata.id ? imageName : generateUid() + extensionFrom(imageName);
  const uploadImagePath = `${contentMetadata.rootFolder}/${contentMetadata.name}/${uploadImageName}`;
  await s3.putObject({
    Bucket: config.bucket,
    Key: uploadImagePath,
    Body: buffer,
    ContentType: contentTypeFrom(imageName),
    ACL: "public-read"
  }).promise();
  debugLog(`✅ Uploaded: ${uploadImagePath} (${humanFileSize(buffer.length)}) from input ${imageName}`);
  return uploadImageName;
}

async function uploadContentMetadataItem(contentMetadata: ContentMetadata, imageName: string, buffer: Buffer, ws: WebSocket, totalImages: number, itemNumber: number) {
  const contentMetadataItem = contentMetadata.files.find(file => lastItemFrom(file.image) === imageName);
  if (contentMetadataItem) {
    debugLog(`✅ Resized ${imageName} to ${humanFileSize(buffer.length)} - now uploading to s3`);
    const percent = Math.round((itemNumber / totalImages) * 100);
    const progressMessage: ProgressResponse = {
      message: `Resized ${imageName} to ${humanFileSize(buffer.length)} - now uploading to s3`,
      percent
    };
    ws.send(JSON.stringify({
      type: MessageType.PROGRESS,
      data: progressMessage,
    }));
    const newFileName = await uploadImage(imageName, buffer, contentMetadata);
    debugLog(`✅ Updating content metadata ${contentMetadataItem.image} to ${newFileName}`);
    const updateMessage: ProgressResponse = {
      message: `Updating content metadata ${contentMetadataItem.image} to ${newFileName}`,
      percent
    };
    ws.send(JSON.stringify({
      type: MessageType.PROGRESS,
      data: updateMessage,
    }));
    contentMetadataItem.image = lastItemFrom(newFileName);
  } else {
    debugLog(`❌ Error: Unable to find ${imageName} in content metadata files:`, contentMetadata.files);
    ws.send(JSON.stringify({
      type: MessageType.ERROR,
      data: `Unable to find ${imageName} in content metadata files`
    }));
  }
}

async function resizeImage(initialImage: Buffer, imagePath: string, maxFileSize: number, maxWidth = 1200,
                           ws: WebSocket, totalImages: number, itemNumber: number): Promise<Buffer> {
  if (initialImage.length <= maxFileSize) {
    debugLog(`ℹ️ Skipping ${imagePath} as existing size of ${humanFileSize(initialImage.length)} already under ${humanFileSize(maxFileSize)}`);
    const percent = Math.round((itemNumber / totalImages) * 100);
    const skipMessage: ProgressResponse = {
      message: `Skipping ${lastItemFrom(imagePath)} as existing size of ${humanFileSize(initialImage.length)} already under ${humanFileSize(maxFileSize)}`,
      percent
    };
    ws.send(JSON.stringify({
      type: MessageType.PROGRESS,
      data: skipMessage
    }));
    return Promise.resolve(null);
  } else {
    let resizeAttempt = 0;
    let quality = 80;
    let buffer: Buffer;
    const isPng = imagePath.endsWith(".png");
    const outputFormat = isPng ? "webp" : "jpeg";
    const imageName = lastItemFrom(imagePath);
    do {
      resizeAttempt++;
      buffer = await sharp(initialImage)
        .resize({width: maxWidth})
        .toFormat(outputFormat, {quality})
        .toBuffer();
      const percent = Math.round((itemNumber / totalImages) * 100);
      const resizeMessage: ProgressResponse = {
        message: `Resize attempt ${resizeAttempt} for ${imageName} from ${humanFileSize(initialImage.length)} to ${humanFileSize(buffer.length)} with maxWidth ${maxWidth}px, ${outputFormat} format with quality ${quality}`,
        percent
      };
      ws.send(JSON.stringify({
        type: MessageType.PROGRESS,
        data: resizeMessage
      }));
      debugLog(`✅ Resize attempt ${resizeAttempt} for ${imageName} from ${humanFileSize(initialImage.length)} to ${humanFileSize(buffer.length)} with maxWidth ${maxWidth}px, ${outputFormat} format with quality ${quality}`);
      quality -= 5;
    } while (buffer.length > maxFileSize && quality > 10);
    return buffer;
  }
}
