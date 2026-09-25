import { Request, Response } from "express";
import { hasFileExtension } from "../shared/string-utils";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import * as fs from "fs";
import { persistGpxContent } from "./walk-gpx-persist";
import { saveFileImportedGpx } from "../os-maps/os-maps-imported-route-store";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import multer from "multer";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("walk-gpx-upload"));
debugLog.enabled = true;

export const receiveWalkGpx = multer({dest: envConfig.server.uploadDir}).single("file");

function walkerFrom(req: Request): {memberId?: string; name?: string} {
  const user = req.user as Partial<MemberCookie> | undefined;
  const name = [user?.firstName, user?.lastName].filter(part => !!part).join(" ").trim() || user?.userName || "";
  return {
    memberId: user?.memberId,
    name: name || undefined
  };
}

export function uploadWalkGpx(req: Request, res: Response) {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  if (!hasFileExtension(file.originalname, ".gpx")) {
    return res.status(400).json({ error: "Only GPX files are allowed" });
  }

  const content = fs.readFileSync(file.path, "utf8");
  persistGpxContent(file.originalname, content, undefined, walkerFrom(req))
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
      const content = fs.readFileSync(file.path, "utf8");
      const gpxFile = await persistGpxContent(file.originalname, content, undefined, walkerFrom(req));
      const route = await saveFileImportedGpx(gpxFile);
      debugLog("Import successful:", gpxFile.awsFileName, route?.routeId);
      res.status(200).json({gpxFile, routeId: route?.routeId});
    } catch (error) {
      debugLog("Import error:", error);
      res.status(500).json({error: "Import failed", message: (error as Error).message});
    }
  }
}
