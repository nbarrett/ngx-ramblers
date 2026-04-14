import debug from "debug";
import fs from "fs";
import os from "os";
import path from "path";
import { entries } from "../../projects/ngx-ramblers/src/app/functions/object-utils";
import { envConfig } from "../lib/env-config/env-config";
import { configuredEnvironments } from "../lib/environments/environments-config";
import { FLYIO_DEFAULTS } from "../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { runCommand } from "../lib/fly/fly-commands";

const debugLog = debug(envConfig.logNamespace("deploy-ramblers-upload-worker"));
debugLog.enabled = true;

void deployRamblersUploadWorker().then(() => process.exit(0)).catch(error => {
  debugLog("Ramblers upload worker deployment failed:", error);
  process.exit(1);
});

async function deployRamblersUploadWorker(): Promise<void> {
  if (process.env.ADMIN_MONGODB_URI) {
    process.env.MONGODB_URI = process.env.ADMIN_MONGODB_URI;
  }

  const dbConfig = await configuredEnvironments();
  if (!dbConfig?.uploadWorker) {
    throw new Error("No uploadWorker config found in database. Populate Global Settings → Upload Worker Configuration first.");
  }

  const workerConfig = dbConfig.uploadWorker;

  if (!workerConfig.appName) {
    throw new Error("uploadWorker.appName is not set in the database");
  }

  if (workerConfig.apiKey) {
    process.env.FLY_API_TOKEN = workerConfig.apiKey;
  }

  const imageRepository = process.env.RAMBLERS_UPLOAD_WORKER_IMAGE_REPOSITORY || "nbarrett36/ngx-ramblers";
  const scaleCount = workerConfig.scaleCount ?? FLYIO_DEFAULTS.SCALE_COUNT;
  const memory = workerConfig.memory || FLYIO_DEFAULTS.MEMORY;
  const imageTag = imageTagFromArg();
  const image = `${imageRepository}:${imageTag}`;
  const flyTomlPath = path.resolve(__dirname, "../../fly.worker.toml");

  if (!fs.existsSync(flyTomlPath)) {
    throw new Error(`Worker Fly config not found at ${flyTomlPath}`);
  }

  importWorkerSecrets(workerConfig.appName, dbConfig.secrets, workerConfig.sharedSecret, workerConfig.encryptionKey);
  runCommand(`flyctl config validate --config ${flyTomlPath} --app ${workerConfig.appName}`);
  runCommand(`flyctl deploy --app ${workerConfig.appName} --config ${flyTomlPath} --image ${image} --strategy rolling --wait-timeout 600`);
  runCommand(`flyctl scale count ${scaleCount} --app ${workerConfig.appName} --yes`);
  runCommand(`flyctl scale memory ${memory} --app ${workerConfig.appName}`);
  debugLog(`Deployed Ramblers upload worker ${workerConfig.appName} with image ${image}`);
}

function importWorkerSecrets(
  appName: string,
  globalSecrets: Record<string, string> | undefined,
  sharedSecret: string | undefined,
  encryptionKey: string | undefined
): void {
  const secrets: Record<string, string> = {};

  if (globalSecrets) {
    entries(globalSecrets).forEach(([key, value]) => {
      if (value) {
        secrets[key] = value;
      }
    });
  }

  if (sharedSecret) {
    secrets.RAMBLERS_UPLOAD_WORKER_SHARED_SECRET = sharedSecret;
  }

  if (encryptionKey) {
    secrets.RAMBLERS_UPLOAD_WORKER_ENCRYPTION_KEY = encryptionKey;
  }

  if (entries(secrets).length === 0) {
    debugLog("No global or worker secrets in database, skipping worker secrets import");
    return;
  }

  const tempFile = path.join(os.tmpdir(), `ramblers-upload-worker-secrets-${Date.now()}.env`);
  const lines = entries(secrets).map(([key, value]) => `${key}=${value}`);

  try {
    fs.writeFileSync(tempFile, lines.join("\n"), { encoding: "utf-8" });
    runCommand(`flyctl secrets import --app ${appName} < ${tempFile}`);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

function imageTagFromArg(): string {
  const tagArg = process.argv.find(arg => arg.startsWith("--image-tag="));

  if (tagArg) {
    return tagArg.split("=")[1];
  }

  const tagIndex = process.argv.indexOf("--image-tag");

  if (tagIndex !== -1 && process.argv.length > tagIndex + 1) {
    return process.argv[tagIndex + 1];
  }

  throw new Error("An image tag must be supplied via --image-tag");
}
