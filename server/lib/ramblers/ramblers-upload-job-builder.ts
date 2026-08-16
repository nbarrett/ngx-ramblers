import { randomUUID } from "node:crypto";
import {
  RamblersUploadJob,
  RamblersUploadJobData,
  RamblersUploadJobState
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { RamblersWalksUploadRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { dateTimeNowAsValue } from "../shared/dates";
import { SerenityFeature } from "../../../projects/ngx-ramblers/src/app/models/serenity-feature.model";

export function buildRamblersUploadJob(request: RamblersWalksUploadRequest): RamblersUploadJob {
  const data: RamblersUploadJobData = {
    fileName: request.fileName,
    walkIdDeletionList: request.walkIdDeletionList,
    walkIdUploadList: request.walkIdUploadList || [],
    walkCancellations: request.walkCancellations,
    walkUncancellations: request.walkUncancellations || [],
    headings: request.headings,
    rows: request.rows,
    ramblersUser: request.ramblersUser,
    walkImageUploads: request.walkImageUploads || [],
    feature: SerenityFeature.WALKS_UPLOAD
  };

  return {
    jobId: randomUUID(),
    createdAt: dateTimeNowAsValue(),
    state: RamblersUploadJobState.QUEUED,
    data
  };
}
