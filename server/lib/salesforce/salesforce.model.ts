import type { BouncedEmailRequest, Supporter } from "@ramblers/sf-contract";
import type {
  MemberBulkLoadAudit,
  RamblersMember,
} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import type { SalesforceConfig } from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";

export interface SalesforceListOptions {
  groupCode: string;
}

export interface SalesforceClientResult<T> {
  status: number;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
  latencyMs: number;
}

export interface SalesforceSyncOptions {
  fullSync?: boolean;
  createdBy?: string;
}

export interface SalesforceSyncOutcome {
  audit: MemberBulkLoadAudit;
  config: SalesforceConfig;
  status: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface SnapshotReconciliation {
  members: RamblersMember[];
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  disappearedCount: number;
}

export enum SalesforceBounceStatus {
  Delivered = "delivered",
  Failed = "failed",
  MissingReference = "missing-reference",
  NotConfigured = "not-configured",
}

export interface SalesforceBounceContext {
  memberId: string;
  email: string;
  memberRef?: string;
  eventKey: string;
  bounceType: BouncedEmailRequest["bounceType"];
}

export type SalesforceMember = Supporter;
