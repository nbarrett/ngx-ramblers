import debug from "debug";
import { keys, toPairs } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { FlyMachineSummary, FlyRestartResult } from "./fly.model";
import { FlyMachineState, FlyTargetApp } from "../../../projects/ngx-ramblers/src/app/models/health.model";
import { flyRuntimeConfig } from "./fly-runtime-config";
import { flyAuthorizationHeader, MACHINES_API_BASE, missingFlyConfig } from "./fly-env";

const FLY_GRAPHQL_API = "https://api.fly.io/graphql";

export function flySecretsUpdateConfirmed(body: { data?: { setSecrets?: unknown } } | null): boolean {
  return !!body?.data?.setSecrets;
}

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

export async function currentMachineState(target: FlyTargetApp = FlyTargetApp.ENVIRONMENT, environmentName: string | null = null): Promise<FlyMachineState> {
  const { apiToken, appName, machineId: configuredMachineId } = await flyRuntimeConfig(target, environmentName);
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

export async function setCurrentMachineSecrets(
  secrets: Record<string, string>,
  target: FlyTargetApp = FlyTargetApp.ENVIRONMENT,
  environmentName: string | null = null
): Promise<FlyRestartResult> {
  const { apiToken, appName } = await flyRuntimeConfig(target, environmentName);
  const missing = missingFlyConfig({ FLY_API_TOKEN: apiToken, FLY_APP_NAME: appName });
  if (missing) {
    return { ok: false, error: `Fly secrets are not configured for this environment (missing ${missing})` };
  } else {
    const secretList = toPairs(secrets)
      .filter(([, value]) => !!value)
      .map(([key, value]) => ({ key, value }));
    if (!secretList.length) {
      return { ok: false, error: "No Fly secrets were supplied for cutover" };
    } else {
      debugLog(`Setting ${secretList.length} Fly secrets on ${appName}: ${secretList.map(entry => entry.key).join(", ")}`);
      try {
        const response = await fetch(FLY_GRAPHQL_API, {
          method: "POST",
          headers: {
            Authorization: flyAuthorizationHeader(apiToken),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query: "mutation($input: SetSecretsInput!) { setSecrets(input: $input) { release { version } } }",
            variables: { input: { appId: appName, secrets: secretList } }
          })
        });
        const body = await response.json();
        if (!response.ok) {
          debugLog(`Fly secrets update failed: ${response.status}`);
          return { ok: false, error: `Fly secrets update failed: ${response.status}` };
        } else if (body?.errors?.length) {
          const message = body.errors[0]?.message || "GraphQL error";
          debugLog(`Fly secrets update failed: ${message}`);
          return { ok: false, error: `Fly secrets update failed: ${message}` };
        } else if (!flySecretsUpdateConfirmed(body)) {
          debugLog(`Fly secrets update returned no setSecrets payload for ${appName}: ${JSON.stringify(keys(body?.data || {}))}`);
          return { ok: false, error: "Fly did not confirm a secrets update for cutover" };
        } else {
          const releaseVersion = body?.data?.setSecrets?.release?.version;
          const published = await publishAppSecrets(apiToken, appName, secretList);
          if (!published.ok) {
            return published;
          } else {
            debugLog(`Fly secrets updated on ${appName}${releaseVersion ? ` (release ${releaseVersion})` : ""}${published.secretsVersion ? ` (secrets version ${published.secretsVersion})` : ""}`);
            return { ok: true, secretsVersion: published.secretsVersion };
          }
        }
      } catch (error) {
        debugLog("Fly secrets request failed:", error);
        return { ok: false, error: error?.message || "Fly secrets request failed" };
      }
    }
  }
}

async function publishAppSecrets(apiToken: string, appName: string, secretList: {key: string; value: string}[]): Promise<FlyRestartResult> {
  const values = secretList.reduce((record, entry) => ({...record, [entry.key]: entry.value}), {} as Record<string, string>);
  try {
    const response = await fetch(`${MACHINES_API_BASE}/apps/${appName}/secrets`, {
      method: "POST",
      headers: {
        Authorization: flyAuthorizationHeader(apiToken),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({values})
    });
    const body = await response.json().catch(() => ({}));
    const secretsVersion = body?.version || body?.Version;
    if (!response.ok) {
      return {ok: false, error: `Fly Machines secrets update failed: ${response.status}`};
    } else if (!secretsVersion) {
      return {ok: false, error: "Fly did not return a secrets version for cutover"};
    } else {
      return {ok: true, secretsVersion};
    }
  } catch (error) {
    return {ok: false, error: error?.message || "Fly Machines secrets update failed"};
  }
}

export async function restartCurrentMachine(target: FlyTargetApp = FlyTargetApp.ENVIRONMENT, environmentName: string | null = null, secretsVersion: number | null = null): Promise<FlyRestartResult> {
  const { apiToken, appName, machineId: configuredMachineId } = await flyRuntimeConfig(target, environmentName);
  const missing = missingFlyConfig({ FLY_API_TOKEN: apiToken, FLY_APP_NAME: appName });
  if (missing) {
    return { ok: false, error: `Restart is not configured for this environment (missing ${missing})` };
  }
  const machineId = await resolveMachineId(apiToken, appName, configuredMachineId).catch(() => "");
  if (!machineId) {
    return { ok: false, error: `No machine found to restart for app ${appName}` };
  }
  try {
    if (secretsVersion) {
      const machine = await queryMachine(apiToken, appName, machineId);
      const response = await fetch(`${MACHINES_API_BASE}/apps/${appName}/machines/${machineId}`, {
        method: "POST",
        headers: {
          Authorization: flyAuthorizationHeader(apiToken),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({config: machine.config || {}, min_secrets_version: secretsVersion})
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        debugLog(`Machine secrets refresh failed: ${response.status} ${text}`);
        return { ok: false, error: `Fly machine secrets refresh failed: ${response.status} ${text}`.trim() };
      } else {
        debugLog(`Machine ${machineId} updated to secrets version ${secretsVersion} for ${appName}`);
        return { ok: true, secretsVersion };
      }
    } else {
      const url = `${MACHINES_API_BASE}/apps/${appName}/machines/${machineId}/restart`;
      debugLog(`Restarting machine ${machineId} for app ${appName}`);
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: flyAuthorizationHeader(apiToken) }
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        debugLog(`Restart failed: ${response.status} ${text}`);
        return { ok: false, error: `Fly restart failed: ${response.status} ${text}`.trim() };
      } else {
        debugLog(`Restart triggered for ${appName}/${machineId}`);
        return { ok: true };
      }
    }
  } catch (error) {
    debugLog("Restart request failed:", error);
    return { ok: false, error: error?.message || "Fly restart request failed" };
  }
}
