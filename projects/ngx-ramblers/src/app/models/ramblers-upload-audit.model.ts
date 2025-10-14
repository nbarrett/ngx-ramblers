import { ApiResponse, Identifiable } from "./api-response.model";
import { MessageType } from "./websocket.model";

export interface AuditRamblersUploadParams<T> {
  messageType: MessageType;
  auditMessage: T;
  status?: Status,
  parserFunction: (auditMessage: T, status?: Status) => ParsedRamblersUploadAudit[];
}

export interface ParsedRamblersUploadAudit {
  audit: boolean;
  data?: RamblersUploadAudit;
}
export interface RamblersUploadAudit extends Identifiable {
  auditTime?: number;
  type: AuditType;
  status: Status;
  message?: string;
  record?: number;
  fileName?: string;
  errorResponse?: any;
}

export interface RamblersUploadAuditApiResponse extends ApiResponse {
  request: any;
  response?: RamblersUploadAudit[];
}

export interface RamblersUploadSummaryResponse extends ApiResponse {
  request: any;
  response: FileUploadSummary[];
}

export enum AuditType {
  STDERR = "stderr",
  STEP = "step",
  SUMMARY = "summary",
}

export enum Status {
  ACTIVE = "active",
  COMPLETE = "complete",
  SUCCESS = "success",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
}

export interface FileUploadSummary {
  fileName: string,
  status: Status,
  earliestAuditTime?: number,
  latestAuditTime?: number
}

export interface DomainEventDataWithFinished {
  eventData: DomainEventData,
  finished: boolean
}

export interface DomainEventData {
  finished: boolean;
  activityId: string;
  details: {
    name: string;
    location: {
      column: number;
      line: number;
      path: string
    }
  };
  outcome: {
    code: number;
    error?: string
  };
  sceneId: string;
  timestamp: string;
}

export interface CurrentUploadSession {
  logStandardOut: boolean;
  record: number;
  fileName: string;
}
