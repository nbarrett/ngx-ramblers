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
import { generateAwsFileName, isAwsUploadErrorResponse } from "../aws/aws-utils";
import * as mongooseClient from "../mongo/mongoose-client";
import { isArray, keys, values } from "es-toolkit/compat";
import { humanFileSize } from "../../../projects/ngx-ramblers/src/app/functions/file-utils";
import { createProcessTimer } from "../shared/process-timer";
import { dateTimeNowAsValue } from "../shared/dates";

const debugLog = debug(envConfig.logNamespace("image-migration-engine"));
debugLog.enabled = true;

type ProgressCallback = (progress: ImageMigrationProgress) => void;
type CancellationCheck = () => boolean;
type UrlMapping = Record<string, string>;

function rootFolderForSourceType(sourceType: ImageMigrationSourceType, fallbackFolder: RootFolder): RootFolder {
  if (sourceType === ImageMigrationSourceType.CONTENT_METADATA) {
    return RootFolder.carousels;
  } else {
    return fallbackFolder;
  }
}

function extractAlbumNameFromSourcePath(sourcePath: string): string {
  const parts = sourcePath.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : sourcePath;
}

function targetPathForImage(imageRef: ExternalImageReference, fallbackFolder: RootFolder): string {
  const rootFolder = rootFolderForSourceType(imageRef.sourceType, fallbackFolder);
  if (imageRef.sourceType === ImageMigrationSourceType.CONTENT_METADATA) {
    const albumName = extractAlbumNameFromSourcePath(imageRef.sourcePath);
    return `${rootFolder}/${albumName}`;
  } else {
    return rootFolder;
  }
}

async function downloadExternalImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const safeUrl = url.replace(/ /g, "%20");
    const protocol = safeUrl.startsWith("https") ? https : http;

    const request = protocol.get(safeUrl, response => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadExternalImage(redirectUrl.replace(/ /g, "%20")).then(resolve).catch(reject);
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
    return `image-${dateTimeNowAsValue()}.jpg`;
  } catch {
    return `image-${dateTimeNowAsValue()}.jpg`;
  }
}

async function resizeImageIfNeeded(buffer: Buffer, imagePath: string, maxFileSize: number): Promise<{ buffer: Buffer; wasResized: boolean }> {
  if (maxFileSize <= 0) {
    debugLog(`resizeImageIfNeeded:skipping resize for ${imagePath}, size ${humanFileSize(buffer.length)} (no size limit set)`);
    return { buffer, wasResized: false };
  }
  if (buffer.length <= maxFileSize) {
    debugLog(`resizeImageIfNeeded:skipping resize for ${imagePath}, size ${humanFileSize(buffer.length)} already under ${humanFileSize(maxFileSize)}`);
    return { buffer, wasResized: false };
  }

  debugLog(`resizeImageIfNeeded:resizing ${imagePath} from ${humanFileSize(buffer.length)} to under ${humanFileSize(maxFileSize)}`);

  const isPng = imagePath.toLowerCase().endsWith(".png");
  const outputFormat = isPng ? "webp" : "jpeg";
  const maxWidth = 1200;

  const resizeWithQuality = async (quality: number, attempt: number): Promise<Buffer> => {
    const resizedBuffer = await sharp(buffer)
      .resize({ width: maxWidth })
      .toFormat(outputFormat, { quality })
      .toBuffer();
    debugLog(`resizeImageIfNeeded:attempt ${attempt} for ${imagePath}: ${humanFileSize(buffer.length)} -> ${humanFileSize(resizedBuffer.length)} (quality: ${quality})`);
    if (resizedBuffer.length > maxFileSize && quality > 10) return resizeWithQuality(quality - 5, attempt + 1);
    return resizedBuffer;
  };

  const resizedBuffer = await resizeWithQuality(80, 1);
  debugLog(`resizeImageIfNeeded:completed for ${imagePath}: ${humanFileSize(buffer.length)} -> ${humanFileSize(resizedBuffer.length)}`);
  return { buffer: resizedBuffer, wasResized: true };
}

async function uploadToS3(buffer: Buffer, originalFileName: string, targetFolder: string): Promise<string> {
  const tempDir = os.tmpdir();
  const awsFileName = generateAwsFileName(originalFileName);
  const tempFilePath = path.join(tempDir, awsFileName);

  await fs.promises.writeFile(tempFilePath, new Uint8Array(buffer));

  try {
    const result = await aws.putObjectDirect(targetFolder, awsFileName, tempFilePath);

    if (isAwsUploadErrorResponse(result)) {
      throw new Error(result.error || "S3 upload failed");
    }

    const s3Path = `${targetFolder}/${awsFileName}`;
    debugLog("uploadToS3:success:", s3Path);
    return s3Path;
  } finally {
    try {
      await fs.promises.unlink(tempFilePath);
    } catch {
      debugLog("uploadToS3:failed to clean up temp file:", tempFilePath);
    }
  }
}

