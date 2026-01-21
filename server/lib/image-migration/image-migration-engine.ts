import debug from "debug";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import sharp from "sharp";
import { envConfig } from "../env-config/env-config";
import {
  ExternalImageReference,
  ImageMigrationProgress,
  ImageMigrationRequest,
  ImageMigrationResult,
  ImageMigrationSourceType,
  ImageMigrationStatus,
  RootFolder
} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import * as aws from "../aws/aws-controllers";
import { contentMetadata } from "../mongo/models/content-metadata";
import { pageContent } from "../mongo/models/page-content";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { isAwsUploadErrorResponse, generateAwsFileName } from "../aws/aws-utils";
import * as mongooseClient from "../mongo/mongoose-client";
import { isArray } from "es-toolkit/compat";
import { humanFileSize } from "../../../projects/ngx-ramblers/src/app/functions/file-utils";

const debugLog = debug(envConfig.logNamespace("image-migration-engine"));
debugLog.enabled = true;

type ProgressCallback = (progress: ImageMigrationProgress) => void;

async function downloadExternalImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadExternalImage(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
        return;
      }

      const chunks: Uint8Array[] = [];
      const contentType = response.headers["content-type"] || "image/jpeg";

      response.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      response.on("end", () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType
        });
      });
      response.on("error", reject);
    });

    request.on("error", reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error("Download timeout"));
    });
  });
}

function extractFileNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const fileName = pathParts[pathParts.length - 1];
    if (fileName && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName)) {
      return fileName;
    }
    return `image-${Date.now()}.jpg`;
  } catch {
    return `image-${Date.now()}.jpg`;
  }
}

async function resizeImageIfNeeded(buffer: Buffer, imagePath: string, maxFileSize: number): Promise<{ buffer: Buffer; wasResized: boolean }> {
  if (maxFileSize <= 0 || buffer.length <= maxFileSize) {
    debugLog(`resizeImageIfNeeded:skipping resize for ${imagePath}, size ${humanFileSize(buffer.length)} already under ${humanFileSize(maxFileSize)}`);
    return { buffer, wasResized: false };
  }

  debugLog(`resizeImageIfNeeded:resizing ${imagePath} from ${humanFileSize(buffer.length)} to under ${humanFileSize(maxFileSize)}`);

  const isPng = imagePath.toLowerCase().endsWith(".png");
  const outputFormat = isPng ? "webp" : "jpeg";
  const maxWidth = 1200;
  let quality = 80;
  let resizedBuffer: Buffer = buffer;
  let resizeAttempt = 0;

  do {
    resizeAttempt++;
    resizedBuffer = await sharp(buffer)
      .resize({ width: maxWidth })
      .toFormat(outputFormat, { quality })
      .toBuffer();

    debugLog(`resizeImageIfNeeded:attempt ${resizeAttempt} for ${imagePath}: ${humanFileSize(buffer.length)} -> ${humanFileSize(resizedBuffer.length)} (quality: ${quality})`);
    quality -= 5;
  } while (resizedBuffer.length > maxFileSize && quality > 10);

  debugLog(`resizeImageIfNeeded:completed for ${imagePath}: ${humanFileSize(buffer.length)} -> ${humanFileSize(resizedBuffer.length)}`);
  return { buffer: resizedBuffer, wasResized: true };
}

interface UploadTarget {
  rootFolder: string;
  awsFileName: string;
}

async function uploadToS3(buffer: Buffer, originalFileName: string, targetFolder: string): Promise<UploadTarget> {
  const tempDir = os.tmpdir();
  const awsFileName = generateAwsFileName(originalFileName);
  const tempFilePath = path.join(tempDir, awsFileName);

  await fs.promises.writeFile(tempFilePath, new Uint8Array(buffer));

  try {
    const result = await aws.putObjectDirect(targetFolder, awsFileName, tempFilePath);

    if (isAwsUploadErrorResponse(result)) {
      throw new Error(result.error || "S3 upload failed");
    }

    debugLog("uploadToS3:success:", targetFolder, awsFileName);
    return { rootFolder: targetFolder, awsFileName };
  } finally {
    try {
      await fs.promises.unlink(tempFilePath);
    } catch {
      debugLog("uploadToS3:failed to clean up temp file:", tempFilePath);
    }
  }
}

