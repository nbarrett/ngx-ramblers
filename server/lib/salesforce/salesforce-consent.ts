import debug from "debug";
import { SalesforceConfig, SalesforceConsentUpdateRequest } from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { envConfig } from "../env-config/env-config";
import { dateTimeNow } from "../shared/dates";
import { pushSalesforceConsent } from "./salesforce-client";
import { configuredSalesforce } from "./salesforce-config";

const debugLog = debug(envConfig.logNamespace("salesforce-consent"));
debugLog.enabled = true;

export interface ConsentWritebackContext {
  membershipNumber?: string;
  reason?: string;
}

export interface ConsentWritebackOutcome {
  attempted: boolean;
  success?: boolean;
  status?: number;
  errorCode?: string;
  errorMessage?: string;
  latencyMs?: number;
  skippedReason?: "DISABLED" | "NOT_CONFIGURED" | "NO_MEMBERSHIP_NUMBER";
}

export function buildFullOptOutConsentRequest(config: Pick<SalesforceConfig, "enableGranularConsent">, reason: string | undefined, timestampIso: string): SalesforceConsentUpdateRequest {
  const request: SalesforceConsentUpdateRequest = {
    emailMarketingConsent: false,
    source: "ngx-ramblers",
    timestamp: timestampIso,
    ...(reason ? { reason } : {}),
  };
  if (config.enableGranularConsent) {
    request.groupMarketingConsent = false;
    request.areaMarketingConsent = false;
    request.otherMarketingConsent = false;
  }
  return request;
}

export async function notifySalesforceFullyOptedOut(context: ConsentWritebackContext): Promise<ConsentWritebackOutcome> {
  if (!context.membershipNumber) {
    return { attempted: false, skippedReason: "NO_MEMBERSHIP_NUMBER" };
  }
  const config = await configuredSalesforce();
  if (!config) {
    return { attempted: false, skippedReason: "NOT_CONFIGURED" };
  }
  if (!config.enabled || !config.endpointBaseUrl) {
    return { attempted: false, skippedReason: "DISABLED" };
  }
  const request = buildFullOptOutConsentRequest(config, context.reason, dateTimeNow().toISO());
  const result = await pushSalesforceConsent(config, context.membershipNumber, request);
  if (result.data) {
    debugLog("notifySalesforceFullyOptedOut:success", context.membershipNumber, "in", result.latencyMs, "ms");
    return {
      attempted: true,
      success: true,
      status: result.status,
      latencyMs: result.latencyMs,
    };
  }
  debugLog("notifySalesforceFullyOptedOut:failed", context.membershipNumber, result.errorCode, result.errorMessage);
  return {
    attempted: true,
    success: false,
    status: result.status,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    latencyMs: result.latencyMs,
  };
}
