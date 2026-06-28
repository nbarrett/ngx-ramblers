import { dateTimeNowAsValue } from "../shared/dates";
import { spawn } from "child_process";
import debug from "debug";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as stringDecoder from "string_decoder";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { RamblersUploadJob } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import {
  RamblersUploadCredentials,
  IntegrationWorkerAwsCredentials,
  IntegrationWorkerCallbackConfig,
  IntegrationWorkerEventType,
  IntegrationWorkerProgressCallbackRequest,
  IntegrationWorkerReportUploadConfig,
  IntegrationWorkerResultCallbackRequest
} from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { prepareRamblersUploadJobFiles } from "./ramblers-upload-job-files";
import {
  clearRemoteRamblersUploadExecutionState,
  remoteRamblersUploadExecutionState,
  setRemoteRamblersUploadExecutionState
} from "./integration-worker-execution-state";
import { postRamblersUploadProgressCallback, postRamblersUploadResultCallback } from "./integration-worker-callback-client";
import { Status } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("integration-worker-runner"));
debugLog.enabled = true;
const decoder = new stringDecoder.StringDecoder("utf8");

async function safePostProgress(callback: IntegrationWorkerCallbackConfig, sharedSecret: string, payload: IntegrationWorkerProgressCallbackRequest): Promise<void> {
  try {
    await postRamblersUploadProgressCallback(callback, sharedSecret, payload);
  } catch (error) {
    debugLog("progress callback failed for jobId:", payload.jobId, "error:", (error as Error).message);
  }
}

async function safePostResult(callback: IntegrationWorkerCallbackConfig, sharedSecret: string, payload: IntegrationWorkerResultCallbackRequest): Promise<void> {
  try {
    await postRamblersUploadResultCallback(callback, sharedSecret, payload);
  } catch (error) {
    debugLog("result callback failed for jobId:", payload.jobId, "error:", (error as Error).message);
  }
}

function serenityReportLocalPath(): string {
  return path.resolve(process.cwd(), "target/site/serenity");
}

function playwrightReportLocalPath(): string {
  return path.resolve(process.cwd(), "target/site/playwright");
}

function serenityReportArchiveKey(keyPrefix: string): string {
  return `${keyPrefix}.zip`;
}

function countFilesInDirectory(directoryPath: string): number {
  return fs.readdirSync(directoryPath).reduce((count, entry) => {
    const entryPath = path.join(directoryPath, entry);
    const stats = fs.statSync(entryPath);
    if (stats.isDirectory()) {
      return count + countFilesInDirectory(entryPath);
    }
    return count + 1;
  }, 0);
}

function archiveTestReports(serenityPath: string, playwrightPath: string): Buffer {
  const archive = new AdmZip();
  archive.addLocalFolder(serenityPath);
  if (fs.existsSync(playwrightPath)) {
    archive.addLocalFolder(playwrightPath, "playwright");
  }
  return archive.toBuffer();
}

