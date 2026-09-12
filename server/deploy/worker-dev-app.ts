import fs from "fs";
import os from "os";
import path from "path";
import { runCommand } from "../lib/fly/fly-commands";
import { configuredEnvironments } from "../lib/environments/environments-config";
import { FLYIO_DEFAULTS } from "../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { importWorkerSecrets } from "./deploy-integration-worker";
import { PROD_WORKER_APP } from "./watch-and-deploy-worker";
import { applyFlyOrganisationToken } from "./fly-org-token";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DEV_WORKER_STATE_FILE = path.join(PROJECT_ROOT, ".ngx-cli-dev-worker");

function sanitiseSuffix(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function devWorkerAppName(suffix?: string): string {
  const resolvedSuffix = sanitiseSuffix(suffix || os.userInfo().username || "dev");
  return `${PROD_WORKER_APP}-dev-${resolvedSuffix}`;
}

export function devWorkerUrl(appName: string): string {
  return `https://${appName}.fly.dev`;
}

export function writeActiveDevWorkerApp(appName: string): void {
  fs.writeFileSync(DEV_WORKER_STATE_FILE, `${appName}\n`, "utf-8");
}

export function readActiveDevWorkerApp(): string | null {
  if (fs.existsSync(DEV_WORKER_STATE_FILE)) {
    const value = fs.readFileSync(DEV_WORKER_STATE_FILE, "utf-8").trim();
    return value || null;
  } else {
    return null;
  }
}

export function clearActiveDevWorkerApp(): void {
  if (fs.existsSync(DEV_WORKER_STATE_FILE)) {
    fs.unlinkSync(DEV_WORKER_STATE_FILE);
  }
}

function appExists(appName: string): boolean {
  try {
    runCommand(`flyctl status --app ${appName} --json`, true);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDevWorkerDeployed(suffix?: string, organisation?: string): Promise<string> {
  const appName = devWorkerAppName(suffix);
  const dbConfig = await configuredEnvironments();
  applyFlyOrganisationToken(dbConfig);

  if (!appExists(appName)) {
    const org = organisation || dbConfig?.environments?.find(env => env.flyio?.organisation)?.flyio?.organisation || FLYIO_DEFAULTS.ORGANISATION;
    runCommand(`flyctl apps create ${appName} --org ${org}`);
  }

  if (dbConfig?.uploadWorker) {
    importWorkerSecrets(appName, dbConfig.secrets, dbConfig.uploadWorker.sharedSecret, dbConfig.uploadWorker.encryptionKey);
  }

  runCommand(`flyctl deploy --app ${appName} --config fly.integration-worker.toml --remote-only`);
  writeActiveDevWorkerApp(appName);
  return appName;
}

export async function destroyDevWorker(appName: string): Promise<void> {
  applyFlyOrganisationToken(await configuredEnvironments());
  runCommand(`flyctl apps destroy ${appName} --yes`);
  clearActiveDevWorkerApp();
}
