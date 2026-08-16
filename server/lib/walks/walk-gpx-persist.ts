import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { ServerFileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { generateAwsFileName, createFileNameData, isAwsUploadErrorResponse } from "../aws/aws-utils";
import { putBufferDirect } from "../aws/aws-controllers";
import { hasFileExtension } from "../shared/string-utils";
import { parseExportedGpx } from "../os-maps/exported-gpx-parser";
import { envConfig } from "../env-config/env-config";
import debug from "debug";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("walk-gpx-persist"));
debugLog.enabled = true;

export async function persistGpxContent(originalFileName: string, content: string, title?: string): Promise<ServerFileNameData> {
  const safeName = hasFileExtension(originalFileName, ".gpx") ? originalFileName : `${originalFileName}.gpx`;
  const awsFileName = generateAwsFileName(safeName);
  const resolvedTitle = title || safeName.replace(/\.gpx$/i, "");
  const fileNameData = createFileNameData(RootFolder.gpxRoutes, safeName, awsFileName, resolvedTitle);
  try {
    const summary = parseExportedGpx(content, safeName);
    fileNameData.startLat = summary.startLat;
    fileNameData.startLng = summary.startLng;
  } catch (error) {
    debugLog("Could not parse GPX start point:", error);
    fileNameData.startLat = 0;
    fileNameData.startLng = 0;
  }
  debugLog("Uploading GPX file:", safeName, "as", awsFileName, "with start point:", fileNameData.startLat, fileNameData.startLng);
  const response = await putBufferDirect(RootFolder.gpxRoutes, awsFileName, Buffer.from(content, "utf8"), "application/gpx+xml");
  if (isAwsUploadErrorResponse(response)) {
    throw new Error(response.error || "Upload failed");
  } else {
    return fileNameData;
  }
}
