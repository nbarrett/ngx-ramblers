import expect from "expect";
import { describe, it } from "mocha";
import WebSocket from "ws";
import { RamblersUploadQueue } from "./ramblers-upload-queue";
import { RamblersUploadQueueItem } from "../models/ramblers-upload-execution.model";
import { RamblersUploadJob, RamblersUploadJobState } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";

describe("RamblersUploadQueue", () => {
  it("queues the second job until the first job finishes", async () => {
    const executed: string[] = [];
    let releaseFirstJob: (() => void) | null = null;
    const firstJobFinished = new Promise<void>(resolve => {
      releaseFirstJob = resolve;
    });
    const queue = new RamblersUploadQueue(async item => {
      executed.push(item.job.jobId);
      if (item.job.jobId === "job-1") {
        await firstJobFinished;
      }
    });
    const firstItem: RamblersUploadQueueItem = {
      job: createJob("job-1", "first.csv"),
      ws: openWebSocket()
    };
    const secondItem: RamblersUploadQueueItem = {
      job: createJob("job-2", "second.csv"),
      ws: openWebSocket()
    };

    const firstResult = await queue.enqueue(firstItem);
    const secondResult = await queue.enqueue(secondItem);

    expect(firstResult).toEqual({
      queued: false,
      queuePosition: 0,
      activeJobId: "job-1"
    });
    expect(secondResult).toEqual({
      queued: true,
      queuePosition: 1,
      activeJobId: "job-1"
    });
    expect(executed).toEqual(["job-1"]);
    expect(queue.activeJob().jobId).toEqual("job-1");
    expect(queue.queuedJobs().map(item => item.jobId)).toEqual(["job-2"]);

    releaseFirstJob?.();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(executed).toEqual(["job-1", "job-2"]);
    expect(queue.activeJob()).toBeNull();
    expect(queue.queuedJobs()).toEqual([]);
  });
});

function createJob(jobId: string, fileName: string): RamblersUploadJob {
  return {
    jobId,
    createdAt: 1,
    state: RamblersUploadJobState.QUEUED,
    data: {
      fileName,
      walkIdDeletionList: [],
      walkIdUploadList: [],
      walkCancellations: [],
      walkUncancellations: [],
      headings: [],
      rows: [],
      ramblersUser: "nick@example.com",
      feature: "walks-upload.ts"
    }
  };
}

function openWebSocket(): WebSocket {
  return { readyState: WebSocket.OPEN } as unknown as WebSocket;
}