async function uploadSerenityReportToS3(
  jobId: string,
  reportUpload: IntegrationWorkerReportUploadConfig,
  awsCredentials: IntegrationWorkerAwsCredentials,
  callback: IntegrationWorkerCallbackConfig,
  sharedSecret: string
): Promise<boolean> {
  const serenityPath = serenityReportLocalPath();
  const playwrightPath = playwrightReportLocalPath();
  if (!fs.existsSync(serenityPath)) {
    debugLog("serenity report directory does not exist at:", serenityPath, "skipping S3 upload for jobId:", jobId);
    return false;
  }
  const playwrightIncluded = fs.existsSync(playwrightPath);
  const totalFiles = countFilesInDirectory(serenityPath) + (playwrightIncluded ? countFilesInDirectory(playwrightPath) : 0);
  const archiveKey = serenityReportArchiveKey(reportUpload.keyPrefix);

  const client = new S3Client({
    region: reportUpload.region,
    credentials: {
      accessKeyId: awsCredentials.accessKeyId,
      secretAccessKey: awsCredentials.secretAccessKey
    }
  });

  const startedAt = dateTimeNowAsValue();
  try {
    await safePostProgress(callback, sharedSecret, {
      jobId,
      type: IntegrationWorkerEventType.LIFECYCLE,
      payload: `Test report archive upload to S3 starting: ${totalFiles} files to s3://${reportUpload.bucket}/${archiveKey}${playwrightIncluded ? " (including Playwright artifacts)" : ""}`
    });
    const zipStart = dateTimeNowAsValue();
    const archiveBuffer = archiveTestReports(serenityPath, playwrightPath);
    const zipElapsed = dateTimeNowAsValue() - zipStart;
    await safePostProgress(callback, sharedSecret, {
      jobId,
      type: IntegrationWorkerEventType.LIFECYCLE,
      payload: `Test report archive built: ${totalFiles} files compressed into ${archiveBuffer.length} bytes in ${zipElapsed} ms; starting S3 PUT`
    });
    const putStart = dateTimeNowAsValue();
    await client.send(new PutObjectCommand({
      Bucket: reportUpload.bucket,
      Key: archiveKey,
      Body: archiveBuffer,
      ContentType: "application/zip"
    }));
    const putElapsed = dateTimeNowAsValue() - putStart;
    await safePostProgress(callback, sharedSecret, {
      jobId,
      type: IntegrationWorkerEventType.LIFECYCLE,
      payload: `Test report archive upload to S3 complete: zip ${zipElapsed} ms, PUT ${putElapsed} ms, total ${dateTimeNowAsValue() - startedAt} ms`
    });
    debugLog("uploaded test report archive to S3 for jobId:", jobId, "bucket:", reportUpload.bucket, "key:", archiveKey, "files:", totalFiles, "archiveBytes:", archiveBuffer.length, "zipMs:", zipElapsed, "putMs:", putElapsed, "elapsedMs:", dateTimeNowAsValue() - startedAt);
    return true;
  } catch (error) {
    await safePostProgress(callback, sharedSecret, {
      jobId,
      type: IntegrationWorkerEventType.LIFECYCLE,
      payload: `Test report archive upload to S3 failed for ${totalFiles} files: ${(error as Error).message}`
    });
    debugLog("failed to upload test report archive to S3 for jobId:", jobId, "key:", archiveKey, "error:", (error as Error).message);
    return false;
  } finally {
    client.destroy();
  }
}

