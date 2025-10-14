import { ApiResponse, Identifiable } from "./api-response.model";

export interface MigrationAuditLog {
  time: number;
  status?: string;
  message: string;
}

export interface MigrationHistory extends Identifiable {
  createdDate: number;
  completedDate?: number;
  siteIdentifier?: string;
  siteName?: string;
  persistData?: boolean;
  uploadTos3?: boolean;
  status?: string;
  summary?: string;
  auditLog: MigrationAuditLog[];
}

export interface MigrationHistoryApiResponse extends ApiResponse {
  response: MigrationHistory | MigrationHistory[];
}

