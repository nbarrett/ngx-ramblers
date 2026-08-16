import * as fs from "fs";
import * as path from "path";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { ExportedGpxSummary } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { isArray } from "es-toolkit/compat";

export const EXPORTED_GPX_FILE_NAME = "exported-gpx.json";

function existingSummaries(filePath: string): ExportedGpxSummary[] {
  if (!fs.existsSync(filePath)) {
    return [];
  } else {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (isArray(parsed)) {
      return parsed;
    } else {
      return [];
    }
  }
}

export function persistExportedGpxToJobPath(summary: ExportedGpxSummary): void {
  const jobPath = process.env[Environment.OS_MAPS_JOB_PATH];
  if (jobPath) {
    fs.mkdirSync(jobPath, {recursive: true});
    const filePath = path.join(jobPath, EXPORTED_GPX_FILE_NAME);
    const summaries = [...existingSummaries(filePath), summary];
    fs.writeFileSync(filePath, JSON.stringify(summaries, null, 2));
  }
}

export function exportedGpxFromJobPath(jobPath?: string): ExportedGpxSummary[] {
  if (!jobPath) {
    return [];
  } else {
    return existingSummaries(path.join(jobPath, EXPORTED_GPX_FILE_NAME));
  }
}
