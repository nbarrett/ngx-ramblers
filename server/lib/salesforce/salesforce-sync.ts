import debug from "debug";
import {
  MemberBulkLoadAudit,
  RamblersMember,
} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {
  MemberBulkLoadSource,
  SalesforceConfig,
} from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig as loadSystemConfig } from "../config/system-config";
import { envConfig } from "../env-config/env-config";
import { dateTimeNowAsValue } from "../shared/dates";
import { fetchSalesforceMembers } from "./salesforce-client";
import { configuredSalesforce, parseGroupCodes, persistSalesforceConfig } from "./salesforce-config";
import { mapSalesforceMemberToRamblersMember } from "./salesforce-member-mapper";
import {
  SalesforceMember,
  SalesforceSyncOptions,
  SalesforceSyncOutcome,
  SnapshotReconciliation,
} from "./salesforce.model";
import { memberBulkLoadAudit } from "../mongo/models/member-bulk-load-audit";

const debugLog = debug(envConfig.logNamespace("salesforce-sync"));
debugLog.enabled = true;

function emptyAudit(createdBy: string | undefined): MemberBulkLoadAudit {
  return {
    files: { archive: null, data: null },
    source: MemberBulkLoadSource.RAMBLERS_TEAM_EMAILS,
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

function identityKeysOf(member: Partial<RamblersMember>): string[] {
  return [
    member.salesforceMemberRef,
    member.salesforceId,
    member.membershipNumber,
    member.email,
  ].filter((key): key is string => !!key);
}

function findMatchingMember(members: RamblersMember[], candidate: RamblersMember): RamblersMember | null {
  const candidateKeys = new Set(identityKeysOf(candidate));
  return members.find(member => identityKeysOf(member).some(key => candidateKeys.has(key))) ?? null;
}

export function reconcileSupporterSnapshot(
  previousMembers: RamblersMember[],
  supporters: SalesforceMember[],
): SnapshotReconciliation {
  const mapped = supporters.map(mapSalesforceMemberToRamblersMember);
  const currentMembers = mapped.reduce((result, candidate) => {
    const existing = findMatchingMember(result, candidate);
    return existing
      ? result.map(member => member === existing ? {...member, ...candidate} : member)
      : [...result, candidate];
  }, [] as RamblersMember[]);

  const counts = {newCount: 0, changedCount: 0, unchangedCount: 0};
  const reconciled = currentMembers.map(current => {
    const previous = findMatchingMember(previousMembers, current);
    if (!previous) {
      counts.newCount += 1;
      return current;
    }
    const merged = {...previous, ...current};
    if (JSON.stringify(previous) === JSON.stringify(merged)) {
      counts.unchangedCount += 1;
    } else {
      counts.changedCount += 1;
    }
    return merged;
  });

  const disappeared = previousMembers.filter(previous => !findMatchingMember(currentMembers, previous));
  return {
    members: reconciled,
    newCount: counts.newCount,
    changedCount: counts.changedCount,
    unchangedCount: counts.unchangedCount,
    disappearedCount: disappeared.length,
  };
}

async function previousBulkLoadMembers(): Promise<RamblersMember[]> {
  const latestAudit = await memberBulkLoadAudit.findOne().sort({ createdDate: -1 }).lean().exec();
  return latestAudit?.members ?? [];
}

export async function runSalesforceSync(options: SalesforceSyncOptions = {}): Promise<SalesforceSyncOutcome> {
  const audit = emptyAudit(options.createdBy);
  const salesforceConfig = await configuredSalesforce();
  if (!salesforceConfig) {
    logError(audit, "Salesforce integration is not configured.");
    return { audit, config: null, status: 0, errorCode: "NOT_CONFIGURED", errorMessage: "Salesforce integration is not configured." };
  } else if (!salesforceConfig.enabled) {
    logError(audit, "Salesforce integration is disabled in System Settings.");
    return { audit, config: salesforceConfig, status: 0, errorCode: "DISABLED", errorMessage: "Salesforce integration is disabled." };
  } else if (!salesforceConfig.endpointBaseUrl) {
    logError(audit, "Salesforce endpoint base URL is not configured.");
    return { audit, config: salesforceConfig, status: 0, errorCode: "NOT_CONFIGURED", errorMessage: "Salesforce endpoint base URL is not configured." };
  }

  const systemConfig = await loadSystemConfig();
  const groupCodes = ensureGroupCodes(systemConfig);
  if (groupCodes.length === 0) {
    logError(audit, "Group code is not configured under Area & Group settings.");
    return { audit, config: salesforceConfig, status: 0, errorCode: "GROUP_CODE_MISSING", errorMessage: "Group code is not configured." };
  }

  logInfo(audit, `Starting Ramblers Team Emails supporter snapshot for ${groupCodes.join(", ")} via ${salesforceConfig.endpointBaseUrl}.`);
  const startedAt = dateTimeNowAsValue();
  const statuses: number[] = [];
  const supporters: SalesforceMember[] = [];

  for (const groupCode of groupCodes) {
    const result = await fetchSalesforceMembers(salesforceConfig, { groupCode });
    if (!result.data) {
      const message = `Supporter snapshot failed for ${groupCode}: ${result.errorCode || "UNKNOWN"} - ${result.errorMessage || "no response body"} (status ${result.status}, ${result.latencyMs}ms).`;
      logError(audit, message);
      return { audit, config: salesforceConfig, status: result.status, errorCode: result.errorCode, errorMessage: result.errorMessage };
    }
    statuses.push(result.status);
    supporters.push(...result.data);
    logInfo(audit, `Ramblers Team Emails returned ${result.data.length} supporters for ${groupCode} in ${result.latencyMs}ms.`);
  }

  const previousMembers = await previousBulkLoadMembers();
  const reconciliation = reconcileSupporterSnapshot(previousMembers, supporters);
  audit.members = reconciliation.members;
  logInfo(
    audit,
    `Snapshot reconciliation: ${reconciliation.newCount} new, ${reconciliation.changedCount} changed, ${reconciliation.unchangedCount} unchanged and ${reconciliation.disappearedCount} no longer present in this snapshot (not prepared for apply).`,
  );

  const updatedConfig: SalesforceConfig = {
    ...salesforceConfig,
    lastSyncedAt: dateTimeNowAsValue(),
    lastSyncCursor: null,
  };
  await persistSalesforceConfig(updatedConfig);
  logComplete(audit, `Supporter snapshot complete: ${audit.members.length} records prepared in ${dateTimeNowAsValue() - startedAt}ms.`);

  return {
    audit,
    config: updatedConfig,
    status: statuses[statuses.length - 1] ?? 0,
  };
}
