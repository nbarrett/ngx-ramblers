import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3 } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import sharp from "sharp";
import { Buffer } from "node:buffer";
import { cloneDeep, isFunction } from "es-toolkit/compat";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { contentTypeFrom, extensionFrom } from "./aws-utils";
import { generateUid, lastItemFrom, pluraliseWithCount } from "../shared/string-utils";
import { humanFileSize } from "../../../projects/ngx-ramblers/src/app/functions/file-utils";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import {
  BASE64_PREFIX_JPEG,
  ContentMetadata,
  ContentMetadataItem,
  ContentMetadataResizeRequest
} from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";

const debugLog = debug(envConfig.logNamespace("image-resize-engine"));
debugLog.enabled = false;
const debugNoLog = debug(envConfig.logNamespace("image-resize-engine-no-log"));
debugNoLog.enabled = false;

export interface ResizeReporter {
  progress(message: string, percent: number): void;
}

export interface SavedImagesResizeResult {
  action: ApiAction;
  contentMetadata: ContentMetadata;
}

export async function resizeSavedImagesToS3(s3: S3, bucket: string, request: ContentMetadataResizeRequest, source: ContentMetadata, reporter: ResizeReporter): Promise<SavedImagesResizeResult> {
  const imagePaths: string[] = await listImages(s3, bucket, source);
  const totalImages = imagePaths.length;
  debugLog(`Found ${pluraliseWithCount(imagePaths.length, "image")} to resize`);
  if (totalImages === 0) {
    throw new Error("No images to resize");
  }
  const contentMetadata: ContentMetadata = request.output
    ? {...cloneDeep(source), ...request.output, id: null}
    : source;
  for (const imagePath of imagePaths) {
    const itemNumber = imagePaths.indexOf(imagePath) + 1;
    try {
      const downloadedImage: Buffer = await downloadImage(s3, bucket, imagePath);
      const resizedImage: Buffer = await resizeImage(downloadedImage, imagePath, request.maxFileSize, 1200, reporter, totalImages, itemNumber);
      if (resizedImage) {
        await uploadContentMetadataItem(s3, bucket, contentMetadata, lastItemFrom(imagePath), resizedImage, reporter, totalImages, itemNumber);
      }
    } catch (error) {
      const percent = Math.round((itemNumber / totalImages) * 100);
      reporter.progress(`Failed to resize ${lastItemFrom(imagePath)}: ${(error as Error).message}`, percent);
      debugLog(`❌ Error resizing ${imagePath}:`, (error as Error).message);
    }
  }
  debugLog("✅ Image resize complete for", request, contentMetadata.id ? "updating existing S3 items" : "creating new content metadata and S3 items");
  return {action: contentMetadata.id ? ApiAction.CREATE : ApiAction.UPDATE, contentMetadata};
}

export async function resizeUnsavedImageItems(request: ContentMetadataResizeRequest, reporter: ResizeReporter): Promise<ContentMetadataItem[]> {
  const outputItems: ContentMetadataItem[] = cloneDeep(request?.input);
  const totalImages = request?.input?.length;
  debugLog(`Found ${pluraliseWithCount(totalImages, "unsaved image")} to resize`);
  if (!(totalImages > 0)) {
    throw new Error("No images to resize");
  }
  for (const outputItem of outputItems) {
    const itemNumber = outputItems.indexOf(outputItem) + 1;
    const downloadedImage: Buffer = bufferFromBase64(outputItem.base64Content);
    const resizedImage: Buffer = await resizeImage(downloadedImage, outputItem.originalFileName, request.maxFileSize, 1200, reporter, totalImages, itemNumber);
    if (resizedImage) {
      outputItem.base64Content = bufferToBase64(resizedImage);
    }
  }
  debugLog(`✅ Image resize complete for ${pluraliseWithCount(totalImages, "unsaved image")} - returning ${pluraliseWithCount(outputItems?.length, "response item")}`);
  return outputItems;
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

async function listImages(s3: S3, bucket: string, contentMetadata: ContentMetadata): Promise<string[]> {
  debugLog(`ℹ️ Listing ${bucket} objects in ${contentMetadata.rootFolder}/${contentMetadata.name}`);
  const {Contents} = await s3.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: `${contentMetadata.rootFolder}/${contentMetadata.name}`
  }));
  const fileNames = contentMetadata.files.map(item => lastItemFrom(item.image));
  const objects = Contents || [];
  debugLog(`✅️ Found ${objects.length} ${bucket} objects in ${contentMetadata.rootFolder}/${contentMetadata.name}`);
  return objects
    .map(obj => obj.Key)
    .filter(key => {
      const searchElement = lastItemFrom(key);
      const match = fileNames.includes(searchElement);
      debugNoLog(`ℹ️ Checking ${searchElement} against ${fileNames} -> ${match}`);
      return match;
    });
}

