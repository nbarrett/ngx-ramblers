import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { FlyMachineSummary, FlyRestartResult } from "./fly.model";
import { FlyMachineState, FlyTargetApp } from "../../../projects/ngx-ramblers/src/app/models/health.model";
import { flyRuntimeConfig } from "./fly-runtime-config";
import { flyAuthorizationHeader, MACHINES_API_BASE, missingFlyConfig } from "./fly-env";

const debugLog = debug(envConfig.logNamespace("fly:machines"));
debugLog.enabled = true;

async function listMachines(apiToken: string, appName: string): Promise<FlyMachineSummary[]> {
  const response = await fetch(`${MACHINES_API_BASE}/apps/${appName}/machines`, { headers: { Authorization: flyAuthorizationHeader(apiToken) } });
  if (!response.ok) {
    throw new Error(`Machine list failed: ${response.status}`);
  }
  return response.json();
}

async function queryMachine(apiToken: string, appName: string, machineId: string): Promise<FlyMachineSummary> {
  const response = await fetch(`${MACHINES_API_BASE}/apps/${appName}/machines/${machineId}`, { headers: { Authorization: flyAuthorizationHeader(apiToken) } });
  if (!response.ok) {
    throw new Error(`Machine query failed: ${response.status}`);
  }
  return response.json();
}

async function resolveMachine(apiToken: string, appName: string, configured: string): Promise<FlyMachineSummary | null> {
  if (configured) {
    return queryMachine(apiToken, appName, configured);
  }
  const machines = await listMachines(apiToken, appName);
  return machines.find(machine => machine.state === "started") || machines[0] || null;
}

async function resolveMachineId(apiToken: string, appName: string, configured: string): Promise<string> {
  if (configured) {
    return configured;
  }
  const machines = await listMachines(apiToken, appName);
  const started = machines.find(machine => machine.state === "started") || machines[0];
  return started?.id || "";
}

export async function currentMachineState(target: FlyTargetApp = FlyTargetApp.ENVIRONMENT): Promise<FlyMachineState> {
  const { apiToken, appName, machineId: configuredMachineId } = await flyRuntimeConfig(target);
  const missing = missingFlyConfig({ FLY_API_TOKEN: apiToken, FLY_APP_NAME: appName });
  if (missing) {
    return { available: false, error: `Machine state is not configured for this environment (missing ${missing})` };
  }
  try {
    const machine = await resolveMachine(apiToken, appName, configuredMachineId);
    if (!machine) {
      return { available: false, error: `No machine found for app ${appName}` };
    }
    const updatedAt = Date.parse(machine.updated_at || "");
    return {
      available: true,
      machineId: machine.id,
      state: machine.state,
      updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0
    };
  } catch (error) {
    debugLog("Machine state query failed:", error);
    return { available: false, error: error?.message || "Fly machine state query failed" };
  }
}

export async function restartCurrentMachine(target: FlyTargetApp = FlyTargetApp.ENVIRONMENT): Promise<FlyRestartResult> {
  const { apiToken, appName, machineId: configuredMachineId } = await flyRuntimeConfig(target);
  const missing = missingFlyConfig({ FLY_API_TOKEN: apiToken, FLY_APP_NAME: appName });
  if (missing) {
    return { ok: false, error: `Restart is not configured for this environment (missing ${missing})` };
  }
  const machineId = await resolveMachineId(apiToken, appName, configuredMachineId).catch(() => "");
  if (!machineId) {
    return { ok: false, error: `No machine found to restart for app ${appName}` };
  }
  const url = `${MACHINES_API_BASE}/apps/${appName}/machines/${machineId}/restart`;
  debugLog(`Restarting machine ${machineId} for app ${appName}`);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: flyAuthorizationHeader(apiToken) }
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      debugLog(`Restart failed: ${response.status} ${text}`);
      return { ok: false, error: `Fly restart failed: ${response.status} ${text}`.trim() };
    }
    debugLog(`Restart triggered for ${appName}/${machineId}`);
    return { ok: true };
  } catch (error) {
    debugLog("Restart request failed:", error);
    return { ok: false, error: error?.message || "Fly restart request failed" };
  }
}
