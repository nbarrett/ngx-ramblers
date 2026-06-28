import expect from "expect";
import { describe, it } from "mocha";
import { IntegrationWorkerHeavyJobType } from "../models/integration-worker-heavy-job.model";
import { IntegrationWorkerHeavyJobQueue } from "./integration-worker-heavy-job-queue";

describe("IntegrationWorkerHeavyJobQueue", () => {
  it("runs heavy worker jobs one at a time across job types", async () => {
    const executed: string[] = [];
    let releaseUpload: (() => void) | null = null;
    const uploadFinished = new Promise<void>(resolve => {
      releaseUpload = resolve;
    });
    const queue = new IntegrationWorkerHeavyJobQueue();

    const uploadResult = queue.enqueue({
      jobId: "upload-1",
      type: IntegrationWorkerHeavyJobType.Upload,
      label: "walks.csv",
      run: async () => {
        executed.push("upload-1");
        await uploadFinished;
      }
    });
    const resizeResult = queue.enqueue({
      jobId: "resize-1",
      type: IntegrationWorkerHeavyJobType.Resize,
      label: "saved resize",
      run: async () => {
        executed.push("resize-1");
      }
    });

    expect(uploadResult).toEqual({
      queued: false,
      queuePosition: 0,
      activeJobId: "upload-1",
      activeJobType: IntegrationWorkerHeavyJobType.Upload
    });
    expect(resizeResult).toEqual({
      queued: true,
      queuePosition: 1,
      activeJobId: "upload-1",
      activeJobType: IntegrationWorkerHeavyJobType.Upload
    });
    expect(executed).toEqual(["upload-1"]);
    expect(queue.activeJob()?.jobId).toEqual("upload-1");
    expect(queue.queuedJobs().map(item => item.jobId)).toEqual(["resize-1"]);

    releaseUpload?.();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(executed).toEqual(["upload-1", "resize-1"]);
    expect(queue.activeJob()).toBeNull();
    expect(queue.queuedJobs()).toEqual([]);
  });

  it("continues to the next job after a failed job", async () => {
    const executed: string[] = [];
    const queue = new IntegrationWorkerHeavyJobQueue();

    queue.enqueue({
      jobId: "resize-1",
      type: IntegrationWorkerHeavyJobType.Resize,
      label: "saved resize",
      run: async () => {
        executed.push("resize-1");
        throw new Error("resize failed");
      }
    });
    queue.enqueue({
      jobId: "upload-1",
      type: IntegrationWorkerHeavyJobType.Upload,
      label: "walks.csv",
      run: async () => {
        executed.push("upload-1");
      }
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(executed).toEqual(["resize-1", "upload-1"]);
    expect(queue.activeJob()).toBeNull();
    expect(queue.queuedJobs()).toEqual([]);
  });
});
