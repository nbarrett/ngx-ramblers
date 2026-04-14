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

export async function uploadDirectoryToS3(
  s3: S3Client,
  localDir: string,
  bucket: string,
  prefix: string,
  onFileUploaded?: S3UploadProgressCallback
): Promise<void> {
  const entries = await fs.readdir(localDir);
  for (const entry of entries) {
    const localPath = path.join(localDir, entry);
    const stat = await fs.stat(localPath);
    const key = path.join(prefix, entry).replace(/\\/g, "/");

    if (stat.isDirectory()) {
      await uploadDirectoryToS3(s3, localPath, bucket, key, onFileUploaded);
    } else {
      const fileContent = await fs.readFile(localPath);
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileContent,
        ContentType: contentTypeFor(entry)
      }));
      if (onFileUploaded) {
        await onFileUploaded(bucket, key);
      }
    }
  }
}
