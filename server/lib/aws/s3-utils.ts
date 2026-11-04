import * as fs from "fs/promises";
import {createReadStream} from "fs";
import * as path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import debug from "debug";
import {envConfig} from "../env-config/env-config";
import {runWithRetries} from "../shared/run-with-retries";
import {S3UploadItem, S3UploadProgressCallback} from "./s3-utils.model";

const debugLog = debug(envConfig.logNamespace("s3-directory-upload"));

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gz": "application/gzip",
  ".tar": "application/x-tar",
  ".map": "application/json; charset=utf-8"
};

function contentTypeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return CONTENT_TYPE_BY_EXTENSION[ext] || "application/octet-stream";
}

async function collectUploadItems(localDir: string, prefix: string): Promise<S3UploadItem[]> {
  const entries = await fs.readdir(localDir);
  const nested = await Promise.all(entries.map(async (entry): Promise<S3UploadItem[]> => {
    const localPath = path.join(localDir, entry);
    const stat = await fs.stat(localPath);
    const key = path.join(prefix, entry).replace(/\\/g, "/");
    if (stat.isDirectory()) {
      return collectUploadItems(localPath, key);
    } else {
      return [{ localPath, key, contentType: contentTypeFor(entry), contentLength: stat.size }];
    }
  }));
  return nested.flat();
}

export async function uploadDirectoryToS3(
  s3: S3Client,
  localDir: string,
  bucket: string,
  prefix: string,
  onFileUploaded?: S3UploadProgressCallback,
  concurrency: number = 1
): Promise<void> {
  const items = await collectUploadItems(localDir, prefix);
  const effectiveConcurrency = Math.max(1, Math.floor(Number.isFinite(concurrency) ? concurrency : 1));
  const state = {nextIndex: 0, failed: false, firstError: null as unknown};

  const uploadOne = async (item: S3UploadItem): Promise<void> => {
    await runWithRetries(async () => {
      const body = createReadStream(item.localPath, {highWaterMark: 64 * 1024});
      try {
        await s3.send(new PutObjectCommand({Bucket: bucket, Key: item.key, Body: body,
          ContentLength: item.contentLength, ContentType: item.contentType}));
      } finally {
        body.destroy();
      }
    }, 3, 250, (attempt, error) => debugLog("Retrying upload of %s after attempt %d: %s", item.key, attempt, error.message));
    if (onFileUploaded) {
      await onFileUploaded(bucket, item.key);
    }
  };

  const worker = async (): Promise<void> => {
    const index = state.nextIndex++;
    if (!state.failed && index < items.length) {
      try {
        await uploadOne(items[index]);
      } catch (error) {
        if (!state.failed) {
          state.failed = true;
          state.firstError = error;
        }
      }
      await worker();
    }
  };

  const workerCount = Math.min(effectiveConcurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (state.failed) {
    throw state.firstError;
  }
}
