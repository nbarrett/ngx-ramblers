import WebSocket from "ws";
import { RamblersUploadJob } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { RamblersUploadCredentials } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-worker.model";

export interface RamblersUploadQueueItem {
  job: RamblersUploadJob;
  ws: WebSocket;
  credentials?: RamblersUploadCredentials;
}

export interface RamblersUploadQueueResult {
  queued: boolean;
  queuePosition: number;
  activeJobId: string | null;
}
