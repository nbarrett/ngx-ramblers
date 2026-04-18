import { ChildProcess, spawn } from "child_process";
import { envConfig } from "../env-config/env-config";
import * as auditParser from "./ramblers-audit-parser";
import debug from "debug";
import { Status } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import WebSocket from "ws";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import * as auditNotifier from "./ramblers-upload-audit-notifier";
import fs from "fs";
import * as stringDecoder from "string_decoder";
import { stringify } from "csv-stringify/sync";
import { downloadStatusManager } from "./download-status-manager";
import { ServerDownloadStatusType } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { WalkUploadMetadata } from "../models/walk-upload-metadata";
import { RamblersUploadJob } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { RamblersUploadCredentials } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-walk-upload"));
debugLog.enabled = true;
const path = "/tmp/ramblers/";
const StringDecoder = stringDecoder.StringDecoder;
const decoder = new StringDecoder("utf8");

export type RamblersUploadSpawnListener = (subprocess: ChildProcess) => void;

export async function executeRamblersUploadJob(ws: WebSocket, job: RamblersUploadJob, credentials?: RamblersUploadCredentials, onSpawn?: RamblersUploadSpawnListener): Promise<void> {
  debugLog("request made with ramblers upload job:", job.jobId, job.data.fileName);

  const fileName = job.data.fileName;
  const csvData = stringify(job.data.rows, {header: true, columns: job.data.headings});
  const filePath = path + fileName;
  const metadataPath = path + fileName.replace(".csv", "-metadata.json");
  debugLog("saving CSV to:", filePath);
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }

  const metadata: WalkUploadMetadata = {
    fileName: filePath,
    walkCount: job.data.rows.length,
    ramblersUser: job.data.ramblersUser,
    walkDeletions: job.data.walkIdDeletionList,
    walkUploads: job.data.walkIdUploadList || [],
    walkCancellations: job.data.walkCancellations,
    walkUncancellations: job.data.walkUncancellations || []
  };

  try {
    fs.writeFileSync(filePath, csvData);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  } catch (error) {
    auditNotifier.reportErrorAndClose(error, ws);
    return;
  }

  downloadStatusManager.startDownload(fileName);
  process.env[Environment.RAMBLERS_METADATA_FILE] = metadataPath;
  process.env[Environment.RAMBLERS_FEATURE] = job.data.feature;
  process.env[Environment.RAMBLERS_USERNAME] = credentials?.userName || job.data.ramblersUser;
  if (credentials?.password) {
    process.env[Environment.RAMBLERS_PASSWORD] = credentials.password;
  }
  debugLog(
    "pre-spawn credentials check:",
    "RAMBLERS_USERNAME set:", !!process.env[Environment.RAMBLERS_USERNAME],
    "RAMBLERS_PASSWORD set:", !!process.env[Environment.RAMBLERS_PASSWORD],
    "RAMBLERS_FEATURE:", process.env[Environment.RAMBLERS_FEATURE],
    "RAMBLERS_METADATA_FILE:", process.env[Environment.RAMBLERS_METADATA_FILE]
  );
  auditNotifier.registerUploadStart(fileName, ws, job.jobId);
  auditNotifier.sendAudit(ws, {
    messageType: MessageType.PROGRESS,
    status: Status.INFO,
    auditMessage: `PLAYWRIGHT_HEADLESS=${process.env[Environment.PLAYWRIGHT_HEADLESS] || "default"} BASE_URL=${process.env[Environment.BASE_URL] || "not set"} CHROME_VERSION=${process.env[Environment.CHROME_VERSION] || "not set"}`,
    parserFunction: auditParser.parseStandardOut
  }, job.jobId);
  debugLog("spawning serenity process with Playwright for baseUrl:", process.env[Environment.BASE_URL], "Chrome version hint:", process.env[Environment.CHROME_VERSION]);
  const subprocess = spawn("npm", ["run", "serenity"], {
    detached: true,
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    env: {...process.env, NODE_OPTIONS: "--max_old_space_size=128"}
  });
  debugLog("serenity subprocess spawned pid=", subprocess.pid, "for job", job.jobId);
  onSpawn?.(subprocess);

  let stdoutChunkCount = 0;
  subprocess.unref();
  subprocess.stdout.on("data", (data: any) => {
    const auditMessage = decoder.write(data);
    stdoutChunkCount++;
    const preview = auditMessage.length > 200 ? auditMessage.slice(0, 200) + "…" : auditMessage;
    debugLog(`stdout chunk #${stdoutChunkCount} (${auditMessage.length} chars) job=${job.jobId}:`, preview.replace(/\n/g, "\\n"));
    downloadStatusManager.updateActivity();
    if (auditNotifier.queryCurrentUploadSession(job.jobId)?.logStandardOut) {
      auditNotifier.sendAudit(ws, {
        messageType: MessageType.PROGRESS,
        status: Status.INFO,
        auditMessage,
        parserFunction: auditParser.parseStandardOut
      }, job.jobId);
    }
  });

  subprocess.stderr.on("data", (data: any) => {
    const message = decoder.write(data);
    debugLog(`stderr job=${job.jobId}:`, message.replace(/\n/g, "\\n"));
  });

  subprocess.on("error", (error: any) => {
    debugLog(`subprocess error job=${job.jobId}:`, error.message);
    downloadStatusManager.completeDownload(ServerDownloadStatusType.ERROR);
    auditNotifier.reportErrorAndClose(error, ws);
  });

  subprocess.on("exit", (code: number, signal) => {
    const status: Status = code === 0 ? Status.SUCCESS : Status.ERROR;
    const codeSuffix = code === 0 ? "" : ` with code ${code}`;
    const signalSuffix = signal ? ` signal ${signal}` : "";
    const auditMessage = `Upload completed with ${status} for ${fileName}${codeSuffix}${signalSuffix}`;
    debugLog(`exit job=${job.jobId} code=${code} signal=${signal || "none"} chunks=${stdoutChunkCount}`);
    downloadStatusManager.completeDownload(status === Status.SUCCESS ? ServerDownloadStatusType.COMPLETED : ServerDownloadStatusType.ERROR);
    auditNotifier.sendAudit(ws, {
      messageType: MessageType.COMPLETE,
      auditMessage,
      parserFunction: auditParser.parseExit,
      status
    }, job.jobId);
  });

  subprocess.on("close", (code, signal) => {
    debugLog(`close job=${job.jobId} code=${code} signal=${signal || "none"}`);
  });

}