async function downloadImage(s3: S3, bucket: string, imagePath: string): Promise<Buffer> {
  const {Body} = await s3.send(new GetObjectCommand({Bucket: bucket, Key: imagePath}));
  if (!Body) {
    return Buffer.alloc(0);
  }
  if (Body instanceof Readable) {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      Body.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      Body.on("error", reject);
      Body.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }
  if (Body instanceof Uint8Array) {
    return Buffer.from(Body);
  }
  const blob = Body as Blob;
  if (isFunction(blob.arrayBuffer)) {
    const ab = await blob.arrayBuffer();
    return Buffer.from(ab);
  }
  return Buffer.alloc(0);
}

async function uploadImage(s3: S3, bucket: string, imageName: string, buffer: Buffer, contentMetadata: ContentMetadata): Promise<string> {
  const uploadImageName = contentMetadata.id ? imageName : generateUid() + extensionFrom(imageName);
  const uploadImagePath = `${contentMetadata.rootFolder}/${contentMetadata.name}/${uploadImageName}`;
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: uploadImagePath,
    Body: buffer,
    ContentType: contentTypeFrom(imageName)
  }));
  debugLog(`✅ Uploaded: ${uploadImagePath} (${humanFileSize(buffer.length)}) from input ${imageName}`);
  return uploadImageName;
}

async function uploadContentMetadataItem(s3: S3, bucket: string, contentMetadata: ContentMetadata, imageName: string, buffer: Buffer, reporter: ResizeReporter, totalImages: number, itemNumber: number): Promise<void> {
  const contentMetadataItem = contentMetadata.files.find(file => lastItemFrom(file.image) === imageName);
  if (contentMetadataItem) {
    const percent = Math.round((itemNumber / totalImages) * 100);
    debugLog(`✅ Resized ${imageName} to ${humanFileSize(buffer.length)} - now uploading to s3`);
    reporter.progress(`Resized ${imageName} to ${humanFileSize(buffer.length)} - now uploading to s3`, percent);
    const newFileName = await uploadImage(s3, bucket, imageName, buffer, contentMetadata);
    debugLog(`✅ Updating content metadata ${contentMetadataItem.image} to ${newFileName}`);
    reporter.progress(`Updating content metadata ${contentMetadataItem.image} to ${newFileName}`, percent);
    contentMetadataItem.image = lastItemFrom(newFileName);
  } else {
    debugLog(`❌ Error: Unable to find ${imageName} in content metadata files:`, contentMetadata.files);
    throw new Error(`Unable to find ${imageName} in content metadata files`);
  }
}

async function resizeImage(initialImage: Buffer, imagePath: string, maxFileSize: number, maxWidth = 1200,
                           reporter: ResizeReporter, totalImages: number, itemNumber: number): Promise<Buffer> {
  const percent = Math.round((itemNumber / totalImages) * 100);
  if (initialImage.length <= maxFileSize) {
    debugLog(`ℹ️ Skipping ${imagePath} as existing size of ${humanFileSize(initialImage.length)} already under ${humanFileSize(maxFileSize)}`);
    reporter.progress(`Skipping ${lastItemFrom(imagePath)} as existing size of ${humanFileSize(initialImage.length)} already under ${humanFileSize(maxFileSize)}`, percent);
    return null;
  } else {
    const isPng = imagePath.endsWith(".png");
    const outputFormat = isPng ? "webp" : "jpeg";
    const imageName = lastItemFrom(imagePath);
    const resizeWithQuality = async (quality: number, attempt: number): Promise<Buffer> => {
      const buffer = await sharp(initialImage)
        .resize({width: maxWidth})
        .toFormat(outputFormat, {quality})
        .toBuffer();
      reporter.progress(`Resize attempt ${attempt} for ${imageName} from ${humanFileSize(initialImage.length)} to ${humanFileSize(buffer.length)} with maxWidth ${maxWidth}px, ${outputFormat} format with quality ${quality}`, percent);
      debugLog(`✅ Resize attempt ${attempt} for ${imageName} from ${humanFileSize(initialImage.length)} to ${humanFileSize(buffer.length)} with maxWidth ${maxWidth}px, ${outputFormat} format with quality ${quality}`);
      if (buffer.length > maxFileSize && quality > 10) return resizeWithQuality(quality - 5, attempt + 1);
      return buffer;
    };
    return resizeWithQuality(80, 1);
  }
}
