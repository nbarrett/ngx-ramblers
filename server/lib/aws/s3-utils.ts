import * as fs from "fs/promises";
import * as path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type S3UploadProgressCallback = (bucket: string, key: string) => unknown;

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

interface S3UploadItem {
  localPath: string;
  key: string;
  contentType: string;
  entry: string;
}

async function collectUploadItems(localDir: string, prefix: string): Promise<S3UploadItem[]> {
  const entries = await fs.readdir(localDir);
  const nested = await Promise.all(entries.map(async (entry): Promise<S3UploadItem[]> => {
    const localPath = path.join(localDir, entry);
    const stat = await fs.stat(localPath);
    const key = path.join(prefix, entry).replace(/\\/g, "/");
    if (stat.isDirectory()) {
      return collectUploadItems(localPath, key);
    }
    return [{ localPath, key, contentType: contentTypeFor(entry), entry }];
  }));
  return nested.flat();
}

export async function uploadDirectoryToS3(
  s3: S3Client,
  localDir: string,
  bucket: string,
  prefix: string,
  onFileUploaded?: S3UploadProgressCallback,
  concurrency: number = 20
): Promise<void> {
  const items = await collectUploadItems(localDir, prefix);
  const effectiveConcurrency = Math.max(1, concurrency);
  const state: { nextIndex: number; firstError: unknown } = { nextIndex: 0, firstError: undefined };

  const uploadOne = async (item: S3UploadItem): Promise<void> => {
    const fileContent = await fs.readFile(item.localPath);
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: item.key,
      Body: fileContent,
      ContentType: item.contentType
    }));
    if (onFileUploaded) {
      await onFileUploaded(bucket, item.key);
    }
  };

  const worker = async (): Promise<void> => {
    const index = state.nextIndex++;
    if (state.firstError !== undefined || index >= items.length) {
      return;
    }
    try {
      await uploadOne(items[index]);
    } catch (error) {
      if (state.firstError === undefined) {
        state.firstError = error;
      }
      return;
    }
    return worker();
  };

  const workerCount = Math.min(effectiveConcurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (state.firstError !== undefined) {
    throw state.firstError;
  }
}
