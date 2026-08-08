import debug from "debug";
import { keys, toPairs } from "es-toolkit/compat";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import { connect as connectToDatabase } from "../mongo/mongoose-client";
import { filterSecretsForSiteFlyDeploy, isAllowedSiteFlySecret, disallowedSiteFlySecrets } from "./fly-secrets-policy";
import { runCommand } from "./fly-commands";

const debugLog = debug(envConfig.logNamespace("fly:secrets-prune"));
debugLog.enabled = true;

export interface FlySecretsPruneResult {
  appName: string;
  listed: string[];
  removed: string[];
  kept: string[];
  dryRun: boolean;
}

export function listFlySecretNames(appName: string): string[] {
  const output = runCommand(`flyctl secrets list --app ${appName} --json`, true);
  if (!output?.trim()) {
    return [];
  } else {
    try {
      const parsed = JSON.parse(output) as Array<{ name?: string; Name?: string }>;
      return parsed
        .map(entry => entry.name || entry.Name || "")
        .filter(name => !!name)
        .sort();
    } catch (error) {
      debugLog("Failed to parse fly secrets list JSON for %s, falling back to text parse: %s", appName, error?.message || error);
      return output
        .split(/\r?\n/)
        .map(line => line.split("│")[0]?.trim() || "")
        .filter(name => !!name && name !== "NAME" && !name.startsWith("─") && /^[A-Z0-9_]+$/.test(name))
        .sort();
    }
  }
}

export function pruneDisallowedFlySecrets(
  appName: string,
  execute: boolean,
  options?: {stage?: boolean}
): FlySecretsPruneResult {
  const listed = listFlySecretNames(appName);
  const removed = disallowedSiteFlySecrets(listed);
  const kept = listed.filter(name => isAllowedSiteFlySecret(name));
  const stage = options?.stage === true;
  if (execute && removed.length > 0) {
    const batchSize = 20;
    const batches = removed.reduce<string[][]>((accumulator, key, index) => {
      const batchIndex = Math.floor(index / batchSize);
      const batch = accumulator[batchIndex] || [];
      batch.push(key);
      accumulator[batchIndex] = batch;
      return accumulator;
    }, []);
    batches.forEach(batch => {
      const stageFlag = stage ? " --stage" : "";
      runCommand(`flyctl secrets unset ${batch.join(" ")} --app ${appName}${stageFlag}`);
    });
    if (stage) {
      debugLog("Staged unset of %d secrets on %s (applied on next deploy/restart): %s", removed.length, appName, removed.join(", "));
    } else {
      debugLog("Unset %d secrets on %s: %s", removed.length, appName, removed.join(", "));
    }
  } else if (!execute) {
    debugLog("Dry-run: would unset %d secrets on %s: %s", removed.length, appName, removed.join(", ") || "(none)");
  } else {
    debugLog("No disallowed secrets to unset on %s", appName);
  }
  return {
    appName,
    listed,
    removed,
    kept,
    dryRun: !execute
  };
}

export interface EnvironmentsSecretsCleanResult {
  globalRemoved: string[];
  perEnvironment: Array<{environment: string; removed: string[]}>;
  dryRun: boolean;
}

export async function cleanDisallowedSecretsFromEnvironmentsConfig(execute: boolean): Promise<EnvironmentsSecretsCleanResult> {
  await connectToDatabase(debugLog);
  const existingDoc = await config.queryKey(ConfigKey.ENVIRONMENTS);
  const existing: EnvironmentsConfig = existingDoc?.value || {environments: []};
  const globalSecrets = existing.secrets || {};
  const globalRemoved = keys(globalSecrets).filter(key => !isAllowedSiteFlySecret(key)).sort();
  const perEnvironment = (existing.environments || []).map(env => {
    const envSecrets = env.secrets || {};
    const removed = keys(envSecrets).filter(key => !isAllowedSiteFlySecret(key)).sort();
    return {environment: env.environment, removed};
  }).filter(entry => entry.removed.length > 0);

  if (execute && (globalRemoved.length > 0 || perEnvironment.length > 0)) {
    const cleanedGlobal = filterSecretsForSiteFlyDeploy(globalSecrets);
    const cleanedEnvironments = (existing.environments || []).map(env => ({
      ...env,
      secrets: env.secrets ? filterSecretsForSiteFlyDeploy(env.secrets) : env.secrets
    }));
    await config.createOrUpdateKey(ConfigKey.ENVIRONMENTS, {
      ...existing,
      secrets: cleanedGlobal,
      environments: cleanedEnvironments
    });
    debugLog(
      "Cleaned platform environments config secrets: global removed %s; per-env %s",
      globalRemoved.join(", ") || "(none)",
      perEnvironment.map(entry => `${entry.environment}[${entry.removed.join(",")}]`).join("; ") || "(none)"
    );
  } else {
    debugLog(
      "Dry-run environments config secrets clean: global would remove %s; per-env %s",
      globalRemoved.join(", ") || "(none)",
      perEnvironment.map(entry => `${entry.environment}[${entry.removed.join(",")}]`).join("; ") || "(none)"
    );
  }

  return {
    globalRemoved,
    perEnvironment,
    dryRun: !execute
  };
}

export function summariseLegacyKeys(secretNames: string[]): string {
  return toPairs(
    secretNames.reduce((accumulator, name) => ({...accumulator, [name]: true}), {} as Record<string, boolean>)
  ).map(([name]) => name).sort().join(", ");
}
