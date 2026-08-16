import { Request, Response } from "express";
import { hasFileExtension } from "../shared/string-utils";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import * as fs from "fs";
import { persistGpxContent } from "./walk-gpx-persist";

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

  const content = fs.readFileSync(file.path, "utf8");
  persistGpxContent(file.originalname, content)
    .then(fileNameData => {
      debugLog("Upload successful:", fileNameData);
      return res.status(200).json({ gpxFile: fileNameData });
    })
    .catch(error => {
      debugLog("Upload error:", error);
      return res.status(500).json({ error: "Upload failed", message: error.message });
    });
}