function replaceUrlsInText(text: string, urlMapping: UrlMapping): string {
  let result = text;
  keys(urlMapping).forEach(oldUrl => {
    const newUrl = urlMapping[oldUrl];
    const containsUrl = result.includes(oldUrl);
    debugLog("replaceUrlsInText:checking", oldUrl, "->", newUrl, "containsUrl:", containsUrl);
    if (containsUrl) {
      const escapedOldUrl = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const markdownRegex = new RegExp(`(!\\[[^\\]]*\\]\\()${escapedOldUrl}(\\))`, "g");
      const markdownMatches = result.match(markdownRegex);
      debugLog("replaceUrlsInText:markdown matches:", markdownMatches?.length || 0);
      result = result.replace(markdownRegex, `$1${newUrl}$2`);
      const htmlRegex = new RegExp(`(<img[^>]+src=["'])${escapedOldUrl}(["'][^>]*>)`, "gi");
      const htmlMatches = result.match(htmlRegex);
      debugLog("replaceUrlsInText:HTML matches:", htmlMatches?.length || 0);
      result = result.replace(htmlRegex, `$1${newUrl}$2`);
    }
  });
  return result;
}

async function updateContentMetadataWithMapping(sourceId: string, urlMapping: UrlMapping, maxImageSize?: number): Promise<void> {
  debugLog("updateContentMetadataWithMapping:updating", sourceId, "with", keys(urlMapping).length, "URL replacements");
  await mongooseClient.connect(debugLog);

  const doc = await contentMetadata.findById(sourceId).exec();
  if (!doc) {
    throw new Error(`ContentMetadata not found: ${sourceId}`);
  }

  const files = doc.files || [];
  const updatedFiles = files.map((file: any) => {
    const fileObj = file.toObject ? file.toObject() : file;
    if (fileObj.image && urlMapping[fileObj.image]) {
      const newUrl = urlMapping[fileObj.image];
      const fileName = newUrl.split("/").pop();
      return { ...fileObj, image: fileName };
    }
    return fileObj;
  });

  const updateData: any = {
    files: updatedFiles,
    rootFolder: RootFolder.carousels
  };

  if (doc.coverImage && urlMapping[doc.coverImage]) {
    const newUrl = urlMapping[doc.coverImage];
    updateData.coverImage = newUrl.split("/").pop();
  }

  if (maxImageSize > 0 && !doc.maxImageSize) {
    debugLog("updateContentMetadataWithMapping:setting maxImageSize to", maxImageSize);
    updateData.maxImageSize = maxImageSize;
  }

  debugLog("updateContentMetadataWithMapping:setting rootFolder to", RootFolder.carousels);
  await contentMetadata.findByIdAndUpdate(sourceId, updateData).exec();
  debugLog("updateContentMetadataWithMapping:updated successfully");
}

