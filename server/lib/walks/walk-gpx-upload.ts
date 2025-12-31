import { Request, Response } from "express";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { hasFileExtension } from "../shared/string-utils";
import { generateAwsFileName, createFileNameData, isAwsUploadErrorResponse } from "../aws/aws-utils";
import * as aws from "../aws/aws-controllers";
import { envConfig } from "../env-config/env-config";
import debug from "debug";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("walk-gpx-upload"));
debugLog.enabled = true;

export function uploadWalkGpx(req: Request, res: Response) {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  if (!hasFileExtension(file.originalname, ".gpx")) {
    return res.status(400).json({ error: "Only GPX files are allowed" });
  }

  const awsFileName = generateAwsFileName(file.originalname);
  const title = file.originalname.replace(/\.gpx$/i, "");
  const fileNameData = createFileNameData(RootFolder.gpxRoutes, file.originalname, awsFileName, title);

  debugLog("Uploading GPX file:", file.originalname, "as", awsFileName);

  aws.putObjectDirect(RootFolder.gpxRoutes, awsFileName, file.path)
    .then((response) => {
      if (isAwsUploadErrorResponse(response)) {
        debugLog("Upload failed:", response);
        return res.status(500).json({ error: "Upload failed", details: response });
      } else {
        debugLog("Upload successful:", fileNameData);
        return res.status(200).json({ gpxFile: fileNameData });
      }
    })
    .catch((error) => {
      debugLog("Upload error:", error);
      return res.status(500).json({ error: "Upload failed", message: error.message });
    });
}
