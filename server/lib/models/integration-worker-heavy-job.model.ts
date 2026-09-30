export enum IntegrationWorkerHeavyJobType {
  Upload = "upload",
  Resize = "resize",
  OsMapsExport = "os-maps-export",
  Migration = "migration",
  ContentMigration = "content-migration",
  WalksManagerSync = "walks-manager-sync",
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
