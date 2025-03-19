import { ApiResponse, Identifiable } from "./api-response.model";

export interface ParsedRamblersUploadAudit extends RamblersUploadAudit {
  audit: boolean;
}
export interface RamblersUploadAudit extends Identifiable {
  auditTime?: number;
  record?: number;
  fileName?: string;
  type?: string;
  status?: string;
  message?: string;
  errorResponse?: object;
}

export interface RamblersUploadAuditApiResponse extends ApiResponse {
  request: any;
  response?: RamblersUploadAudit[];
}
