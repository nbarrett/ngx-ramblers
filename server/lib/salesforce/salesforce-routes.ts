import debug from "debug";
import express, { Request, Response } from "express";
import { isString } from "es-toolkit/compat";
import * as authConfig from "../auth/auth-config";
import { systemConfig as loadSystemConfig } from "../config/system-config";
import { envConfig } from "../env-config/env-config";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import {
  SalesforceConfig,
  SalesforceTestConnectionResult
} from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { pingSalesforce } from "./salesforce-client";
import { configuredSalesforce, parseGroupCodes } from "./salesforce-config";
import { runSalesforceSync } from "./salesforce-sync";

const debugLog = debug(envConfig.logNamespace("salesforce-routes"));
debugLog.enabled = false;

const router = express.Router();

router.post("/test-connection", authConfig.authenticate(), async (req: Request, res: Response) => {
  const overrideConfig: SalesforceConfig | undefined = req.body?.config;
  const persistedConfig = await configuredSalesforce();
  const candidateConfig: SalesforceConfig | null = overrideConfig
    ? { ...(persistedConfig || ({} as SalesforceConfig)), ...overrideConfig }
    : persistedConfig;
  if (!candidateConfig?.endpointBaseUrl) {
    const result: SalesforceTestConnectionResult = {
      success: false,
      errorCode: "NOT_CONFIGURED",
      message: "Endpoint base URL is not configured.",
    };
    return res.status(200).json(result);
  }
  const systemConfig = await loadSystemConfig();
  const groupCodes = parseGroupCodes(systemConfig?.group?.groupCode);
  if (groupCodes.length === 0) {
    const result: SalesforceTestConnectionResult = {
      success: false,
      errorCode: "GROUP_CODE_MISSING",
      message: "Group code is not configured under Area & Group settings.",
    };
    return res.status(200).json(result);
  }
  const requestedCode = isString(req.body?.groupCode) ? req.body.groupCode.trim() : "";
  const groupCode = groupCodes.includes(requestedCode) ? requestedCode : groupCodes[0];
  const probe = await pingSalesforce(candidateConfig, groupCode);
  const result: SalesforceTestConnectionResult = {
    success: !!probe.data,
    status: probe.status,
    latencyMs: probe.latencyMs,
    ...(probe.errorCode ? { errorCode: probe.errorCode } : {}),
    ...(probe.errorMessage
      ? { message: probe.errorMessage }
      : probe.data
        ? { message: `Reached ${candidateConfig.endpointBaseUrl} for group ${groupCode}.` }
        : {}),
  };
  return res.status(200).json(result);
});

router.post("/sync", authConfig.authenticate(), async (req: Request, res: Response) => {
  const fullSync = !!req.body?.fullSync;
  const createdBy = (req as any).user?.memberId;
  const outcome = await runSalesforceSync({ fullSync, createdBy });
  const apiResponse = {
    action: ApiAction.UPDATE,
    request: { fullSync },
    response: outcome.audit,
    ...(outcome.errorMessage ? { error: outcome.errorMessage } : {}),
  };
  if (outcome.errorMessage) {
    return res.status(200).json(apiResponse);
  }
  return res.status(200).json(apiResponse);
});

export const salesforceRoutes = router;