export async function executeRamblersUploadJobOnWorker(
  job: RamblersUploadJob,
  credentials: RamblersUploadCredentials,
  callback: IntegrationWorkerCallbackConfig,
  sharedSecret: string,
  reportUpload?: IntegrationWorkerReportUploadConfig,
  awsCredentials?: IntegrationWorkerAwsCredentials
): Promise<void> {
  const jobStartedAt = dateTimeNowAsValue();
  const preparedFiles = prepareRamblersUploadJobFiles(job);
  process.env[Environment.RAMBLERS_METADATA_FILE] = preparedFiles.metadataPath;
  process.env[Environment.RAMBLERS_FEATURE] = job.data.feature;
  process.env[Environment.RAMBLERS_USERNAME] = credentials.userName;
  process.env[Environment.RAMBLERS_PASSWORD] = credentials.password;
  process.env[Environment.INTEGRATION_WORKER_CALLBACK_BASE_URL] = callback.baseUrl;
  process.env[Environment.INTEGRATION_WORKER_CALLBACK_PROGRESS_PATH] = callback.progressPath;
  process.env[Environment.INTEGRATION_WORKER_CALLBACK_RESULT_PATH] = callback.resultPath;
  process.env[Environment.INTEGRATION_WORKER_CALLBACK_SECRET] = sharedSecret;
  process.env[Environment.INTEGRATION_WORKER_JOB_ID] = job.jobId;
  setRemoteRamblersUploadExecutionState({
    callback,
    jobId: job.jobId,
    logStandardOut: true,
    sharedSecret
  });
  void safePostProgress(callback, sharedSecret, {
    jobId: job.jobId,
    type: IntegrationWorkerEventType.LIFECYCLE,
    payload: `Job execution started for ${job.data.fileName}`
  });
  const serenityStartedAt = dateTimeNowAsValue();
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
        type: IntegrationWorkerEventType.STANDARD_OUT,
        payload
      });
    });

    let reportStartAnnounced = false;
    subprocess.stderr.on("data", data => {
      const text = decoder.write(data);
      debugLog("worker stderr", text);
      if (!reportStartAnnounced && text.includes("[report]")) {
        reportStartAnnounced = true;
        const state = remoteRamblersUploadExecutionState();
        if (state) {
          const serenityElapsed = dateTimeNowAsValue() - serenityStartedAt;
          void safePostProgress(state.callback, state.sharedSecret, {
            jobId: state.jobId,
            type: IntegrationWorkerEventType.LIFECYCLE,
            payload: `Scenario execution complete [${formatElapsed(serenityElapsed)}]`
          });
          void safePostProgress(state.callback, state.sharedSecret, {
            jobId: state.jobId,
            type: IntegrationWorkerEventType.LIFECYCLE,
            payload: "Serenity report generation starting"
          });
        }
      }
    });

    subprocess.on("error", error => {
      void finishJob(job, callback, sharedSecret, reportUpload, awsCredentials, IntegrationWorkerEventType.ERROR, Status.ERROR, error.message, jobStartedAt)
        .finally(() => {
          clearRemoteRamblersUploadExecutionState();
          reject(error);
        });
    });

    subprocess.on("exit", code => {
      const status = code === 0 ? Status.SUCCESS : Status.ERROR;
      const type = code === 0 ? IntegrationWorkerEventType.COMPLETE : IntegrationWorkerEventType.ERROR;
      const elapsed = formatElapsed(dateTimeNowAsValue() - jobStartedAt);
      const payload = `Upload completed with ${status} for ${job.data.fileName}${code === 0 ? "" : ` with code ${code}`} [${elapsed}]`;
      void finishJob(job, callback, sharedSecret, reportUpload, awsCredentials, type, status, payload, jobStartedAt)
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

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s (${ms}ms)`;
}

async function finishJob(
  job: RamblersUploadJob,
  callback: IntegrationWorkerCallbackConfig,
  sharedSecret: string,
  reportUpload: IntegrationWorkerReportUploadConfig | undefined,
  awsCredentials: IntegrationWorkerAwsCredentials | undefined,
  type: IntegrationWorkerEventType.COMPLETE | IntegrationWorkerEventType.ERROR,
  status: string,
  payload: string,
  jobStartedAt: number
): Promise<void> {
  let reportKeyPrefix: string | undefined;
  let reportBucket: string | undefined;
  if (reportUpload && awsCredentials) {
    await safePostProgress(callback, sharedSecret, {
      jobId: job.jobId,
      type: IntegrationWorkerEventType.LIFECYCLE,
      payload: "Serenity report generation complete, uploading to S3"
    });
    const reportUploadStartedAt = dateTimeNowAsValue();
    const uploaded = await uploadSerenityReportToS3(job.jobId, reportUpload, awsCredentials, callback, sharedSecret);
    if (uploaded) {
      const reportUploadElapsed = formatElapsed(dateTimeNowAsValue() - reportUploadStartedAt);
      await safePostProgress(callback, sharedSecret, {
        jobId: job.jobId,
        type: IntegrationWorkerEventType.LIFECYCLE,
        payload: `Report upload to S3 complete [${reportUploadElapsed}]`
      });
      reportKeyPrefix = reportUpload.keyPrefix;
      reportBucket = reportUpload.bucket;
    }
  }
  const totalElapsed = formatElapsed(dateTimeNowAsValue() - jobStartedAt);
  await safePostResult(callback, sharedSecret, {
    jobId: job.jobId,
    type,
    payload: `${payload} total ${totalElapsed}`,
    status,
    reportKeyPrefix,
    reportBucket
  });
}
