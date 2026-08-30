import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { booleanOf } from "../shared/string-utils";
import { crossEnvironmentHostnameHealth, environmentHostnameHealth, probeCustomDomainEligibility } from "./hostname-health";
import { EnvironmentNotFoundError } from "./environment-context";

const debugLog = debug(envConfig.logNamespace("hostname-health-controllers"));
const errorDebugLog = createErrorDebugLog(envConfig.logNamespace("hostname-health-controllers"));

export async function hostnameHealth(req: Request, res: Response): Promise<void> {
  try {
    const { environmentName } = req.params;
    debugLog("Hostname health request for:", environmentName);
    const report = await environmentHostnameHealth(environmentName);
    debugLog("Hostname health for %s: %s hostnames, %s problems", environmentName, report.hostnames.length, report.problemCount);
    res.json(report);
  } catch (error) {
    errorDebugLog("Error checking hostname health:", error.message);
    res.status(500).json({ error: error.message });
  }
}

export async function probeCustomDomain(req: Request, res: Response): Promise<void> {
  try {
    const { environmentName } = req.params;
    const { hostname } = req.body || {};
    debugLog("Probe custom domain eligibility for:", environmentName, hostname);
    if (!hostname) {
      res.status(400).json({ success: false, message: "hostname is required" });
    } else {
      const eligibility = await probeCustomDomainEligibility(environmentName, hostname);
      res.json({ success: true, eligibility });
    }
  } catch (error) {
    if (error instanceof EnvironmentNotFoundError) {
      res.status(404).json({ success: false, message: error.message });
    } else {
      errorDebugLog("Error probing custom domain eligibility:", error.message);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export async function allHostnameHealth(req: Request, res: Response): Promise<void> {
  try {
    const forceRefresh = booleanOf(req.query.refresh as string);
    const result = await crossEnvironmentHostnameHealth(forceRefresh);
    debugLog("Returning hostname health for %s environments, %s problems, fromCache %s",
      result.environments.length, result.totalProblemCount, result.fromCache);
    res.json(result);
  } catch (error) {
    errorDebugLog("Error checking hostname health across environments:", error.message);
    res.status(500).json({ error: error.message });
  }
}
