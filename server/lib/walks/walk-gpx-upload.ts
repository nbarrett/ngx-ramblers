import { Request, Response } from "express";
import { hasFileExtension } from "../shared/string-utils";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import * as fs from "fs";
import { persistGpxContent } from "./walk-gpx-persist";
import { osMapsImportedRouteById, saveFileImportedGpx } from "../os-maps/os-maps-imported-route-store";
import { routeContributorFrom } from "../auth/request-member";
import multer from "multer";
import { isString } from "es-toolkit/compat";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("walk-gpx-upload"));
debugLog.enabled = true;

export const receiveWalkGpx = multer({dest: envConfig.server.uploadDir}).single("file");


export function uploadWalkGpx(req: Request, res: Response) {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  if (!hasFileExtension(file.originalname, ".gpx")) {
    return res.status(400).json({ error: "Only GPX files are allowed" });
  }

  const content = fs.readFileSync(file.path, "utf8");
  persistGpxContent(file.originalname, content, undefined, routeContributorFrom(req))
    .then(fileNameData => {
      debugLog("Upload successful:", fileNameData);
      return res.status(200).json({ gpxFile: fileNameData });
    })
    .catch(error => {
      debugLog("Upload error:", error);
      return res.status(500).json({ error: "Upload failed", message: error.message });
    });
}

export async function importWalkGpx(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({error: "No file uploaded"});
  } else if (!hasFileExtension(file.originalname, ".gpx")) {
    res.status(400).json({error: "Only GPX files are allowed"});
  } else {
    try {
      const recordingId = isString(req.body?.recordingId) ? req.body.recordingId : "";
      if (recordingId && !/^[a-zA-Z0-9-]{8,80}$/.test(recordingId)) {
        res.status(400).json({error: "Invalid recording identifier"});
      } else {
        const existing = recordingId ? await osMapsImportedRouteById(`recording-${recordingId}`) : null;
        if (existing?.gpxFile) {
          res.status(200).json({gpxFile: existing.gpxFile, routeId: existing.routeId});
        } else {
          const content = fs.readFileSync(file.path, "utf8");
          const title = isString(req.body?.title) ? req.body.title.trim().slice(0, 200) : "";
          const description = isString(req.body?.description) ? req.body.description.trim().slice(0, 10000) : "";
          const gpxFile = await persistGpxContent(file.originalname, content, title || null, routeContributorFrom(req));
          gpxFile.description = description;
          const route = await saveFileImportedGpx(gpxFile, recordingId || null);
          debugLog("Import successful:", gpxFile.awsFileName, route?.routeId);
          res.status(200).json({gpxFile, routeId: route?.routeId});
        }
      }
    } catch (error) {
      debugLog("Import error:", error);
      res.status(500).json({error: "Import failed", message: (error as Error).message});
    }
  }
}
