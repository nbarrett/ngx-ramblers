import debug from "debug";
import {
  MemberBulkLoadAudit,
  RamblersMember
} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {
  SALESFORCE_BULK_LOAD_SOURCE,
  SalesforceConfig,
  SalesforceMember
} from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig as loadSystemConfig } from "../config/system-config";
import { envConfig } from "../env-config/env-config";
import { dateTimeFromIso, dateTimeNow, dateTimeNowAsValue, formatDateTime } from "../shared/dates";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { fetchSalesforceMembers } from "./salesforce-client";
import { configuredSalesforce, parseGroupCodes, persistSalesforceConfig } from "./salesforce-config";
import { mapSalesforceMemberToRamblersMember } from "./salesforce-member-mapper";
import { memberBulkLoadAudit } from "../mongo/models/member-bulk-load-audit";

const debugLog = debug(envConfig.logNamespace("salesforce-sync"));
debugLog.enabled = true;

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

function emptyAudit(createdBy: string | undefined): MemberBulkLoadAudit {
  return {
    files: { archive: null, data: null },
    source: SALESFORCE_BULK_LOAD_SOURCE,
    auditLog: [],
    members: [],
    createdDate: dateTimeNowAsValue(),
    createdBy: createdBy ?? undefined,
  };
}

function logInfo(audit: MemberBulkLoadAudit, message: string) {
  debugLog(message);
  audit.auditLog.push({ status: "info", message });
}

function logComplete(audit: MemberBulkLoadAudit, message: string) {
  debugLog(message);
  audit.auditLog.push({ status: "complete", message });
}

function logError(audit: MemberBulkLoadAudit, message: string) {
  debugLog("error:", message);
  audit.auditLog.push({ status: "error", message });
  audit.error = audit.error ? `${audit.error}; ${message}` : message;
}

function ensureGroupCodes(systemConfig: SystemConfig): string[] {
  return parseGroupCodes(systemConfig?.group?.groupCode);
}

function mapMembers(salesforceMembers: SalesforceMember[], enableGranularConsent: boolean): RamblersMember[] {
  return salesforceMembers.map(member => mapSalesforceMemberToRamblersMember(member, { enableGranularConsent }));
}

function appendMembers(audit: MemberBulkLoadAudit, salesforceMembers: SalesforceMember[], enableGranularConsent: boolean): RamblersMember[] {
  const mapped = mapMembers(salesforceMembers, enableGranularConsent);
  audit.members.push(...mapped);
  return mapped;
}

async function previousBulkLoadMembers(): Promise<RamblersMember[]> {
  const latestAudit = await memberBulkLoadAudit.findOne().sort({ createdDate: -1 }).lean().exec();
  return latestAudit?.members ?? [];
}

export function rebuildFullMemberList(previousMembers: RamblersMember[], additions: RamblersMember[], removals: SalesforceMember[]): RamblersMember[] {
  const removedMembershipNumbers = new Set(removals.map(member => member.membershipNumber));
  const replacedMembershipNumbers = new Set(additions.map(member => member.membershipNumber));
  const retainedMembers = previousMembers.filter(member =>
    !removedMembershipNumbers.has(member.membershipNumber) && !replacedMembershipNumbers.has(member.membershipNumber));
  return [...retainedMembers, ...additions];
}

