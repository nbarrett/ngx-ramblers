export enum IntegrationWorkerHeavyJobType {
  Upload = "upload",
  Resize = "resize",
}

export interface IntegrationWorkerHeavyJob {
  jobId: string;
  type: IntegrationWorkerHeavyJobType;
  label: string;
  run: () => Promise<void>;
}

export interface IntegrationWorkerHeavyJobQueueResult {
  queued: boolean;
  queuePosition: number;
  activeJobId: string | null;
  activeJobType: IntegrationWorkerHeavyJobType | null;
}
