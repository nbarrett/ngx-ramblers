import { spawnSync } from "child_process";
import debug from "debug";
import { keys } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { parseEnvContent } from "../shared/env-parser";

const debugLog = debug(envConfig.logNamespace("secrets:fly"));

function findStartedMachineId(appName: string, flyApiToken: string): string | null {
  const result = spawnSync("flyctl", ["machine", "list", "-a", appName, "--access-token", flyApiToken, "--json"], {
    encoding: "utf-8",
    timeout: 15000,
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0 || result.error) {
    debugLog("Failed to list machines for %s: %s", appName, result.stderr?.trim() || result.error?.message || "unknown error");
    return null;
  }

  try {
    const machines: { id: string; state: string }[] = JSON.parse(result.stdout || "[]");
    const started = machines.find(m => m.state === "started");
    if (started) {
      debugLog("Found started machine %s for app %s", started.id, appName);
      return started.id;
    }
    debugLog("No started machines found for app %s", appName);
    return null;
  } catch (parseError) {
    debugLog("Failed to parse machine list for %s: %s", appName, parseError);
    return null;
  }
}

export function pullAllSecretsFromFly(appName: string, flyApiToken: string): Record<string, string> {
  if (!flyApiToken) {
    debugLog("No Fly API token available for %s — skipping", appName);
    return {};
  }

  const machineId = findStartedMachineId(appName, flyApiToken);
  if (!machineId) {
    debugLog("Cannot pull secrets without a running machine for %s", appName);
    return {};
  }

  debugLog("Pulling environment variables from Fly.io app %s machine %s", appName, machineId);

  const result = spawnSync("flyctl", ["machine", "exec", machineId, "env", "-a", appName, "--access-token", flyApiToken, "--timeout", "10"], {
    encoding: "utf-8",
    timeout: 15000,
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0 || result.error) {
    debugLog("Failed to exec on machine %s for %s: %s", machineId, appName, result.stderr?.trim() || result.error?.message || "unknown error");
    return {};
  }

  const allSecrets = parseEnvContent(result.stdout || "");
  debugLog("Pulled %d environment variables from Fly.io app %s", keys(allSecrets).length, appName);
  return allSecrets;
}

export function pullMissingSecrets(appName: string, required: string[], existing: Record<string, string>, flyApiToken: string): Record<string, string> {
  const missing = required.filter(key => !existing[key]);

  if (missing.length === 0) {
    debugLog("All required secrets present, no Fly.io pull needed");
    return {};
  }

  debugLog("Missing %d secrets: %s — pulling from Fly.io app %s", missing.length, missing.join(", "), appName);

  const allFlySecrets = pullAllSecretsFromFly(appName, flyApiToken);

  if (keys(allFlySecrets).length === 0) {
    debugLog("Warning: could not pull any secrets from Fly.io app %s", appName);
    return {};
  }

  const pulled: Record<string, string> = {};
  const failed: string[] = [];

  missing.forEach(secretName => {
    if (allFlySecrets[secretName]) {
      pulled[secretName] = allFlySecrets[secretName];
    } else {
      failed.push(secretName);
    }
  });

  if (failed.length > 0) {
    debugLog("Warning: %d secrets not found in Fly.io environment: %s", failed.length, failed.join(", "));
  }

  if (keys(pulled).length > 0) {
    debugLog("Successfully extracted %d secrets from Fly.io: %s", keys(pulled).length, keys(pulled).join(", "));
  }

  return pulled;
}
