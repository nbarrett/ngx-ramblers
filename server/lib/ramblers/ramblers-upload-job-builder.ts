import { randomUUID } from "node:crypto";
import {
  RamblersUploadJob,
  RamblersUploadJobData,
  RamblersUploadJobState
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { RamblersWalksUploadRequest } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { dateTimeNowAsValue } from "../shared/dates";

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
    feature: "walks-upload.ts"
  };

  return {
    jobId: randomUUID(),
    createdAt: dateTimeNowAsValue(),
    state: RamblersUploadJobState.QUEUED,
    data
  };
}
