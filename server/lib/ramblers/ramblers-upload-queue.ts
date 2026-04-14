import WebSocket from "ws";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import {
  RamblersUploadJob,
  RamblersUploadJobState
} from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-job.model";
import { RamblersUploadQueueItem, RamblersUploadQueueResult } from "../models/ramblers-upload-execution.model";
import { dateTimeNowAsValue } from "../shared/dates";

export type RamblersUploadExecutor = (item: RamblersUploadQueueItem) => Promise<void>;
export type RamblersUploadCanceller = () => boolean;

const debugLog: debug.Debugger = debug(envConfig.logNamespace("ramblers-upload-queue"));
debugLog.enabled = true;

export class RamblersUploadQueue {
  private activeItem: RamblersUploadQueueItem | null = null;
  private items: RamblersUploadQueueItem[] = [];
  private activeCanceller: RamblersUploadCanceller | null = null;

  constructor(private executor: RamblersUploadExecutor) {
  }

  registerActiveCanceller(canceller: RamblersUploadCanceller | null): void {
    this.activeCanceller = canceller;
  }

  cancelAll(): { cancelledActive: boolean; cancelledQueued: number } {
    const cancelledQueued = this.items.length;
    this.items.forEach(item => {
      item.job.state = RamblersUploadJobState.CANCELLED;
      item.job.completedAt = dateTimeNowAsValue();
    });
    this.items = [];
    let cancelledActive = false;
    if (this.activeCanceller) {
      debugLog("invoking active canceller for job", this.activeItem?.job.jobId);
      cancelledActive = this.activeCanceller();
    } else if (this.activeItem) {
      debugLog("active item has no canceller registered, cannot interrupt spawn");
    }
    debugLog("cancelAll result cancelledActive:", cancelledActive, "cancelledQueued:", cancelledQueued);
    return { cancelledActive, cancelledQueued };
  }

  async enqueue(item: RamblersUploadQueueItem): Promise<RamblersUploadQueueResult> {
    debugLog("enqueue request for job", item.job.jobId, "file:", item.job.data.fileName, "rows:", item.job.data.rows?.length);
    if (this.activeItem) {
      const queuePosition = this.items.push(item);
      item.job.state = RamblersUploadJobState.QUEUED;
      item.job.queuePosition = queuePosition;
      debugLog("queued job", item.job.jobId, "at position", queuePosition, "behind active job", this.activeItem.job.jobId);
      return { queued: true, queuePosition, activeJobId: this.activeItem.job.jobId };
    }

    this.activeItem = item;
    item.job.state = RamblersUploadJobState.RUNNING;
    item.job.startedAt = dateTimeNowAsValue();
    item.job.queuePosition = 0;
    debugLog("starting job immediately (no active item)", item.job.jobId);
    void this.runActiveItem();
    return { queued: false, queuePosition: 0, activeJobId: item.job.jobId };
  }

  activeJob(): RamblersUploadJob | null {
    return this.activeItem?.job || null;
  }

  queuedJobs(): RamblersUploadJob[] {
    return this.items.map(item => item.job);
  }

  private async runActiveItem(): Promise<void> {
    const item = this.activeItem;

    if (!item) {
      return;
    }

    try {
      await this.executor(item);
    } finally {
      this.activeItem = null;
      await this.runNext();
    }
  }

  private async runNext(): Promise<void> {
    const nextItem = this.items.shift();

    if (!nextItem) {
      return;
    }

    if (nextItem.ws.readyState !== WebSocket.OPEN) {
      nextItem.job.state = RamblersUploadJobState.CANCELLED;
      nextItem.job.completedAt = dateTimeNowAsValue();
      await this.runNext();
      return;
    }

    this.activeItem = nextItem;
    this.activeItem.job.state = RamblersUploadJobState.RUNNING;
    this.activeItem.job.startedAt = dateTimeNowAsValue();
    this.activeItem.job.queuePosition = 0;
    await this.runActiveItem();
  }
}
