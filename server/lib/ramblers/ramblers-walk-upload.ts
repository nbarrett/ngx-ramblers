import {
  RamblersWalksUploadRequest,
  RecordCounter
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { envConfig } from "../env-config/env-config";
import * as auditParser from "./ramblers-audit-parser";
import debug from "debug";
import { ramblersUploadAudit } from "../mongo/models/ramblers-upload-audit";
import * as mongooseClient from "../mongo/mongoose-client";
import { ParsedRamblersUploadAudit } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { momentNowAsValue } from "../shared/dates";
import fs = require("fs");
import stringDecoder = require("string_decoder");
import json2csv = require("json2csv");

const debugLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-walk-upload"));
debugLog.enabled = true;
const path = "/tmp/ramblers/";
const StringDecoder = stringDecoder.StringDecoder;
const decoder = new StringDecoder("utf8");

export function uploadWalks(req, res) {
  const walksUploadRequest: RamblersWalksUploadRequest = req.body;
  debugLog("request made with walksUploadRequest:", walksUploadRequest);
  const csvData = json2csv({data: walksUploadRequest.rows, fields: walksUploadRequest.headings});
  const fileName = walksUploadRequest.fileName;
  const filePath = path + fileName;
  const recordCounter: RecordCounter = {record: 0};
  debugLog("csv data:", csvData, "filePath:", filePath);
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }

  try {
    fs.writeFileSync(filePath, csvData);
  } catch (e) {
    res.status(500).send({
      responseData: [],
      error: e,
      information: "Ramblers walks upload failed via " + fileName
    });
  }
  debugLog("file", filePath, "saved");

  function auditRamblersUpload(auditMessage: string, parserFunction: (auditMessage: string) => ParsedRamblersUploadAudit[]) {
    parserFunction(auditMessage).forEach((uploadAudit: ParsedRamblersUploadAudit) => {
      if (uploadAudit.audit) {
        recordCounter.record++;
        mongooseClient.create(ramblersUploadAudit, {
          auditTime: uploadAudit.auditTime || momentNowAsValue(),
          record: recordCounter.record,
          fileName,
          type: uploadAudit.type,
          status: uploadAudit.status,
          message: uploadAudit.message,
        }, debugLog);
      }
    });
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
    "WEBDRIVER_RUNNER:", process.env.WEBDRIVER_RUNNER,
    "CHROMEDRIVER_PATH:", process.env.CHROMEDRIVER_PATH,
    "CHROME_BIN:", process.env.CHROME_BIN,
    "CHROME_VERSION:", process.env.CHROME_VERSION);
  const subprocess = spawn("npm", ["run", `serenity-${webdriverFramework}`], {
    detached: true,
    stdio: ["pipe", "pipe", "pipe", "ipc"]
  });

  subprocess.unref();

  subprocess.stdout.on("data", (data: any) => {
    auditRamblersUpload(decoder.write(data), auditParser.parseStandardOut);
  });

  subprocess.stderr.on("data", (data: any) => {
    auditRamblersUpload(decoder.write(data), auditParser.parseStandardError);
  });

  subprocess.on("error", (err: any) => {
    debugLog(`Subprocess error: ${err.message}`);
    res.status(500).send({
      responseData: [],
      error: err.message,
      information: "Ramblers walks upload failed due to subprocess error"
    });
  });

  subprocess.on("exit", (code, signal) => {
    auditRamblersUpload(`Upload completed for ${fileName} with code ${code}`, auditParser.parseExit);
    if (signal) {
      debugLog(`Process terminated by signal: ${signal}`);
    } else {
      debugLog(`Process exited with code: ${code}`);
    }
  });

  subprocess.on("close", (code, signal) => {
    debugLog(`NEW Process fully closed with code ${code} and signal ${signal}`);
  });

  subprocess.on("message", (msg: any) => {
    debugLog(`NEW IPC message from subprocess: ${JSON.stringify(msg)}`);
  });

  res.status(200).send({
    responseData: "Ramblers walks upload was successfully submitted via " + fileName
  });
}