async function getAlbumTargetFolder(sourceId: string): Promise<string | null> {
  await mongooseClient.connect(debugLog);
  const doc = await contentMetadata.findById(sourceId).exec();
  if (doc && doc.rootFolder && doc.name) {
    return `${doc.rootFolder}/${doc.name}`;
  }
  return null;
}

async function updateContentMetadataReference(image: ExternalImageReference, newImageValue: string, maxImageSize?: number): Promise<void> {
  debugLog("updateContentMetadataReference:updating", image.sourceId, "from", image.currentUrl, "to", newImageValue);
  await mongooseClient.connect(debugLog);

  const doc = await contentMetadata.findById(image.sourceId).exec();
  if (!doc) {
    throw new Error(`ContentMetadata not found: ${image.sourceId}`);
  }

  const files = doc.files || [];
  const updatedFiles = files.map((file: any) => {
    if (file.image === image.currentUrl) {
      return { ...file.toObject ? file.toObject() : file, image: newImageValue };
    }
    return file.toObject ? file.toObject() : file;
  });

  const updateData: any = { files: updatedFiles };

  if (maxImageSize > 0 && !doc.maxImageSize) {
    debugLog("updateContentMetadataReference:setting maxImageSize to", maxImageSize);
    updateData.maxImageSize = maxImageSize;
  }

  await contentMetadata.findByIdAndUpdate(image.sourceId, updateData).exec();
  debugLog("updateContentMetadataReference:updated successfully");
}

async function updatePageContentReference(image: ExternalImageReference, newS3Url: string): Promise<void> {
  debugLog("updatePageContentReference:updating", image.sourceId, "from", image.currentUrl, "to", newS3Url);
  await mongooseClient.connect(debugLog);

  const doc = await pageContent.findById(image.sourceId).exec();
  if (!doc) {
    throw new Error(`PageContent not found: ${image.sourceId}`);
  }

  const docObj = doc.toObject ? doc.toObject() : doc;

  function updateColumnImages(column: any): any {
    const updatedColumn = { ...column };
    if (updatedColumn.imageSource === image.currentUrl) {
      updatedColumn.imageSource = newS3Url;
    }
    if (updatedColumn.rows && isArray(updatedColumn.rows)) {
      updatedColumn.rows = updatedColumn.rows.map((nestedRow: any) => ({
        ...nestedRow,
        columns: (nestedRow.columns || []).map(updateColumnImages)
      }));
    }
    return updatedColumn;
  }

  const updatedRows = (docObj.rows || []).map((row: any) => ({
    ...row,
    columns: (row.columns || []).map(updateColumnImages)
  }));

  await pageContent.findByIdAndUpdate(image.sourceId, { rows: updatedRows }).exec();
  debugLog("updatePageContentReference:updated successfully");
}

async function updateGroupEventReference(image: ExternalImageReference, newS3Url: string): Promise<void> {
  debugLog("updateGroupEventReference:updating", image.sourceId, "from", image.currentUrl, "to", newS3Url);
  await mongooseClient.connect(debugLog);

  const doc = await extendedGroupEvent.findById(image.sourceId).exec();
  if (!doc) {
    throw new Error(`ExtendedGroupEvent not found: ${image.sourceId}`);
  }

  const docObj = doc.toObject ? doc.toObject() : doc;
  const media = docObj.groupEvent?.media || [];

  const updatedMedia = media.map((mediaItem: any) => ({
    ...mediaItem,
    styles: (mediaItem.styles || []).map((style: any) => {
      if (style.url === image.currentUrl) {
        return { ...style, url: newS3Url };
      }
      return style;
    })
  }));

  await extendedGroupEvent.findByIdAndUpdate(image.sourceId, {
    "groupEvent.media": updatedMedia
  }).exec();
  debugLog("updateGroupEventReference:updated successfully");
}

