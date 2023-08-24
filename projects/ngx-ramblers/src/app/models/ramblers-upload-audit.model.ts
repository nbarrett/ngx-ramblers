import { ApiResponse } from "./api-response.model";

export interface RamblersUploadAudit {
  auditTime: number;
  fileName: string;
  type: string;
  status: string;
  message: string;
  errorResponse?: object;
}

export interface RamblersUploadAuditApiResponse extends ApiResponse {
  request: any;
  response?: RamblersUploadAudit[];
}
