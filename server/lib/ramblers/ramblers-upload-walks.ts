import {
  RamblersWalksUploadRequest,
  RecordCounter
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { envConfig } from "../env-config/env-config";
import * as auditParser from "./ramblers-audit-parser";
import debug from "debug";
import { ramblersUploadAudit } from "../mongo/models/ramblers-upload-audit";
import * as mongooseClient from "../mongo/mongoose-client";
import {
  AuditRamblersUploadParams,
  ParsedRamblersUploadAudit,
  RamblersUploadAudit,
  Status
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { momentNowAsValue } from "../shared/dates";
import WebSocket from "ws";
import {
  MessageType,
  RamblersUploadAuditProgressResponse
} from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import fs = require("fs");
import stringDecoder = require("string_decoder");
import json2csv = require("json2csv");

const debugLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-walk-upload"));
debugLog.enabled = false;
const path = "/tmp/ramblers/";
const StringDecoder = stringDecoder.StringDecoder;
const decoder = new StringDecoder("utf8");

export async function uploadWalks(ws: WebSocket, walksUploadRequest: RamblersWalksUploadRequest): Promise<void> {
  debugLog("request made with walksUploadRequest:", walksUploadRequest);
  const csvData = json2csv({data: walksUploadRequest.rows, fields: walksUploadRequest.headings});
  const fileName = walksUploadRequest.fileName;
  const filePath = path + fileName;
  const recordCounter: RecordCounter = {record: 0};
  debugLog("csv data:", csvData, "filePath:", filePath);
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }

  function reportErrorAndClose(error) {
    debugLog(`❌ Ramblers walks upload failed via ${fileName}:`, (error as Error).message);
    ws.send(JSON.stringify({
      type: MessageType.ERROR,
      data: {
        responseData: [],
        error,
        information: "Ramblers walks upload failed via " + fileName
      }
    }));
    ws.close();
  }

  try {
    fs.writeFileSync(filePath, csvData);
  } catch (error) {
    reportErrorAndClose(error);
  }
  debugLog("file", filePath, "saved");

  function auditRamblersUpload(props: AuditRamblersUploadParams) {
    return Promise.all(props.parserFunction(props.auditMessage, props.status).map((uploadAudit: ParsedRamblersUploadAudit) => {
      if (uploadAudit.audit) {
        recordCounter.record++;
        return mongooseClient.create<RamblersUploadAudit>(ramblersUploadAudit, {
          auditTime: uploadAudit.auditTime || momentNowAsValue(),
          record: recordCounter.record,
          fileName,
          type: uploadAudit.type,
          status: uploadAudit.status,
          message: uploadAudit.message,
        }, debugLog);
      } else {
        return Promise.resolve(null);
      }
    })).then((unfilteredAuditRecords: any[]) => {
      const audits: RamblersUploadAudit[] = unfilteredAuditRecords.filter(item => item);
      const response: RamblersUploadAuditProgressResponse = {audits};
      ws.send(JSON.stringify({
        type: MessageType.PROGRESS,
        data: response
      }));
      return response;
    }).catch(error => reportErrorAndClose(error));
  }

  const webdriverFramework = process.env.WEBDRIVER_FRAMEWORK || "protractor";
  process.env.RAMBLERS_USER = walksUploadRequest.ramblersUser;
  process.env.RAMBLERS_DELETE_WALKS = walksUploadRequest.walkIdDeletionList.join(",");
  process.env.RAMBLERS_FILENAME = filePath;
  process.env.RAMBLERS_WALKCOUNT = walksUploadRequest.rows.length.toString();
  process.env.RAMBLERS_FEATURE = "walks-upload.ts";
  const spawn = require("child_process").spawn;
  debugLog("Running RAMBLERS_FEATURE:", process.env.RAMBLERS_FEATURE,
    "WEBDRIVER_FRAMEWORK:", process.env.WEBDRIVER_FRAMEWORK,
    "CHROMEDRIVER_PATH:", process.env.CHROMEDRIVER_PATH,
    "CHROME_BIN:", process.env.CHROME_BIN,
    "CHROME_VERSION:", process.env.CHROME_VERSION);
  const subprocess = spawn("npm", ["run", `serenity-${webdriverFramework}`], {
    detached: true,
    stdio: ["pipe", "pipe", "pipe", "ipc"]
  });

  subprocess.unref();

  subprocess.stdout.on("data", (data: any) => {
    auditRamblersUpload({auditMessage: decoder.write(data), parserFunction: auditParser.parseStandardOut});
  });

  subprocess.stderr.on("data", (data: any) => {
    auditRamblersUpload({auditMessage: decoder.write(data), parserFunction: auditParser.parseStandardError});
  });

  subprocess.on("error", (error: any) => {
    debugLog(`Subprocess error: ${error.message}`);
    reportErrorAndClose(error);
  });

  subprocess.on("exit", (code: number, signal) => {
    const auditMessage = `Upload completed for ${fileName} with code ${code}`;
    const signalMessage = signal ? `Subprocess exit: Process terminated by signal: ${signal}` : `Process exited with code: ${code}`;
    const status: Status = code === 0 ? Status.SUCCESS : Status.ERROR;
    debugLog(signalMessage);
    auditRamblersUpload({auditMessage, parserFunction: auditParser.parseExit, status});
    ws.send(JSON.stringify({
      type: MessageType.COMPLETE,
      data: {
        message: auditMessage,
        status
      }
    }));
    ws.close();
  });

  subprocess.on("close", (code, signal) => {
    debugLog(`NEW Process fully closed with code ${code} and signal ${signal}`);
  });

  subprocess.on("message", (msg: any) => {
    debugLog(`NEW IPC message from subprocess: ${JSON.stringify(msg)}`);
  });

}
