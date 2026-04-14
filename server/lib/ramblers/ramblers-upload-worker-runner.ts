import { spawn } from "child_process";
import debug from "debug";
import fs from "fs";
import path from "path";
import { S3Client } from "@aws-sdk/client-s3";
import * as stringDecoder from "string_decoder";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../env-config/environment-model";
import { uploadDirectoryToS3 } from "../aws/s3-utils";
import { RamblersUploadJob } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import {
  RamblersUploadCredentials,
  RamblersUploadWorkerAwsCredentials,
  RamblersUploadWorkerCallbackConfig,
  RamblersUploadWorkerEventType,
  RamblersUploadWorkerProgressCallbackRequest,
  RamblersUploadWorkerReportUploadConfig,
  RamblersUploadWorkerResultCallbackRequest
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-worker.model";
import { prepareRamblersUploadJobFiles } from "./ramblers-upload-job-files";
import {
  clearRemoteRamblersUploadExecutionState,
  remoteRamblersUploadExecutionState,
  setRemoteRamblersUploadExecutionState
} from "./ramblers-upload-worker-execution-state";
import { postRamblersUploadProgressCallback, postRamblersUploadResultCallback } from "./ramblers-upload-worker-callback-client";
import { Status } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-upload-worker-runner"));
debugLog.enabled = true;
const decoder = new stringDecoder.StringDecoder("utf8");

async function safePostProgress(callback: RamblersUploadWorkerCallbackConfig, sharedSecret: string, payload: RamblersUploadWorkerProgressCallbackRequest): Promise<void> {
  try {
    await postRamblersUploadProgressCallback(callback, sharedSecret, payload);
  } catch (error) {
    debugLog("progress callback failed for jobId:", payload.jobId, "error:", (error as Error).message);
  }
}

async function safePostResult(callback: RamblersUploadWorkerCallbackConfig, sharedSecret: string, payload: RamblersUploadWorkerResultCallbackRequest): Promise<void> {
  try {
    await postRamblersUploadResultCallback(callback, sharedSecret, payload);
  } catch (error) {
    debugLog("result callback failed for jobId:", payload.jobId, "error:", (error as Error).message);
  }
}

function serenityReportLocalPath(): string {
  return path.resolve(process.cwd(), "target/site/serenity");
}

async function uploadSerenityReportToS3(jobId: string, reportUpload: RamblersUploadWorkerReportUploadConfig, awsCredentials: RamblersUploadWorkerAwsCredentials): Promise<boolean> {
  const reportPath = serenityReportLocalPath();
  if (!fs.existsSync(reportPath)) {
    debugLog("serenity report directory does not exist at:", reportPath, "skipping S3 upload for jobId:", jobId);
    return false;
  }

  const client = new S3Client({
    region: reportUpload.region,
    credentials: {
      accessKeyId: awsCredentials.accessKeyId,
      secretAccessKey: awsCredentials.secretAccessKey
    }
  });

  let fileCount = 0;
  const startedAt = Date.now();
  try {
    await uploadDirectoryToS3(
      client,
      reportPath,
      reportUpload.bucket,
      reportUpload.keyPrefix,
      () => { fileCount += 1; }
    );
    debugLog("uploaded serenity report to S3 for jobId:", jobId, "bucket:", reportUpload.bucket, "prefix:", reportUpload.keyPrefix, "files:", fileCount, "elapsedMs:", Date.now() - startedAt);
    return true;
  } catch (error) {
    debugLog("failed to upload serenity report to S3 for jobId:", jobId, "error:", (error as Error).message);
    return false;
  } finally {
    client.destroy();
  }
}

export async function executeRamblersUploadJobOnWorker(
  job: RamblersUploadJob,
  credentials: RamblersUploadCredentials,
  callback: RamblersUploadWorkerCallbackConfig,
  sharedSecret: string,
  reportUpload?: RamblersUploadWorkerReportUploadConfig,
  awsCredentials?: RamblersUploadWorkerAwsCredentials
): Promise<void> {
  const preparedFiles = prepareRamblersUploadJobFiles(job);
  process.env[Environment.RAMBLERS_METADATA_FILE] = preparedFiles.metadataPath;
  process.env[Environment.RAMBLERS_FEATURE] = job.data.feature;
  process.env[Environment.RAMBLERS_USERNAME] = credentials.userName;
  process.env[Environment.RAMBLERS_PASSWORD] = credentials.password;
  setRemoteRamblersUploadExecutionState({
    callback,
    jobId: job.jobId,
    logStandardOut: true,
    sharedSecret
  });
  const subprocess = spawn("npm", ["run", "serenity"], {
    stdio: ["pipe", "pipe", "pipe", "ipc"]
  });
  await new Promise<void>((resolve, reject) => {
    subprocess.stdout.on("data", data => {
      const state = remoteRamblersUploadExecutionState();

      if (!state?.logStandardOut) {
        return;
      }

      const payload = decoder.write(data);
      void safePostProgress(state.callback, state.sharedSecret, {
        jobId: state.jobId,
        type: RamblersUploadWorkerEventType.STANDARD_OUT,
        payload
      });
    });

    subprocess.stderr.on("data", data => {
      debugLog("worker stderr", decoder.write(data));
    });

    subprocess.on("error", error => {
      void finishJob(job, callback, sharedSecret, reportUpload, awsCredentials, RamblersUploadWorkerEventType.ERROR, Status.ERROR, error.message)
        .finally(() => {
          clearRemoteRamblersUploadExecutionState();
          reject(error);
        });
    });

    subprocess.on("exit", code => {
      const status = code === 0 ? Status.SUCCESS : Status.ERROR;
      const type = code === 0 ? RamblersUploadWorkerEventType.COMPLETE : RamblersUploadWorkerEventType.ERROR;
      const payload = `Upload completed with ${status} for ${job.data.fileName}${code === 0 ? "" : ` with code ${code}`}`;
      void finishJob(job, callback, sharedSecret, reportUpload, awsCredentials, type, status, payload)
        .finally(() => {
          clearRemoteRamblersUploadExecutionState();
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Ramblers upload worker exited with code ${code}`));
          }
        });
    });
  });
}

async function finishJob(
  job: RamblersUploadJob,
  callback: RamblersUploadWorkerCallbackConfig,
  sharedSecret: string,
  reportUpload: RamblersUploadWorkerReportUploadConfig | undefined,
  awsCredentials: RamblersUploadWorkerAwsCredentials | undefined,
  type: RamblersUploadWorkerEventType.COMPLETE | RamblersUploadWorkerEventType.ERROR,
  status: string,
  payload: string
): Promise<void> {
  let reportKeyPrefix: string | undefined;
  let reportBucket: string | undefined;
  if (reportUpload && awsCredentials) {
    const uploaded = await uploadSerenityReportToS3(job.jobId, reportUpload, awsCredentials);
    if (uploaded) {
      reportKeyPrefix = reportUpload.keyPrefix;
      reportBucket = reportUpload.bucket;
    }
  }
  await safePostResult(callback, sharedSecret, {
    jobId: job.jobId,
    type,
    payload,
    status,
    reportKeyPrefix,
    reportBucket
  });
}
