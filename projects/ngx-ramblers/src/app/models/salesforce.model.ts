import { MemberBulkLoadAudit } from "./member.model";

export interface SalesforceConfig {
  endpointBaseUrl: string;
  apiKeysByGroupCode: Record<string, string>;
  enabled: boolean;
  unsubscribeWritebackEnabled?: boolean;
  lastSyncedAt?: number;
}

export interface GroupCodeToken {
  groupCode: string;
  token: string;
}

export interface SalesforceTestConnectionResult {
  success: boolean;
  status?: number;
  latencyMs?: number;
  message?: string;
  errorCode?: string;
}

export interface SalesforceSyncRequest {
  fullSync?: boolean;
}

export interface SalesforceSyncApiResponse {
  action?: string;
  request?: SalesforceSyncRequest;
  response?: MemberBulkLoadAudit;
  error?: unknown;
}

export enum MemberBulkLoadSource {
  RAMBLERS_TEAM_EMAILS = "ramblers-team-emails",
  INSIGHT_HUB_XLSX = "insight-hub-xlsx",
}

export enum LegacyMemberBulkLoadSource {
  SALESFORCE_API = "salesforce-api",
  HEAD_OFFICE_SUPPORTER_IMPORT = "head-office-supporter-import",
}

export const SALESFORCE_BULK_LOAD_SOURCE = MemberBulkLoadSource.RAMBLERS_TEAM_EMAILS;
export const INSIGHT_HUB_BULK_LOAD_SOURCE = MemberBulkLoadSource.INSIGHT_HUB_XLSX;

export const RAMBLERS_TEAM_EMAILS_BULK_LOAD_SOURCES: string[] = [
  MemberBulkLoadSource.RAMBLERS_TEAM_EMAILS,
  LegacyMemberBulkLoadSource.SALESFORCE_API,
  LegacyMemberBulkLoadSource.HEAD_OFFICE_SUPPORTER_IMPORT,
];

export function isRamblersTeamEmailsBulkLoadSource(source: string | null | undefined): boolean {
  return !!source && RAMBLERS_TEAM_EMAILS_BULK_LOAD_SOURCES.includes(source);
}

export function memberBulkLoadSourceLabel(source: string | null | undefined): string {
  if (!source) {
    return "—";
  }
  if (isRamblersTeamEmailsBulkLoadSource(source)) {
    return "Ramblers Team Emails";
  }
  if (source === MemberBulkLoadSource.INSIGHT_HUB_XLSX) {
    return "Insight Hub import";
  }
  return source;
}

export interface ConsentWritebackContext {
  memberRef?: string;
  email?: string;
  membershipNumber?: string;
  reason?: string;
}

export enum ConsentWritebackSkipReason {
  Disabled = "DISABLED",
  NotConfigured = "NOT_CONFIGURED",
  NoMembershipNumber = "NO_MEMBERSHIP_NUMBER",
  MissingScope = "MISSING_SCOPE",
}

export interface ConsentWritebackOutcome {
  attempted: boolean;
  success?: boolean;
  status?: number;
  errorCode?: string;
  errorMessage?: string;
  latencyMs?: number;
  skippedReason?: ConsentWritebackSkipReason;
}
