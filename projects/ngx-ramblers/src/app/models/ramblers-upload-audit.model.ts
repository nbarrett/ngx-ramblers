import { ApiResponse, Identifiable } from "./api-response.model";

export interface AuditRamblersUploadParams {
  auditMessage: string;
  status?: Status,
  parserFunction: (auditMessage: string, status?: Status) => ParsedRamblersUploadAudit[];
}

export interface ParsedRamblersUploadAudit extends RamblersUploadAudit {
  audit: boolean;
}
export interface RamblersUploadAudit extends Identifiable {
  auditTime?: number;
  record?: number;
  fileName?: string;
  type?: AuditType;
  status?: Status;
  message?: string;
  errorResponse?: object;
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
  ERROR = "error",
}

export interface FileUploadSummary {
  fileName: string,
  status: Status
}
