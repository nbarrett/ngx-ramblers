import { spawn } from "child_process";
import debug from "debug";
import * as stringDecoder from "string_decoder";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../env-config/environment-model";
import { RamblersUploadJob } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { RamblersUploadCredentials, RamblersUploadWorkerCallbackConfig, RamblersUploadWorkerEventType, RamblersUploadWorkerProgressCallbackRequest, RamblersUploadWorkerResultCallbackRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-worker.model";
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

export async function executeRamblersUploadJobOnWorker(job: RamblersUploadJob, credentials: RamblersUploadCredentials, callback: RamblersUploadWorkerCallbackConfig, sharedSecret: string): Promise<void> {
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
      const state = remoteRamblersUploadExecutionState();
      if (state) {
        void safePostResult(state.callback, state.sharedSecret, {
          jobId: state.jobId,
          type: RamblersUploadWorkerEventType.ERROR,
          payload: error.message,
          status: Status.ERROR
        });
      }
      clearRemoteRamblersUploadExecutionState();
      reject(error);
    });

    subprocess.on("exit", code => {
      const state = remoteRamblersUploadExecutionState();
      const status = code === 0 ? Status.SUCCESS : Status.ERROR;

      if (state) {
        void safePostResult(state.callback, state.sharedSecret, {
          jobId: state.jobId,
          type: code === 0 ? RamblersUploadWorkerEventType.COMPLETE : RamblersUploadWorkerEventType.ERROR,
          payload: `Upload completed with ${status} for ${job.data.fileName}${code === 0 ? "" : ` with code ${code}`}`,
          status
        });
      }

      clearRemoteRamblersUploadExecutionState();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Ramblers upload worker exited with code ${code}`));
      }
    });
  });
}
