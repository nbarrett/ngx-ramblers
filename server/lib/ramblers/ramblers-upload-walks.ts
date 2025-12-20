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
import json2csv from "json2csv";
import { downloadStatusManager } from "./download-status-manager";
import { ServerDownloadStatusType } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { Environment } from "../env-config/environment-model";
import { WalkUploadMetadata } from "../models/walk-upload-metadata";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-walk-upload"));
debugLog.enabled = true;
const debugNoLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-walk-upload-no-log"));
debugNoLog.enabled = false;
const path = "/tmp/ramblers/";
const StringDecoder = stringDecoder.StringDecoder;
const decoder = new StringDecoder("utf8");

export async function uploadWalks(ws: WebSocket, walksUploadRequest: RamblersWalksUploadRequest): Promise<void> {
  debugLog("request made with walksUploadRequest:", walksUploadRequest);

  const fileName = walksUploadRequest.fileName;
  const canStart = downloadStatusManager.canStartNewDownload();

  if (!canStart.allowed) {
    const error = new Error(canStart.reason || "Another download is in progress");
    auditNotifier.reportErrorAndClose(error, ws);
    return;
  }

  const csvData = json2csv({data: walksUploadRequest.rows, fields: walksUploadRequest.headings});
  const filePath = path + fileName;
  const metadataPath = path + fileName.replace(".csv", "-metadata.json");
  debugLog("csv data:", csvData, "filePath:", filePath);
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

  const fileStats = fs.statSync(filePath);
  const csvLines = csvData.split("\n");
  const preview = csvLines.slice(0, 3).join("\n");

  debugLog("=".repeat(80));
  debugLog("CSV FILE SAVED FOR UPLOAD:");
  debugLog("File path:", filePath);
  debugLog("File size:", fileStats.size, "bytes");
  debugLog("Number of walks:", walksUploadRequest.rows.length);
  debugLog("Number of CSV lines:", csvLines.length);
  debugLog("CSV Preview (first 3 lines):");
  debugLog(preview);
  debugLog("=".repeat(80));
  debugLog("metadata", metadataPath, "saved");
  downloadStatusManager.startDownload(fileName);
  process.env[Environment.RAMBLERS_METADATA_FILE] = metadataPath;
  process.env[Environment.RAMBLERS_FEATURE] = "walks-upload.ts";
  const spawn = require("child_process").spawn;
  auditNotifier.registerUploadStart(fileName, ws);
  debugLog("Running RAMBLERS_FEATURE:", process.env[Environment.RAMBLERS_FEATURE],
    "CHROMEDRIVER_PATH:", process.env[Environment.CHROMEDRIVER_PATH],
    "CHROME_BIN:", process.env[Environment.CHROME_BIN],
    "CHROME_VERSION:", process.env[Environment.CHROME_VERSION]);
  const subprocess = spawn("npm", ["run", "serenity"], {
    detached: true,
    stdio: ["pipe", "pipe", "pipe", "ipc"]
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
    const auditMessage = decoder.write(data);
    debugNoLog("Not persisting Subprocess stderr:", auditMessage);
  });

  subprocess.on("error", (error: any) => {
    debugLog(`Subprocess error: ${error.message}`);
    downloadStatusManager.completeDownload(ServerDownloadStatusType.ERROR);
    auditNotifier.reportErrorAndClose(error, ws);
  });

  subprocess.on("exit", (code: number, signal) => {
    const status: Status = code === 0 ? Status.SUCCESS : Status.ERROR;
    const codeSuffix = code === 0 ? "" : ` with code ${code}`;
    const auditMessage = `Upload completed with ${status} for ${fileName}${codeSuffix}`;
    const signalMessage = signal ? `Subprocess exit: Process terminated by signal: ${signal}` : `Process exited with code: ${code}`;
    debugLog(signalMessage);
    downloadStatusManager.completeDownload(status === Status.SUCCESS ? ServerDownloadStatusType.COMPLETED : ServerDownloadStatusType.ERROR);
    auditNotifier.sendAudit(ws, {
      messageType: MessageType.COMPLETE,
      auditMessage,
      parserFunction: auditParser.parseExit,
      status
    });
  });

  subprocess.on("close", (code, signal) => {
    debugLog(`NEW Process fully closed with code ${code} and signal ${signal}`);
  });

  subprocess.on("message", (msg: any) => {
    debugLog(`NEW IPC message from subprocess: ${JSON.stringify(msg)}`);
  });

}