async function updatePageContentWithMapping(sourceId: string, urlMapping: UrlMapping): Promise<void> {
  debugLog("updatePageContentWithMapping:updating", sourceId, "with", keys(urlMapping).length, "URL replacements:", keys(urlMapping));
  await mongooseClient.connect(debugLog);

  const doc = await pageContent.findById(sourceId).exec();
  if (!doc) {
    debugLog("updatePageContentWithMapping:document not found:", sourceId);
    throw new Error(`PageContent not found: ${sourceId}`);
  }
  debugLog("updatePageContentWithMapping:found document:", doc.path);

  const docObj = doc.toObject ? doc.toObject() : doc;

  function updateColumnImages(column: any): any {
    const updatedColumn = { ...column };
    if (updatedColumn.imageSource && urlMapping[updatedColumn.imageSource]) {
      debugLog("updatePageContentWithMapping:replacing imageSource:", updatedColumn.imageSource, "->", urlMapping[updatedColumn.imageSource]);
      updatedColumn.imageSource = urlMapping[updatedColumn.imageSource];
    }
    if (updatedColumn.contentText) {
      const originalText = updatedColumn.contentText;
      updatedColumn.contentText = replaceUrlsInText(updatedColumn.contentText, urlMapping);
      if (originalText !== updatedColumn.contentText) {
        debugLog("updatePageContentWithMapping:contentText was modified");
      }
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

  const changedColumns = updatedRows.flatMap((row: any) =>
    (row.columns || []).filter((col: any) => col.imageSource && col.imageSource.startsWith("site-content"))
  );
  debugLog("updatePageContentWithMapping:columns with updated imageSource:", JSON.stringify(changedColumns.map((c: any) => ({ imageSource: c.imageSource })), null, 2));

  const updateResult = await pageContent.findByIdAndUpdate(sourceId, { $set: { rows: updatedRows } }, { new: true }).exec();
  debugLog("updatePageContentWithMapping:update result:", updateResult ? "document returned" : "no document returned");

  if (updateResult) {
    const verifyColumns = (updateResult.rows || []).flatMap((row: any) =>
      (row.columns || []).filter((col: any) => col.imageSource)
    );
    debugLog("updatePageContentWithMapping:verification - imageSource values after update:", JSON.stringify(verifyColumns.map((c: any) => ({ imageSource: c.imageSource })), null, 2));
  }
}

async function updateGroupEventWithMapping(sourceId: string, urlMapping: UrlMapping): Promise<void> {
  debugLog("updateGroupEventWithMapping:updating", sourceId, "with", keys(urlMapping).length, "URL replacements");
  await mongooseClient.connect(debugLog);

  const doc = await extendedGroupEvent.findById(sourceId).exec();
  if (!doc) {
    throw new Error(`ExtendedGroupEvent not found: ${sourceId}`);
  }

  const docObj = doc.toObject ? doc.toObject() : doc;
  const media = docObj.groupEvent?.media || [];

  const updatedMedia = media.map((mediaItem: any) => ({
    ...mediaItem,
    styles: (mediaItem.styles || []).map((style: any) => {
      if (style.url && urlMapping[style.url]) {
        return { ...style, url: urlMapping[style.url] };
      }
      return style;
    })
  }));

  const updateFields: any = {
    "groupEvent.media": updatedMedia
  };

  if (docObj.groupEvent?.description) {
    updateFields["groupEvent.description"] = replaceUrlsInText(docObj.groupEvent.description, urlMapping);
  }
  if (docObj.groupEvent?.additional_details) {
    updateFields["groupEvent.additional_details"] = replaceUrlsInText(docObj.groupEvent.additional_details, urlMapping);
  }

  await extendedGroupEvent.findByIdAndUpdate(sourceId, updateFields).exec();
  debugLog("updateGroupEventWithMapping:updated successfully");
}

async function updateDocumentWithMapping(
  sourceType: ImageMigrationSourceType,
  sourceId: string,
  urlMapping: UrlMapping,
  maxImageSize?: number
): Promise<void> {
  switch (sourceType) {
    case ImageMigrationSourceType.CONTENT_METADATA:
      await updateContentMetadataWithMapping(sourceId, urlMapping, maxImageSize);
      break;
    case ImageMigrationSourceType.PAGE_CONTENT:
      await updatePageContentWithMapping(sourceId, urlMapping);
      break;
    case ImageMigrationSourceType.GROUP_EVENT:
    case ImageMigrationSourceType.SOCIAL_EVENT:
      await updateGroupEventWithMapping(sourceId, urlMapping);
      break;
    default:
      throw new Error(`Unknown source type: ${sourceType}`);
  }
}

export async function migrateImages(
  request: ImageMigrationRequest,
  progressCallback?: ProgressCallback,
  isCancelled?: CancellationCheck
): Promise<ImageMigrationResult> {
  const timer = createProcessTimer("migrateImages", debugLog);
  debugLog("migrateImages:migrating", request.images.length, "images to", request.targetRootFolder);

  const migratedImages: ExternalImageReference[] = [];
  const failedImages: ExternalImageReference[] = [];

  const maxImageSize = request.maxImageSize || 0;

  const urlToImageRef = request.images.reduce((acc, img) => {
    if (!acc[img.currentUrl]) {
      acc[img.currentUrl] = img;
    }
    return acc;
  }, {} as Record<string, ExternalImageReference>);

  const uniqueUrls = keys(urlToImageRef);
  debugLog("migrateImages:found", uniqueUrls.length, "unique URLs from", request.images.length, "image references");

  const globalUrlMapping: UrlMapping = {};
  const failedUrls = new Set<string>();
  let uploadedCount = 0;

  const sendProgress = (currentImage: string, phase: "upload" | "update", errorMessage?: string) => {
    if (progressCallback) {
      const uploadWeight = 0.8;
      const updateWeight = 0.2;
      let percent: number;
      let processedImages: number;
      let successCount: number;
      let failureCount: number;

      if (phase === "upload") {
        percent = Math.round((uploadedCount / uniqueUrls.length) * uploadWeight * 100);
        processedImages = uploadedCount;
        successCount = keys(globalUrlMapping).length;
        failureCount = failedUrls.size;
      } else {
        const uploadPercent = uploadWeight * 100;
        const updatePercent = (migratedImages.length + failedImages.length) / request.images.length * updateWeight * 100;
        percent = Math.round(uploadPercent + updatePercent);
        processedImages = migratedImages.length + failedImages.length;
        successCount = migratedImages.length;
        failureCount = failedImages.length;
      }

      progressCallback({
        totalImages: phase === "upload" ? uniqueUrls.length : request.images.length,
        processedImages,
        successCount,
        failureCount,
        currentImage,
        percent: Math.min(percent, 100),
        errorMessage
      });
    }
  };

  uniqueUrls.forEach((url, index) => {
    debugLog("migrateImages:queued for upload:", index + 1, "/", uniqueUrls.length, url);
  });

  for (const url of uniqueUrls) {
    if (isCancelled?.()) {
      debugLog("migrateImages:cancellation requested, stopping upload phase");
      break;
    }
    try {
      debugLog("migrateImages:downloading unique image:", url);
      sendProgress(url, "upload");

      const { buffer: downloadedBuffer } = await downloadExternalImage(url);
      const fileName = extractFileNameFromUrl(url);

      const { buffer: finalBuffer, wasResized } = await resizeImageIfNeeded(downloadedBuffer, fileName, maxImageSize);
      if (wasResized) {
        debugLog("migrateImages:resized image from", humanFileSize(downloadedBuffer.length), "to", humanFileSize(finalBuffer.length));
      }

      const imageRef = urlToImageRef[url];
      const targetFolder = targetPathForImage(imageRef, request.targetRootFolder);
      debugLog("migrateImages:target folder for", url, "is", targetFolder, "based on source type", imageRef.sourceType, "sourcePath", imageRef.sourcePath);

      const newS3Url = await uploadToS3(finalBuffer, fileName, targetFolder);
      globalUrlMapping[url] = newS3Url;
      uploadedCount++;
      debugLog("migrateImages:uploaded:", url, "->", newS3Url);
      sendProgress(url, "upload");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog("migrateImages:failed to download/upload:", url, "error:", errorMessage);
      failedUrls.add(url);
      uploadedCount++;
      sendProgress(url, "upload", errorMessage);
    }
  }

  timer.log(`upload phase complete. Success: ${keys(globalUrlMapping).length}, Failed: ${failedUrls.size}`);

  const imagesByDocument = request.images.reduce((acc, image) => {
    const key = `${image.sourceType}:::${image.sourceId}`;
    if (!acc[key]) {
      acc[key] = { sourceType: image.sourceType, sourceId: image.sourceId, images: [] };
    }
    acc[key].images.push(image);
    return acc;
  }, {} as Record<string, { sourceType: ImageMigrationSourceType; sourceId: string; images: ExternalImageReference[] }>);

  const wasCancelledDuringUpload = isCancelled?.() || false;
  if (wasCancelledDuringUpload) {
    debugLog("migrateImages:cancelled during upload phase, will still save", keys(globalUrlMapping).length, "successfully uploaded images");
  }

  timer.log(`updating ${keys(imagesByDocument).length} documents`);

  for (const docGroup of values(imagesByDocument)) {
    const documentUrlMapping: UrlMapping = {};
    const documentImages = docGroup.images;

    documentImages.forEach(image => {
      if (globalUrlMapping[image.currentUrl]) {
        documentUrlMapping[image.currentUrl] = globalUrlMapping[image.currentUrl];
      }
    });

    if (keys(documentUrlMapping).length > 0) {
      try {
        debugLog("migrateImages:updating document", docGroup.sourceType, docGroup.sourceId, "with", keys(documentUrlMapping).length, "URL mappings");
        await updateDocumentWithMapping(docGroup.sourceType, docGroup.sourceId, documentUrlMapping, maxImageSize);
        debugLog("migrateImages:document updated successfully", docGroup.sourceId);

        documentImages.forEach(image => {
          if (globalUrlMapping[image.currentUrl]) {
            migratedImages.push({
              ...image,
              status: ImageMigrationStatus.MIGRATED,
              newS3Url: globalUrlMapping[image.currentUrl]
            });
          } else {
            failedImages.push({
              ...image,
              status: ImageMigrationStatus.FAILED,
              errorMessage: "Failed to download or upload image"
            });
          }
          sendProgress(image.currentUrl, "update");
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        debugLog("migrateImages:failed to update document:", docGroup.sourceId, "error:", errorMessage);
        documentImages.forEach(image => {
          failedImages.push({
            ...image,
            status: ImageMigrationStatus.FAILED,
            errorMessage
          });
          sendProgress(image.currentUrl, "update");
        });
      }
    } else {
      documentImages.forEach(image => {
        failedImages.push({
          ...image,
          status: ImageMigrationStatus.FAILED,
          errorMessage: "Failed to download or upload image"
        });
        sendProgress(image.currentUrl, "update");
      });
    }
  }

  timer.complete(`Success: ${migratedImages.length}, Failed: ${failedImages.length}${wasCancelledDuringUpload ? " (cancelled)" : ""}`);

  return {
    totalProcessed: migratedImages.length + failedImages.length,
    successCount: migratedImages.length,
    failureCount: failedImages.length,
    migratedImages,
    failedImages,
    cancelled: wasCancelledDuringUpload
  };
}
