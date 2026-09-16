import {PutObjectCommand, S3} from "@aws-sdk/client-s3";
import {RootFolder} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {contentTypeFrom, extensionFrom} from "../aws/aws-utils";
import {generateUid} from "../shared/string-utils";
import {adminConfigFromEnvironment} from "../environment-setup/aws-setup";
import {runWithRetries} from "../shared/run-with-retries";
import debug from "debug";
import {envConfig} from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("migration-file-upload"));
const UPLOAD_ATTEMPTS = 3;
const UPLOAD_BACKOFF_MS = 2000;

const clientCache: {client?: S3} = {};

function s3Client(): S3 {
  if (!clientCache.client) {
    const admin = adminConfigFromEnvironment();
    clientCache.client = admin
      ? new S3({region: admin.region, credentials: {accessKeyId: admin.accessKeyId, secretAccessKey: admin.secretAccessKey}})
      : new S3({});
  }
  return clientCache.client;
}

export async function uploadMigrationBufferToS3(bucket: string, sourceName: string, buffer: Buffer, rootFolder: string = RootFolder.siteContent): Promise<string> {
  const fileName = generateUid() + extensionFrom(sourceName);
  const awsFileName = `${rootFolder}/${fileName}`;
  await runWithRetries(() => s3Client().send(new PutObjectCommand({Bucket: bucket, Key: awsFileName, Body: buffer, ContentType: contentTypeFrom(sourceName)})),
    UPLOAD_ATTEMPTS, UPLOAD_BACKOFF_MS, (attempt, error) => debugLog("upload of %s failed on attempt %d, retrying: %s", awsFileName, attempt, error.message));
  return awsFileName;
}
