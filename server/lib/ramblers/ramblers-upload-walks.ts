import { RamblersWalksUploadRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { envConfig } from "../env-config/env-config";
import * as auditParser from "./ramblers-audit-parser";
import debug from "debug";
import { Status } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import WebSocket from "ws";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import * as auditNotifier from "./ramblers-upload-audit-notifier";
import * as fs from "fs";
import * as stringDecoder from "string_decoder";
import json2csv from "json2csv";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-walk-upload"));
debugLog.enabled = false;
const debugNoLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-walk-upload-no-log"));
debugNoLog.enabled = false;
const path = "/tmp/ramblers/";
const StringDecoder = stringDecoder.StringDecoder;
const decoder = new StringDecoder("utf8");

export async function uploadWalks(ws: WebSocket, walksUploadRequest: RamblersWalksUploadRequest): Promise<void> {
  debugLog("request made with walksUploadRequest:", walksUploadRequest);
  const csvData = json2csv({data: walksUploadRequest.rows, fields: walksUploadRequest.headings});
  const fileName = walksUploadRequest.fileName;
  const filePath = path + fileName;
  debugLog("csv data:", csvData, "filePath:", filePath);
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }

  try {
    fs.writeFileSync(filePath, csvData);
  } catch (error) {
    auditNotifier.reportErrorAndClose(error, ws);
  }
  debugLog("file", filePath, "saved");

  process.env.RAMBLERS_USER = walksUploadRequest.ramblersUser;
  process.env.RAMBLERS_DELETE_WALKS = walksUploadRequest.walkIdDeletionList.join(",");
  process.env.RAMBLERS_FILENAME = filePath;
  process.env.RAMBLERS_WALKCOUNT = walksUploadRequest.rows.length.toString();
  process.env.RAMBLERS_FEATURE = "walks-upload.ts";
  const spawn = require("child_process").spawn;
  auditNotifier.registerUploadStart(fileName, ws);
  debugLog("Running RAMBLERS_FEATURE:", process.env.RAMBLERS_FEATURE,
    "CHROMEDRIVER_PATH:", process.env.CHROMEDRIVER_PATH,
    "CHROME_BIN:", process.env.CHROME_BIN,
    "CHROME_VERSION:", process.env.CHROME_VERSION);
  const subprocess = spawn("npm", ["run", "serenity"], {
    detached: true,
    stdio: ["pipe", "pipe", "pipe", "ipc"]
  });

  subprocess.unref();
  subprocess.stdout.on("data", (data: any) => {
    const auditMessage = decoder.write(data);
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
    auditNotifier.reportErrorAndClose(error, ws);
  });

  subprocess.on("exit", (code: number, signal) => {
    const status: Status = code === 0 ? Status.SUCCESS : Status.ERROR;
    const codeSuffix = code === 0 ? "" : ` with code ${code}`;
    const auditMessage = `Upload completed with ${status} for ${fileName}${codeSuffix}`;
    const signalMessage = signal ? `Subprocess exit: Process terminated by signal: ${signal}` : `Process exited with code: ${code}`;
    debugLog(signalMessage);
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
