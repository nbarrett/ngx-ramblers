import { BrevoDomainDnsRecords } from "./mail.model";

export enum MoveBrevoStatus {
  PENDING = "pending",
  PLANNED = "planned",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  DNS_RECORDS_REQUIRED = "dns-records-required"
}

export interface MoveBrevoSenderPlan {
  name: string;
  email: string;
}

export interface MoveBrevoListPlan {
  sourceId: number;
  name: string;
  folderName: string;
  memberCount: number;
  destinationId?: number;
  reused?: boolean;
}

export interface MoveBrevoRequest {
  environment: string;
  destinationApiKey: string;
  confirmEnvironment: string;
  dryRun: boolean;
  user?: string;
}

export interface MoveBrevoMemberRef {
  memberId: string;
  email: string;
}

export interface MoveBrevoResult {
  jobId: string | null;
  status: MoveBrevoStatus;
  environment: string;
  dryRun: boolean;
  domain: string;
  cloudflareConfigured: boolean;
  senders: MoveBrevoSenderPlan[];
  lists: MoveBrevoListPlan[];
  contactCount: number;
  skippedDoNotEmail: number;
  webhookConfigured: boolean;
  steps: string[];
  membersUpdated: MoveBrevoMemberRef[];
  dnsRecords: BrevoDomainDnsRecords | null;
  message: string | null;
  error: string | null;
}
