#!/usr/bin/env npx ts-node --project tsconfig.tools.json

import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { login, CMSAuth } from "../release-notes/cms-client";
import { ConfigUpdateArguments, DEFAULT_CMS_BASE_URL } from "../release-notes/models";
import { isObject } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("scripts:update-config"));
debugLog.enabled = true;

const BACKUP_BUCKET = "ngx-ramblers-database-backups";
const BACKUP_REGION = "eu-west-1";

function createAuthHeaders(auth: CMSAuth): Record<string, string> {
  return {
    "Authorization": `Bearer ${auth.authToken}`,
    "Content-Type": "application/json"
  };
}

async function fetchConfigByKey(auth: CMSAuth, configKey: string): Promise<any> {
  const url = `${auth.baseUrl}/api/database/config?key=${configKey}`;
  debugLog(`Fetching ${configKey} config...`);

  const response = await fetch(url, { headers: createAuthHeaders(auth) });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch config: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.action === "query" ? data.response : data;
}

async function saveConfigByKey(auth: CMSAuth, configKey: string, value: any): Promise<void> {
  const url = `${auth.baseUrl}/api/database/config`;
  debugLog(`Updating ${configKey} config...`);

  const response = await fetch(url, {
    method: "POST",
    headers: createAuthHeaders(auth),
    body: JSON.stringify({ key: configKey, value })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update config: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  debugLog(`Update successful: ${data.action}`);
}

function setValueAtPath(obj: any, path: string, value: any): void {
  const parts = path.split(".");
  let current = obj;

  parts.slice(0, -1).forEach(part => {
    if (!(part in current) || !isObject(current[part])) {
      current[part] = {};
    }
    current = current[part];
  });

  current[parts[parts.length - 1]] = value;
}

function valueAtPath(obj: any, path: string): any {
  return path.split(".").reduce((current, part) => {
    if (current === null || current === undefined) return undefined;
    return current[part];
  }, obj);
}

function parseCommandLineArguments(args: string[]): ConfigUpdateArguments {
  const initial: ConfigUpdateArguments & {skipNext: boolean} = {
    action: "",
    configKey: undefined,
    baseUrl: process.env.CMS_BASE_URL || DEFAULT_CMS_BASE_URL,
    sets: [],
    dryRun: false,
    skipNext: false
  };

  const {skipNext: _, ...result} = args.reduce((acc, arg, i) => {
    if (acc.skipNext) return {...acc, skipNext: false};
    if (arg === "--base-url" && i + 1 < args.length) {
      return {...acc, baseUrl: args[i + 1], skipNext: true};
    }
    if (arg === "--set" && i + 1 < args.length) {
      const setValue = args[i + 1];
      const eqIndex = setValue.indexOf("=");
      const newSets = eqIndex > 0
        ? [...acc.sets, {path: setValue.substring(0, eqIndex), value: setValue.substring(eqIndex + 1)}]
        : acc.sets;
      return {...acc, sets: newSets, skipNext: true};
    }
    if (arg === "--dry-run") return {...acc, dryRun: true};
    if (!acc.action) return {...acc, action: arg};
    if (!acc.configKey) return {...acc, configKey: arg};
    return acc;
  }, initial);

  return result;
}

function printUsageInstructions(): void {
  debugLog(`
Usage: CMS_USERNAME=xxx CMS_PASSWORD=xxx npx ts-node --project tsconfig.tools.json server/lib/scripts/update-config.ts <action> [options]

Actions:
  view <configKey>           View the current config
  update <configKey>         Update config with values from --set options
  fix-backup-bucket          Apply the backup bucket fix

Options:
  --base-url <url>           CMS base URL (default: ${DEFAULT_CMS_BASE_URL})
  --set <path>=<value>       Set a config value (can be used multiple times)
  --dry-run                  Show changes without applying

Environment variables:
  CMS_USERNAME               Username for CMS login
  CMS_PASSWORD               Password for CMS login
  CMS_BASE_URL               Alternative to --base-url option
`);
}

function requireCredentials(): { username: string; password: string } {
  const username = process.env.CMS_USERNAME;
  const password = process.env.CMS_PASSWORD;

  if (!username || !password) {
    debugLog("Error: CMS_USERNAME and CMS_PASSWORD environment variables must be set");
    process.exit(1);
  }

  return { username, password };
}

async function executeViewAction(auth: CMSAuth, configKey: string): Promise<void> {
  const config = await fetchConfigByKey(auth, configKey);
  debugLog(JSON.stringify(config, null, 2));
}

async function executeUpdateAction(auth: CMSAuth, configKey: string, sets: { path: string; value: string }[], dryRun: boolean): Promise<void> {
  const config = await fetchConfigByKey(auth, configKey);

  debugLog("\nCurrent values:");
  sets.forEach(({ path }) => {
    debugLog(`  ${path}: ${JSON.stringify(valueAtPath(config, path))}`);
  });

  debugLog("\nApplying changes:");
  sets.forEach(({ path, value }) => {
    debugLog(`  ${path} = ${value}`);
    setValueAtPath(config, path, value);
  });

  if (dryRun) {
    debugLog("\n[DRY RUN] Would update config to:");
    debugLog(JSON.stringify(config, null, 2));
  } else {
    await saveConfigByKey(auth, configKey, config);
    debugLog("\nConfig updated successfully.");
  }
}

function printEnvironmentsSummary(config: any): void {
  debugLog("Current global AWS config:");
  debugLog(`  bucket: ${config.aws?.bucket || "(not set)"}`);
  debugLog(`  region: ${config.aws?.region || "(not set)"}`);

  debugLog("\nEnvironments:");
  if (config.environments) {
    config.environments.forEach((env: any) => {
      debugLog(`  - ${env.environment}: bucket=${env.aws?.bucket || "(not set)"}`);
    });
  }
}

function isBackupBucketAlreadyCorrect(config: any): boolean {
  return config.aws?.bucket === BACKUP_BUCKET && config.aws?.region === BACKUP_REGION;
}

async function executeFixBackupBucketAction(auth: CMSAuth, dryRun: boolean): Promise<void> {
  const config = await fetchConfigByKey(auth, "environments");

  printEnvironmentsSummary(config);

  if (isBackupBucketAlreadyCorrect(config)) {
    debugLog("\nGlobal AWS config is already correct. No changes needed.");
    return;
  }

  debugLog("\nApplying fix:");
  debugLog(`  Setting aws.bucket to: ${BACKUP_BUCKET}`);
  debugLog(`  Setting aws.region to: ${BACKUP_REGION}`);

  config.aws = { bucket: BACKUP_BUCKET, region: BACKUP_REGION };

  if (dryRun) {
    debugLog("\n[DRY RUN] Would update config.");
  } else {
    await saveConfigByKey(auth, "environments", config);
    debugLog("\nBackup bucket configuration fixed successfully.");
    debugLog("All backups will now use the dedicated backup bucket.");
  }
}

async function main() {
  const args = parseCommandLineArguments(process.argv.slice(2));

  if (!args.action) {
    printUsageInstructions();
    process.exit(1);
  }

  const { username, password } = requireCredentials();

  debugLog(`Connecting to ${args.baseUrl}...`);
  const auth = await login(args.baseUrl, username, password);
  debugLog("Logged in successfully\n");

  switch (args.action) {
    case "view": {
      if (!args.configKey) {
        debugLog("Error: config key required for view action");
        process.exit(1);
      }
      await executeViewAction(auth, args.configKey);
      break;
    }

    case "update": {
      if (!args.configKey) {
        debugLog("Error: config key required for update action");
        process.exit(1);
      }
      if (args.sets.length === 0) {
        debugLog("Error: at least one --set option required for update action");
        process.exit(1);
      }
      await executeUpdateAction(auth, args.configKey, args.sets, args.dryRun);
      break;
    }

    case "fix-backup-bucket": {
      await executeFixBackupBucketAction(auth, args.dryRun);
      break;
    }

    default:
      debugLog(`Unknown action: ${args.action}`);
      printUsageInstructions();
      process.exit(1);
  }
}

main().catch(err => {
  debugLog("Error:", err.message);
  process.exit(1);
});
