import debug from "debug";
import { envConfig } from "../env-config/env-config";
import {
  IntegrationWorkerHeavyJob,
  IntegrationWorkerHeavyJobQueueResult
} from "../models/integration-worker-heavy-job.model";

const debugLog = debug(envConfig.logNamespace("integration-worker-heavy-job-queue"));
debugLog.enabled = true;

export class IntegrationWorkerHeavyJobQueue {
  private activeItem: IntegrationWorkerHeavyJob | null = null;
  private items: IntegrationWorkerHeavyJob[] = [];

  enqueue(item: IntegrationWorkerHeavyJob): IntegrationWorkerHeavyJobQueueResult {
    debugLog("enqueue request jobId:", item.jobId, "type:", item.type, "label:", item.label);
    if (this.activeItem) {
      const queuePosition = this.items.push(item);
      debugLog("queued jobId:", item.jobId, "type:", item.type, "position:", queuePosition, "activeJobId:", this.activeItem.jobId, "activeType:", this.activeItem.type);
      return {
        queued: true,
        queuePosition,
        activeJobId: this.activeItem.jobId,
        activeJobType: this.activeItem.type
      };
    }

    this.activeItem = item;
    debugLog("starting jobId:", item.jobId, "type:", item.type, "label:", item.label);
    void this.runActiveItem();
    return {
      queued: false,
      queuePosition: 0,
      activeJobId: item.jobId,
      activeJobType: item.type
    };
  }

  activeJob(): IntegrationWorkerHeavyJob | null {
    return this.activeItem;
  }

  queuedJobs(): IntegrationWorkerHeavyJob[] {
    return this.items;
  }

  private async runActiveItem(): Promise<void> {
    const item = this.activeItem;

    if (!item) {
      return;
    }

    try {
      debugLog("running jobId:", item.jobId, "type:", item.type);
      await item.run();
      debugLog("finished jobId:", item.jobId, "type:", item.type);
    } catch (error) {
      debugLog("failed jobId:", item.jobId, "type:", item.type, "error:", (error as Error).message);
    } finally {
      this.activeItem = null;
      await this.runNext();
    }
  }

  private async runNext(): Promise<void> {
    const nextItem = this.items.shift();

    if (!nextItem) {
      debugLog("queue empty");
      return;
    }

    this.activeItem = nextItem;
    debugLog("dequeued jobId:", nextItem.jobId, "type:", nextItem.type, "remainingQueueDepth:", this.items.length);
    await this.runActiveItem();
  }
}

export const integrationWorkerHeavyJobQueue = new IntegrationWorkerHeavyJobQueue();
