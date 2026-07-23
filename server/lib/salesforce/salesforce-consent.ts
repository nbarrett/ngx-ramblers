import debug from "debug";
import { ConsentWritebackContext, ConsentWritebackOutcome, ConsentWritebackSkipReason } from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { envConfig } from "../env-config/env-config";
import { activeGroupCodeWithToken, pushSalesforceConsent } from "./salesforce-client";
import { configuredSalesforce, parseGroupCodes } from "./salesforce-config";
import { systemConfig } from "../config/system-config";

const debugLog = debug(envConfig.logNamespace("salesforce-consent"));
debugLog.enabled = true;

export async function notifySalesforceFullyOptedOut(context: ConsentWritebackContext): Promise<ConsentWritebackOutcome> {
  if (!context.memberRef || !context.email) {
    return { attempted: false, skippedReason: ConsentWritebackSkipReason.MissingScope };
  }
  const config = await configuredSalesforce();
  if (!config) {
    return { attempted: false, skippedReason: ConsentWritebackSkipReason.NotConfigured };
  } else if (!config.enabled || !config.endpointBaseUrl || !config.unsubscribeWritebackEnabled) {
    return { attempted: false, skippedReason: ConsentWritebackSkipReason.Disabled };
  }
  const sys = await systemConfig();
  const siteGroupCode = sys?.group?.groupCode ?? "";
  const active = activeGroupCodeWithToken(config, siteGroupCode);
  const groupCode = active?.groupCode ?? parseGroupCodes(siteGroupCode)[0] ?? "";
  const result = await pushSalesforceConsent(config, {
    emailAddress: context.email,
    memberRef: context.memberRef,
  }, groupCode);
  if (result.data) {
    debugLog("notifySalesforceFullyOptedOut:success", context.memberRef, "in", result.latencyMs, "ms");
    return { attempted: true, success: true, status: result.status, latencyMs: result.latencyMs };
  }
  debugLog("notifySalesforceFullyOptedOut:failed", context.memberRef, result.errorCode, result.errorMessage);
  return {
    attempted: true,
    success: false,
    status: result.status,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    latencyMs: result.latencyMs,
  };
}
