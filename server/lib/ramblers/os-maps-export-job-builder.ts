import { randomUUID } from "node:crypto";
import {
  RamblersUploadJob,
  RamblersUploadJobData,
  RamblersUploadJobState
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { SerenityFeature } from "../../../projects/ngx-ramblers/src/app/models/serenity-feature.model";
import { dateTimeNow, dateTimeNowAsValue, formatDateTime } from "../shared/dates";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";

function emptyWalkJobData(): Omit<RamblersUploadJobData, "fileName" | "feature"> {
  return {
    walkIdDeletionList: [],
    walkIdUploadList: [],
    walkCancellations: [],
    walkUncancellations: [],
    headings: [],
    rows: [],
    ramblersUser: "",
    walkImageUploads: []
  };
}

export function buildOsMapsExportJob(routeUrls: string[], walkId?: string, ramblersUser?: string): RamblersUploadJob {
  return {
    jobId: randomUUID(),
    createdAt: dateTimeNowAsValue(),
    state: RamblersUploadJobState.QUEUED,
    data: {
      ...emptyWalkJobData(),
      fileName: `os-maps-export-${formatDateTime(dateTimeNow(), UIDateFormat.FILE_TIMESTAMP_COMPACT)}.gpx`,
      feature: SerenityFeature.OS_MAPS_EXPORT,
      osMapsRouteUrl: routeUrls[0],
      osMapsRouteUrls: routeUrls,
      ...(walkId ? {osMapsWalkId: walkId} : {}),
      ...(ramblersUser ? {ramblersUser} : {})
    }
  };
}

export function buildOsMapsListJob(ramblersUser?: string): RamblersUploadJob {
  return {
    jobId: randomUUID(),
    createdAt: dateTimeNowAsValue(),
    state: RamblersUploadJobState.QUEUED,
    data: {
      ...emptyWalkJobData(),
      fileName: `os-maps-list-${formatDateTime(dateTimeNow(), UIDateFormat.FILE_TIMESTAMP_COMPACT)}.json`,
      feature: SerenityFeature.OS_MAPS_LIST,
      ...(ramblersUser ? {ramblersUser} : {})
    }
  };
}
