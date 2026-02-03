import * as fs from "fs/promises";
import * as path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type S3UploadProgressCallback = (bucket: string, key: string) => unknown;

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
        ContentType: entry.endsWith(".gz") ? "application/gzip" : "application/octet-stream"
      }));
      if (onFileUploaded) {
        await onFileUploaded(bucket, key);
      }
    }
  }
}
