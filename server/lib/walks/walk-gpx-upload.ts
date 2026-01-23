import { Request, Response } from "express";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { hasFileExtension } from "../shared/string-utils";
import { generateAwsFileName, createFileNameData, isAwsUploadErrorResponse } from "../aws/aws-utils";
import * as aws from "../aws/aws-controllers";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import { DOMParser } from "@xmldom/xmldom";
import * as fs from "fs";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("walk-gpx-upload"));
debugLog.enabled = true;

function parseGpxFileForStartPoint(filePath: string): { startLat: number; startLng: number } {
  try {
    const fileContents = fs.readFileSync(filePath, "utf8");
    const parser = new DOMParser();
    const doc = parser.parseFromString(fileContents, "text/xml");

    const trkpts = doc.getElementsByTagName("trkpt");
    if (trkpts.length > 0) {
      const firstPoint = trkpts[0];
      const lat = parseFloat(firstPoint.getAttribute("lat") || "0");
      const lon = parseFloat(firstPoint.getAttribute("lon") || "0");
      return { startLat: lat, startLng: lon };
    }

    const wpts = doc.getElementsByTagName("wpt");
    if (wpts.length > 0) {
      const firstPoint = wpts[0];
      const lat = parseFloat(firstPoint.getAttribute("lat") || "0");
      const lon = parseFloat(firstPoint.getAttribute("lon") || "0");
      return { startLat: lat, startLng: lon };
    }

    const rtepts = doc.getElementsByTagName("rtept");
    if (rtepts.length > 0) {
      const firstPoint = rtepts[0];
      const lat = parseFloat(firstPoint.getAttribute("lat") || "0");
      const lon = parseFloat(firstPoint.getAttribute("lon") || "0");
      return { startLat: lat, startLng: lon };
    }

    debugLog("No track/waypoint/route points found in GPX file");
    return { startLat: 0, startLng: 0 };
  } catch (error) {
    debugLog("Error parsing GPX file for start point:", error);
    return { startLat: 0, startLng: 0 };
  }
}

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

  const { startLat, startLng } = parseGpxFileForStartPoint(file.path);
  fileNameData.startLat = startLat;
  fileNameData.startLng = startLng;

  debugLog("Uploading GPX file:", file.originalname, "as", awsFileName, "with start point:", startLat, startLng);

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
