import debug from "debug";
import { envConfig } from "../lib/env-config/env-config";
import { configuredEnvironments } from "../lib/environments/environments-config";

const debugLog = debug(envConfig.logNamespace("list-environment-names"));
debugLog.enabled = true;

void listEnvironmentNames().then(() => process.exit(0)).catch(error => {
  debugLog("Failed to list environment names:", error);
  process.exit(1);
});

async function listEnvironmentNames(): Promise<void> {
  if (process.env.ADMIN_MONGODB_URI) {
    process.env.MONGODB_URI = process.env.ADMIN_MONGODB_URI;
  }

  const dbConfig = await configuredEnvironments();
  const names = (dbConfig?.environments || []).map(environment => environment.environment);

  debugLog(`Resolved ${names.length} environment names from database`);
  process.stdout.write(`${JSON.stringify(names)}\n`);
}