export async function runSalesforceSync(options: SalesforceSyncOptions = {}): Promise<SalesforceSyncOutcome> {
  const audit = emptyAudit(options.createdBy);
  const salesforceConfig = await configuredSalesforce();
  if (!salesforceConfig) {
    logError(audit, "Salesforce integration is not configured.");
    return { audit, config: null, status: 0, errorCode: "NOT_CONFIGURED", errorMessage: "Salesforce integration is not configured." };
  }
  if (!salesforceConfig.enabled) {
    logError(audit, "Salesforce integration is disabled in System Settings.");
    return { audit, config: salesforceConfig, status: 0, errorCode: "DISABLED", errorMessage: "Salesforce integration is disabled." };
  }
  if (!salesforceConfig.endpointBaseUrl) {
    logError(audit, "Salesforce endpoint base URL is not configured.");
    return { audit, config: salesforceConfig, status: 0, errorCode: "NOT_CONFIGURED", errorMessage: "Salesforce endpoint base URL is not configured." };
  }
  const systemConfig = await loadSystemConfig();
  const groupCodes = ensureGroupCodes(systemConfig);
  if (groupCodes.length === 0) {
    logError(audit, "Group code is not configured under Area & Group settings.");
    return { audit, config: salesforceConfig, status: 0, errorCode: "GROUP_CODE_MISSING", errorMessage: "Group code is not configured." };
  }

  const requestedFullSync = !!options.fullSync;
  const since = requestedFullSync ? undefined : salesforceConfig.lastSyncCursor;
  const syncMode = since ? `incremental since ${formatDateTime(dateTimeFromIso(since), UIDateFormat.DISPLAY_DATE_AND_TIME)}` : "full";
  const enableGranularConsent = !!salesforceConfig.enableGranularConsent;
  logInfo(audit, `Starting Salesforce sync (${syncMode}) for groups ${groupCodes.join(", ")} via ${salesforceConfig.endpointBaseUrl}. Granular consent: ${enableGranularConsent ? "respected" : "ignored (Insight Hub parity mode)"}.`);

  const startedAt = dateTimeNowAsValue();
  const tenantStatuses: number[] = [];
  const incrementalAdditions: SalesforceMember[] = [];
  const incrementalRemovals: SalesforceMember[] = [];

  for (const groupCode of groupCodes) {
    const result = await fetchSalesforceMembers(salesforceConfig, {
      groupCode,
      ...(since ? { since } : {}),
    });
    if (!result.data) {
      const message = `Salesforce sync failed for group ${groupCode}: ${result.errorCode || "UNKNOWN"} - ${result.errorMessage || "no response body"} (status ${result.status}, ${result.latencyMs}ms).`;
      logError(audit, message);
      return {
        audit,
        config: salesforceConfig,
        status: result.status,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      };
    }
    tenantStatuses.push(result.status);
    const response = result.data;
    logInfo(audit, `Salesforce returned ${response.totalCount ?? response.members?.length ?? 0} members for ${response.groupCode} (${response.groupName}) in ${result.latencyMs}ms.`);
    if (since) {
      const changes = response.changes ?? [];
      const additions = changes.filter(change => change.changeType !== "removed").map(change => change.member);
      const removals = changes.filter(change => change.changeType === "removed").map(change => change.member);
      incrementalAdditions.push(...additions);
      incrementalRemovals.push(...removals);
      logInfo(audit, `Incremental sync for ${groupCode}: ${additions.length} added/updated, ${removals.length} removed.`);
    } else if (response.members && response.members.length > 0) {
      appendMembers(audit, response.members, enableGranularConsent);
    }
  }

  if (since) {
    const previousMembers = await previousBulkLoadMembers();
    const mappedAdditions = mapMembers(incrementalAdditions, enableGranularConsent);
    audit.members = rebuildFullMemberList(previousMembers, mappedAdditions, incrementalRemovals);
    logInfo(audit, `Incremental sync rebuilt full member list from ${previousMembers.length} previously loaded: ${mappedAdditions.length} added/updated, ${incrementalRemovals.length} removed, ${audit.members.length} members now.`);
  }

  const cursor = dateTimeNow().toISO();
  const updatedConfig: SalesforceConfig = {
    ...salesforceConfig,
    lastSyncedAt: dateTimeNowAsValue(),
    lastSyncCursor: cursor,
  };
  await persistSalesforceConfig(updatedConfig);

  logComplete(audit, `Salesforce sync complete: mapped ${audit.members.length} members in ${dateTimeNowAsValue() - startedAt}ms.`);

  return {
    audit,
    config: updatedConfig,
    status: tenantStatuses[tenantStatuses.length - 1] ?? 0,
  };
}
