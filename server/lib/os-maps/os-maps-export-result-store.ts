import { isNumber } from "es-toolkit/compat";
import { ramblersUploadAudit } from "../mongo/models/ramblers-upload-audit";
import { dateTimeNowAsValue } from "../shared/dates";
import { osMapsExportResult } from "../mongo/models/os-maps-export-result";
import { OS_MAPS_EXPORT_MAX_WAIT_MS, OsMapsExportJobResult, OsMapsExportJobStatus } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { FileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import * as mongooseClient from "../mongo/mongoose-client";

function toResult(document: OsMapsExportJobResult | null): OsMapsExportJobResult | null {
  if (!document) {
    return null;
  } else {
    return {
      jobId: document.jobId,
      fileName: document.fileName || "",
      status: document.status,
      walkId: document.walkId || null,
      routeUrls: document.routeUrls || [],
      gpxFiles: document.gpxFiles || [],
      error: document.error || null,
      createdAt: document.createdAt,
      completedAt: document.completedAt || null
    };
  }
}

export async function createQueuedOsMapsExportResult(jobId: string, fileName: string, walkId?: string, routeUrls: string[] = []): Promise<OsMapsExportJobResult> {
  const createdAt = dateTimeNowAsValue();
  return mongooseClient.execute(() => osMapsExportResult.findOneAndUpdate(
    {jobId},
    {
      jobId,
      fileName,
      status: OsMapsExportJobStatus.QUEUED,
      walkId: walkId || null,
      routeUrls,
      gpxFiles: [],
      error: null,
      createdAt,
      completedAt: null
    },
    {upsert: true, new: true, lean: true}
  ).then(document => {
    const result = toResult(document);
    if (!result) {
      throw new Error(`Failed to create OS Maps export result for ${jobId}`);
    } else {
      return result;
    }
  }));
}

export async function osMapsExportResultByJobId(jobId: string): Promise<OsMapsExportJobResult | null> {
  return mongooseClient.execute(() => osMapsExportResult.findOne({jobId}).lean()
    .then(document => toResult(document)));
}

export async function latestOsMapsExportResult(): Promise<OsMapsExportJobResult | null> {
  return mongooseClient.execute(() => osMapsExportResult.findOne().sort({createdAt: -1}).lean()
    .then(document => toResult(document)));
}

export async function completeOsMapsExportResult(jobId: string, gpxFiles: FileNameData[], error: string | null = null): Promise<OsMapsExportJobResult> {
  return mongooseClient.execute(() => osMapsExportResult.findOneAndUpdate(
    {jobId},
    {
      status: OsMapsExportJobStatus.COMPLETED,
      gpxFiles,
      error,
      completedAt: dateTimeNowAsValue()
    },
    {new: true, lean: true}
  ).then(document => {
    const result = toResult(document);
    if (!result) {
      throw new Error(`Failed to complete OS Maps export result for ${jobId}`);
    } else {
      return result;
    }
  }));
}

export async function lastOsMapsExportActivityAt(result: OsMapsExportJobResult): Promise<number> {
  const latest = await mongooseClient.execute(() => ramblersUploadAudit.findOne({jobId: result.jobId}).sort({auditTime: -1}).lean());
  return isNumber(latest?.auditTime) ? Math.max(result.createdAt, latest.auditTime) : result.createdAt;
}

export function osMapsExportResultWithActivity(result: OsMapsExportJobResult, lastActivity: number, now: number): OsMapsExportJobResult {
  const quiet = now - lastActivity > OS_MAPS_EXPORT_MAX_WAIT_MS;
  const timeoutFailure = result.status === OsMapsExportJobStatus.FAILED
    && (result.error?.startsWith("No result came back from the worker") || result.error?.startsWith("No activity came back from the worker"));
  if (result.status === OsMapsExportJobStatus.QUEUED && quiet) {
    const minutes = Math.round(OS_MAPS_EXPORT_MAX_WAIT_MS / 60000);
    return {...result, status: OsMapsExportJobStatus.FAILED, error: `No activity came back from the worker for ${minutes} minutes, so this conversion has been abandoned. Try it again.`, completedAt: lastActivity + OS_MAPS_EXPORT_MAX_WAIT_MS};
  } else if (timeoutFailure && !quiet) {
    return {...result, status: OsMapsExportJobStatus.QUEUED, error: null, completedAt: null};
  } else {
    return result;
  }
}

export async function failOsMapsExportResult(jobId: string, error: string): Promise<OsMapsExportJobResult | null> {
  return mongooseClient.execute(() => osMapsExportResult.findOneAndUpdate(
    {jobId},
    {
      status: OsMapsExportJobStatus.FAILED,
      error,
      completedAt: dateTimeNowAsValue()
    },
    {new: true, lean: true}
  ).then(document => toResult(document)));
}
