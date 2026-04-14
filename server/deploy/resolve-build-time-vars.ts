import debug from "debug";
import fs from "fs";
import { keys, toPairs } from "es-toolkit/compat";
import { envConfig } from "../lib/env-config/env-config";
import { configuredEnvironments } from "../lib/environments/environments-config";

const debugLog = debug(envConfig.logNamespace("resolve-build-time-vars"));
debugLog.enabled = true;

void resolveBuildTimeVars().then(() => process.exit(0)).catch(error => {
  debugLog("Failed to resolve build-time variables:", error);
  process.exit(1);
});

async function resolveBuildTimeVars(): Promise<void> {
  if (process.env.ADMIN_MONGODB_URI) {
    process.env.MONGODB_URI = process.env.ADMIN_MONGODB_URI;
  }

  const dbConfig = await configuredEnvironments();
  const chromeVersion = dbConfig?.secrets?.CHROME_VERSION;
  const autoDeployTarget = dbConfig?.autoDeployTarget;

  if (!chromeVersion) {
    throw new Error("CHROME_VERSION is not set in the global secrets of the environments config document");
  }

  if (!autoDeployTarget) {
    throw new Error("autoDeployTarget is not set in the environments config document (the environment name to deploy on push to main/pre-main)");
  }

  const autoDeployEnv = (dbConfig?.environments || []).find(env => env.environment === autoDeployTarget);
  if (!autoDeployEnv) {
    throw new Error(`autoDeployTarget '${autoDeployTarget}' does not match any environment in the environments config document`);
  }
  const autoDeployAppName = autoDeployEnv.flyio?.appName;
  if (!autoDeployAppName) {
    throw new Error(`Environment '${autoDeployTarget}' has no flyio.appName configured`);
  }

  const outputs: Record<string, string> = {
    chrome_version: chromeVersion,
    auto_deploy_target: autoDeployTarget,
    auto_deploy_app_name: autoDeployAppName
  };

  debugLog(`Resolved build-time variables: ${keys(outputs).join(", ")}`);

  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    const payload = toPairs(outputs).map(([key, value]) => `${key}=${value}`).join("\n");
    fs.appendFileSync(githubOutput, `${payload}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(outputs)}\n`);
  }
}
