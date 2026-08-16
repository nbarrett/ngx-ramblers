import { dateTimeNowAsValue } from "../shared/dates";
import { osMapsExportResult } from "../mongo/models/os-maps-export-result";
import { OsMapsExportJobResult, OsMapsExportJobStatus } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { FileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import * as mongooseClient from "../mongo/mongoose-client";

function toResult(document: OsMapsExportJobResult | null): OsMapsExportJobResult | null {
  if (!document) {
    return null;
  } else {
    return {
      jobId: document.jobId,
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

export async function createQueuedOsMapsExportResult(jobId: string, walkId?: string, routeUrls: string[] = []): Promise<OsMapsExportJobResult> {
  const createdAt = dateTimeNowAsValue();
  return mongooseClient.execute(() => osMapsExportResult.findOneAndUpdate(
    {jobId},
    {
      jobId,
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

export async function completeOsMapsExportResult(jobId: string, gpxFiles: FileNameData[]): Promise<OsMapsExportJobResult> {
  return mongooseClient.execute(() => osMapsExportResult.findOneAndUpdate(
    {jobId},
    {
      status: OsMapsExportJobStatus.COMPLETED,
      gpxFiles,
      error: null,
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
