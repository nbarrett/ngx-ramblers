import debug from "debug";
import { isString } from "es-toolkit/compat";
import { ExportedGpxSummary } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { FileNameData, ServerFileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { EventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { envConfig } from "../env-config/env-config";
import { persistGpxContent } from "../walks/walk-gpx-persist";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import * as mongooseClient from "../mongo/mongoose-client";
import {
  completeOsMapsExportResult,
  failOsMapsExportResult,
  osMapsExportResultByJobId
} from "./os-maps-export-result-store";
import { markOsMapsRoutesImported } from "./os-maps-imported-route-store";

const debugLog = debug(envConfig.logNamespace("os-maps-gpx-attach"));
debugLog.enabled = true;

async function persistSummaries(summaries: ExportedGpxSummary[]): Promise<ServerFileNameData[]> {
  return summaries.reduce(async (previousPromise, summary) => {
    const previous = await previousPromise;
    const originalFileName = summary.fileName || `${summary.name || "os-maps-route"}.gpx`;
    const fileNameData = await persistGpxContent(originalFileName, summary.content, summary.name);
    return [...previous, fileNameData];
  }, Promise.resolve([] as ServerFileNameData[]));
}

async function attachGpxToWalkIfMissing(walkId: string, gpxFile: FileNameData): Promise<void> {
  const updated = await mongooseClient.execute(() => extendedGroupEvent.findOneAndUpdate(
    {
      _id: walkId,
      $or: [
        {[EventField.GPX_FILE_AWS_FILE_NAME]: {$exists: false}},
        {[EventField.GPX_FILE_AWS_FILE_NAME]: null},
        {[EventField.GPX_FILE_AWS_FILE_NAME]: ""}
      ]
    },
    {$set: {[EventField.GPX_FILE]: gpxFile}},
    {new: true}
  ));
  if (updated) {
    debugLog("attached GPX to walk", walkId, "as", gpxFile.awsFileName);
  } else {
    debugLog("did not attach GPX to walk", walkId, "- walk missing or already has a GPX file");
  }
}

export async function applyOsMapsExportWorkerResult(jobId: string, exportedGpx: ExportedGpxSummary[] | undefined, errorMessage?: string): Promise<boolean> {
  const existing = await osMapsExportResultByJobId(jobId);
  if (!existing) {
    return false;
  } else if (exportedGpx && exportedGpx.length > 0) {
    try {
      const gpxFiles = await persistSummaries(exportedGpx);
      await completeOsMapsExportResult(jobId, gpxFiles);
      await markOsMapsRoutesImported(existing.routeUrls || [], gpxFiles);
      if (isString(existing.walkId) && existing.walkId && gpxFiles[0]) {
        await attachGpxToWalkIfMissing(existing.walkId, gpxFiles[0]);
      }
      return true;
    } catch (error) {
      debugLog("persist exported GPX failed for jobId:", jobId, "error:", (error as Error).message);
      await failOsMapsExportResult(jobId, (error as Error).message);
      throw error;
    }
  } else {
    await failOsMapsExportResult(jobId, errorMessage || "OS Maps export did not produce a GPX file");
    return true;
  }
}