async function updateContentReference(image: ExternalImageReference, upload: UploadTarget, maxImageSize?: number): Promise<string> {
  const relativeS3Url = `${upload.rootFolder}/${upload.awsFileName}`;

  switch (image.sourceType) {
    case ImageMigrationSourceType.CONTENT_METADATA:
      await updateContentMetadataReference(image, upload.awsFileName, maxImageSize);
      break;
    case ImageMigrationSourceType.PAGE_CONTENT:
      await updatePageContentReference(image, relativeS3Url);
      break;
    case ImageMigrationSourceType.GROUP_EVENT:
    case ImageMigrationSourceType.SOCIAL_EVENT:
      await updateGroupEventReference(image, relativeS3Url);
      break;
    default:
      throw new Error(`Unknown source type: ${image.sourceType}`);
  }

  return relativeS3Url;
}

export async function migrateImages(
  request: ImageMigrationRequest,
  progressCallback?: ProgressCallback
): Promise<ImageMigrationResult> {
  debugLog("migrateImages:starting migration of", request.images.length, "images to", request.targetRootFolder);

  const migratedImages: ExternalImageReference[] = [];
  const failedImages: ExternalImageReference[] = [];
  let processedCount = 0;

  const sendProgress = (currentImage: string) => {
    if (progressCallback) {
      progressCallback({
        totalImages: request.images.length,
        processedImages: processedCount,
        successCount: migratedImages.length,
        failureCount: failedImages.length,
        currentImage,
        percent: Math.round((processedCount / request.images.length) * 100)
      });
    }
  };

  const maxImageSize = request.maxImageSize || 0;

  const imagePromises = request.images.map(async (image) => {
    try {
      debugLog("migrateImages:processing image:", image.currentUrl);
      sendProgress(image.currentUrl);

      const { buffer: downloadedBuffer } = await downloadExternalImage(image.currentUrl);
      const fileName = extractFileNameFromUrl(image.currentUrl);

      const { buffer: finalBuffer, wasResized } = await resizeImageIfNeeded(downloadedBuffer, fileName, maxImageSize);
      if (wasResized) {
        debugLog("migrateImages:resized image from", humanFileSize(downloadedBuffer.length), "to", humanFileSize(finalBuffer.length));
      }

      let targetFolder: string = request.targetRootFolder;
      if (image.sourceType === ImageMigrationSourceType.CONTENT_METADATA) {
        const albumFolder = await getAlbumTargetFolder(image.sourceId);
        if (albumFolder) {
          targetFolder = albumFolder;
          debugLog("migrateImages:using album folder:", targetFolder);
        }
      }

      const upload = await uploadToS3(finalBuffer, fileName, targetFolder);
      const newS3Url = await updateContentReference(image, upload, maxImageSize);

      const migratedImage: ExternalImageReference = {
        ...image,
        status: ImageMigrationStatus.MIGRATED,
        newS3Url
      };
      migratedImages.push(migratedImage);
      debugLog("migrateImages:successfully migrated:", image.currentUrl, "->", newS3Url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog("migrateImages:failed to migrate:", image.currentUrl, "error:", errorMessage);

      const failedImage: ExternalImageReference = {
        ...image,
        status: ImageMigrationStatus.FAILED,
        errorMessage
      };
      failedImages.push(failedImage);
    } finally {
      processedCount++;
      sendProgress(image.currentUrl);
    }
  });

  await Promise.all(imagePromises.map(p => p.catch(() => {})));

  debugLog("migrateImages:completed migration. Success:", migratedImages.length, "Failed:", failedImages.length);

  return {
    totalProcessed: processedCount,
    successCount: migratedImages.length,
    failureCount: failedImages.length,
    migratedImages,
    failedImages
  };
}
