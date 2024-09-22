import { RamblersWalksUploadRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { envConfig } from "../env-config/env-config";
import * as parser from "./ramblers-audit-parser";
import debug from "debug";
import moment from "moment-timezone";
import { ramblersUploadAudit } from "../mongo/models/ramblers-upload-audit";
import * as mongooseClient from "../mongo/mongoose-client";
import fs = require("fs");
import stringDecoder = require("string_decoder");
import json2csv = require("json2csv");

const debugLog = debug(envConfig.logNamespace("ramblers-walk-upload"));
debugLog.enabled = false;
const path = "/tmp/ramblers/";
const StringDecoder = stringDecoder.StringDecoder;
const decoder = new StringDecoder("utf8");

export function uploadWalks(req, res) {

  const walksUploadRequest: RamblersWalksUploadRequest = req.body;
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
  } catch (e) {
    res.status(500).send({
      responseData: [],
      error: e,
      information: "Ramblers walks upload failed via " + fileName
    });
  }
  debugLog("file", filePath, "saved");

  const auditRamblersUpload = (auditMessage, parserFunction) => {
    parserFunction(auditMessage).forEach(message => {
      if (message.audit) {
        mongooseClient.create(ramblersUploadAudit, {
          auditTime: moment().tz("Europe/London").valueOf(),
          fileName,
          type: message.type,
          status: message.status,
          message: message.message,
        });
      }
    });
  };

  process.env["RAMBLERS_USER"] = walksUploadRequest.ramblersUser;
  process.env["RAMBLERS_DELETE_WALKS"] = walksUploadRequest.walkIdDeletionList.join(",");
  process.env["RAMBLERS_FILENAME"] = filePath;
  process.env["RAMBLERS_WALKCOUNT"] = walksUploadRequest.rows.length.toString();
  process.env["RAMBLERS_FEATURE"] = "walks-upload.ts";
  const spawn = require("child_process").spawn;
  debugLog("Running feature", process.env["RAMBLERS_FEATURE"], "with CHROMEDRIVER_PATH:", process.env["CHROMEDRIVER_PATH"], "CHROME_BIN:", process.env["CHROME_BIN"], "CHROME_VERSION:", process.env["CHROME_VERSION"]);
  const subprocess = spawn("npm", ["run", "serenity"], {
    detached: true,
    stdio: ["pipe"],
  });

  subprocess.unref();
  subprocess.stdout.on("data", data => {
    auditRamblersUpload(decoder.write(data), parser.parseStandardOut);
  });
  subprocess.stderr.on("data", data => {
    auditRamblersUpload(decoder.write(data), parser.parseStandardError);
  });
  subprocess.on("exit", () => {
    auditRamblersUpload("Upload completed for " + fileName, parser.parseExit);
  });

  res.status(200).send({
    responseData: "Ramblers walks upload was successfully submitted via " + fileName
  });

}
