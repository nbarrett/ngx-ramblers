import { spawn } from "child_process";
import { RamblersWalksUploadRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
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
import { Environment } from "../env-config/environment-model";
import { WalkUploadMetadata } from "../models/walk-upload-metadata";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-walk-upload"));
debugLog.enabled = true;
const path = "/tmp/ramblers/";
const StringDecoder = stringDecoder.StringDecoder;
const decoder = new StringDecoder("utf8");

export async function uploadWalks(ws: WebSocket, walksUploadRequest: RamblersWalksUploadRequest): Promise<void> {
  const fileName = walksUploadRequest.fileName;
  debugLog("upload requested for:", fileName, "with", walksUploadRequest.rows.length, "walk(s)");
  const canStart = downloadStatusManager.canStartNewDownload();

  if (!canStart.allowed) {
    const error = new Error(canStart.reason || "Another download is in progress");
    auditNotifier.reportErrorAndClose(error, ws);
    return;
  }

  const csvData = stringify(walksUploadRequest.rows, {header: true, columns: walksUploadRequest.headings});
  const filePath = path + fileName;
  const metadataPath = path + fileName.replace(".csv", "-metadata.json");
  debugLog("saving CSV to:", filePath);
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }

  const metadata: WalkUploadMetadata = {
    fileName: filePath,
    walkCount: walksUploadRequest.rows.length,
    ramblersUser: walksUploadRequest.ramblersUser,
    walkDeletions: walksUploadRequest.walkIdDeletionList,
    walkUploads: walksUploadRequest.walkIdUploadList || [],
    walkCancellations: walksUploadRequest.walkCancellations,
    walkUncancellations: walksUploadRequest.walkUncancellations || []
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
  process.env[Environment.RAMBLERS_FEATURE] = "walks-upload.ts";
  auditNotifier.registerUploadStart(fileName, ws);
  auditNotifier.sendAudit(ws, {
    messageType: MessageType.PROGRESS,
    status: Status.INFO,
    auditMessage: `CHROME_BIN=${process.env[Environment.CHROME_BIN] || "not set"} CHROMEDRIVER_PATH=${process.env[Environment.CHROMEDRIVER_PATH] || "not set"} CHROME_VERSION=${process.env[Environment.CHROME_VERSION] || "not set"}`,
    parserFunction: auditParser.parseStandardOut
  });
  debugLog("spawning serenity process with ChromeDriver:", process.env[Environment.CHROMEDRIVER_PATH], "Chrome:", process.env[Environment.CHROME_VERSION]);
  const subprocess = spawn("npm", ["run", "serenity"], {
    detached: true,
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    env: {...process.env, NODE_OPTIONS: "--max_old_space_size=128"}
  });

  subprocess.unref();
  subprocess.stdout.on("data", (data: any) => {
    const auditMessage = decoder.write(data);
    downloadStatusManager.updateActivity();
    if (auditNotifier.queryCurrentUploadSession().logStandardOut) {
      auditNotifier.sendAudit(ws, {
        messageType: MessageType.PROGRESS,
        status: Status.INFO,
        auditMessage,
        parserFunction: auditParser.parseStandardOut
      });
    }
  });

  subprocess.stderr.on("data", (data: any) => {
    const message = decoder.write(data);
    debugLog("stderr:", message);
  });

  subprocess.on("error", (error: any) => {
    debugLog(`Subprocess error: ${error.message}`);
    downloadStatusManager.completeDownload(ServerDownloadStatusType.ERROR);
    auditNotifier.reportErrorAndClose(error, ws);
  });

  subprocess.on("exit", (code: number) => {
    const status: Status = code === 0 ? Status.SUCCESS : Status.ERROR;
    const codeSuffix = code === 0 ? "" : ` with code ${code}`;
    const auditMessage = `Upload completed with ${status} for ${fileName}${codeSuffix}`;
    debugLog(auditMessage);
    downloadStatusManager.completeDownload(status === Status.SUCCESS ? ServerDownloadStatusType.COMPLETED : ServerDownloadStatusType.ERROR);
    auditNotifier.sendAudit(ws, {
      messageType: MessageType.COMPLETE,
      auditMessage,
      parserFunction: auditParser.parseExit,
      status
    });
  });

  subprocess.on("close", (code, signal) => {
    if (code !== 0) {
      debugLog(`process closed with code ${code}${signal ? ` signal ${signal}` : ""}`);
    }
  });

}
