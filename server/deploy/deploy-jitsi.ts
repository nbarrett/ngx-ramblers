import debug from "debug";
import fs from "fs";
import path from "path";
import { envConfig } from "../lib/env-config/env-config";
import { Environment } from "../../projects/ngx-ramblers/src/app/models/environment.model";
import { runCommand } from "../lib/fly/fly-commands";

const debugLog = debug(envConfig.logNamespace("deploy-jitsi"));
debugLog.enabled = true;

void deployJitsi().then(() => process.exit(0)).catch(error => {
  debugLog("Jitsi deployment failed:", error);
  process.exit(1);
});

async function deployJitsi(): Promise<void> {
  const appName = process.env.JITSI_APP_NAME || "ngx-ramblers-jitsi";
  const apiToken = envConfig.value(Environment.FLY_API_TOKEN);
  if (apiToken) {
    process.env[Environment.FLY_API_TOKEN] = apiToken;
  }
  const flyTomlPath = path.resolve(__dirname, "../../fly.jitsi.toml");
  if (!fs.existsSync(flyTomlPath)) {
    throw new Error(`Jitsi Fly config not found at ${flyTomlPath}`);
  }
  debugLog("Deploying self-hosted Jitsi app", appName, "using", flyTomlPath);
  debugLog("NOTE: Jitsi is a multi-container stack; this deploys the scaffold in fly.jitsi.toml.");
  debugLog("See jitsi/README.md for the combined-image / process-group work still required before this is production-ready.");
  runCommand(`flyctl config validate --config ${flyTomlPath} --app ${appName}`);
  runCommand(`flyctl deploy --app ${appName} --config ${flyTomlPath} --strategy immediate --wait-timeout 600`);
}
