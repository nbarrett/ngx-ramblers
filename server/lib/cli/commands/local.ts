import { Command } from "commander";
import debug from "debug";
import { ChildProcess, spawn, spawnSync } from "child_process";
import http from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { configuredEnvironments, findEnvironmentFromDatabase, listEnvironmentSummariesFromDatabase } from "../../environments/environments-config";
import { Environment } from "../../env-config/environment-model";
import { ensureRequiredSecrets, loadSecretsWithFallback, REQUIRED_SECRETS, secretsExist } from "../../shared/secrets";
import { keys } from "es-toolkit/compat";
import { log } from "../cli-logger";
import { select, isBack, isQuit, handleQuit, clearScreen } from "../cli-prompt";
import { dateTimeNow } from "../../shared/dates";
import { envConfig } from "../../env-config/env-config";
import { ChromeValidationResult, LocalRunConfig, ProcessState, RunningProcess } from "../cli.model";
import { openLogViewer } from "../log-viewer";

const debugLog = debug(envConfig.logNamespace("cli:local"));

function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function pidsListeningOnPort(port: number): number[] {
  const result = spawnSync("lsof", ["-ti", `tcp:${port}`], {
    stdio: ["ignore", "pipe", "ignore"]
  });

  if (result.status !== 0) {
    return [];
  }

  return result.stdout.toString()
    .split(/\r?\n/)
    .map(value => value.trim())
    .filter(value => value.length > 0)
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isInteger(value));
}

async function waitForProcessesToExit(pids: number[], timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const alive = pids.filter(pid => processExists(pid));
    if (alive.length === 0) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return pids.every(pid => !processExists(pid));
}

async function killProcessesListeningOnPort(port: number, label: string): Promise<void> {
  const pids = pidsListeningOnPort(port);
  if (pids.length === 0) {
    return;
  }

  log("%s port %d already in use by pid%s %s - terminating...", label, port, pids.length === 1 ? "" : "s", pids.join(", "));
  pids.forEach(pid => {
    try {
      process.kill(pid, "SIGTERM");
    } catch {}
  });

  const terminatedAfterSigTerm = await waitForProcessesToExit(pids, 4000);
  if (terminatedAfterSigTerm) {
    return;
  }

  log("%s port %d still busy after SIGTERM - force killing pid%s %s", label, port, pids.length === 1 ? "" : "s", pids.join(", "));
  pids.forEach(pid => {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  });

  await waitForProcessesToExit(pids, 2000);
}

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
const DEFAULT_LOG_DIR = "cli-output/logs";

function readServerEnvValue(key: string): string | null {
  const serverEnvPath = path.join(PROJECT_ROOT, "server", ".env");
  if (!fs.existsSync(serverEnvPath)) {
    return null;
  }
  const contents = fs.readFileSync(serverEnvPath, "utf-8");
  const pattern = new RegExp(`^\\s*${key}\\s*=`);
  const match = contents.split(/\r?\n/).find(line => pattern.test(line) && !line.trim().startsWith("#"));
  if (!match) {
    return null;
  }
  const value = match.split("=").slice(1).join("=").trim();
  return value.replace(/^["']|["']$/g, "");
}

function readWorkerUrlFromServerEnv(): string | null {
  return readServerEnvValue(Environment.RAMBLERS_UPLOAD_WORKER_URL);
}

const SERVER_ENV_OVERRIDE_KEYS: Environment[] = [
  Environment.RAMBLERS_UPLOAD_WORKER_URL,
  Environment.RAMBLERS_UPLOAD_WORKER_CALLBACK_BASE_URL,
  Environment.RAMBLERS_UPLOAD_WORKER_SHARED_SECRET,
  Environment.RAMBLERS_UPLOAD_WORKER_ENCRYPTION_KEY
];

function isSecretKey(key: Environment): boolean {
  return key === Environment.RAMBLERS_UPLOAD_WORKER_SHARED_SECRET
    || key === Environment.RAMBLERS_UPLOAD_WORKER_ENCRYPTION_KEY;
}

function displayOverrideValue(value: string): string {
  if (value.length <= 80) {
    return value;
  }
  return `${value.slice(0, 77)}...`;
}

function applyServerEnvOverrides(env: NodeJS.ProcessEnv): void {
  for (const key of SERVER_ENV_OVERRIDE_KEYS) {
    const override = readServerEnvValue(key);
    if (override && override !== env[key]) {
      const secret = isSecretKey(key);
      const masked = secret ? "***" : displayOverrideValue(override);
      const previous = secret
        ? (env[key] ? "***" : "(unset)")
        : displayOverrideValue(env[key] || "(unset)");
      log("%s override from server/.env: %s → %s", key, previous, masked);
      env[key] = override;
    }
  }
}

function detectInstalledChromeVersion(): string | null {
  const chromedriverDir = path.join(PROJECT_ROOT, "server/chromedriver");
  if (!fs.existsSync(chromedriverDir)) {
    return null;
  }
  const platformPrefixes = ["mac_arm-", "mac-", "linux-", "win32-", "win64-"];
  const dirs = fs.readdirSync(chromedriverDir).filter(d => platformPrefixes.some(prefix => d.startsWith(prefix)));
  if (dirs.length === 0) {
    return null;
  }
  const latest = dirs.sort().reverse()[0];
  const match = latest.match(/^[a-z0-9_]+-(.+)$/);
  return match ? match[1] : null;
}

function validateChromeBinary(chromeBinPath: string): boolean {
  if (!fs.existsSync(chromeBinPath)) {
    return false;
  }

  const result = spawnSync(chromeBinPath, ["--version", "--no-sandbox"], {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5000
  });

  return result.status === 0;
}

function findBinaryInVersionDir(baseDir: string, version: string): string | null {
  const versionDir = fs.readdirSync(baseDir).find(d => d.endsWith(`-${version}`));
  if (!versionDir) {
    return null;
  }
  const fullPath = path.join(baseDir, versionDir);
  const subDirs = fs.readdirSync(fullPath);
  const chromedriverBin = subDirs.find(d => d.startsWith("chromedriver-"));
  if (chromedriverBin) {
    return path.join(fullPath, chromedriverBin, "chromedriver");
  }
  const chromeBinDir = subDirs.find(d => d.startsWith("chrome-"));
  if (chromeBinDir) {
    const chromeContents = path.join(fullPath, chromeBinDir);
    const appBundle = fs.readdirSync(chromeContents).find(f => f.endsWith(".app"));
    if (appBundle) {
      return path.join(chromeContents, appBundle, "Contents/MacOS/Google Chrome for Testing");
    }
    const chromeBin = fs.readdirSync(chromeContents).find(f => f === "chrome");
    if (chromeBin) {
      return path.join(chromeContents, chromeBin);
    }
  }
  return null;
}

function validateChromeSetup(chromeVersionOverride?: string): ChromeValidationResult {
  const chromeVersion = detectInstalledChromeVersion() || chromeVersionOverride;

  if (!chromeVersion) {
    return {
      valid: false,
      error: "No Chrome version detected in server/chromedriver/",
      chromeBinPath: null,
      chromedriverPath: null,
      chromeVersion: null
    };
  }

  const chromedriverDir = path.join(PROJECT_ROOT, "server/chromedriver");
  const chromeDir = path.join(PROJECT_ROOT, "server/chrome");
  const chromedriverPath = findBinaryInVersionDir(chromedriverDir, chromeVersion);
  const chromeBinPath = fs.existsSync(chromeDir) ? findBinaryInVersionDir(chromeDir, chromeVersion) : null;

  if (!chromedriverPath || !fs.existsSync(chromedriverPath)) {
    return {
      valid: false,
      chromeVersion,
      error: `Chromedriver not found for version ${chromeVersion}`,
      chromeBinPath: null,
      chromedriverPath: null
    };
  }

  if (!chromeBinPath || !validateChromeBinary(chromeBinPath)) {
    return {
      valid: false,
      chromeVersion,
      chromedriverPath,
      error: `Chrome binary not found or not executable for version ${chromeVersion}`,
      chromeBinPath: null
    };
  }

  return {
    valid: true,
    chromeVersion,
    chromedriverPath,
    chromeBinPath,
    error: null
  };
}

async function selectEnvironment(): Promise<string | null> {
  const environments = await listEnvironmentSummariesFromDatabase();

  if (environments.length === 0) {
    throw new Error("No environments configured");
  }

  const result = await select({
    message: "Select an environment:",
    choices: environments.map(env => ({
      name: `${env.name} (${env.appName})`,
      value: env.name
    })),
    allowBack: false
  });

  if (isQuit(result)) {
    handleQuit();
  }

  if (isBack(result)) {
    return null;
  }

  return result;
}

async function selectS3BucketOverride(currentEnvironmentName: string, currentBucket: string): Promise<string | null> {
  const environmentsConfig = await configuredEnvironments();
  const environments = environmentsConfig.environments || [];

  const bucketChoices: { name: string; value: string | null }[] = [
    {name: `No override (${currentBucket})`, value: null}
  ];

  environments
    .filter(env => env.environment !== currentEnvironmentName && env.aws?.bucket)
    .forEach(env => {
      bucketChoices.push({
        name: `${env.environment} (${env.aws.bucket})`,
        value: env.aws.bucket
      });
    });

  if (bucketChoices.length === 1) {
    return null;
  }

  const result = await select({
    message: "Override S3 bucket?",
    choices: bucketChoices,
    allowBack: false
  });

  if (isQuit(result)) {
    handleQuit();
  }

  if (isBack(result)) {
    return null;
  }

  return result;
}

function buildCleanEnvironment(): NodeJS.ProcessEnv {
  const essentialVars = ["PATH", "HOME", "USER", "SHELL", "TERM", "LANG", "LC_ALL", "TMPDIR"];
  const cleanEnv: NodeJS.ProcessEnv = {};

  essentialVars.forEach(key => {
    if (process.env[key]) {
      cleanEnv[key] = process.env[key];
    }
  });

  return cleanEnv;
}

async function loadAndEnsureSecrets(environmentName: string, appName: string, flyApiToken: string): Promise<Record<string, string>> {
  const secretsFile = await loadSecretsWithFallback(environmentName, appName);
  log("Loaded %d secrets from %s: %s", keys(secretsFile.secrets).length, secretsFile.path, keys(secretsFile.secrets).join(", "));
  const missingBefore = REQUIRED_SECRETS.filter(key => !secretsFile.secrets[key]);
  if (missingBefore.length > 0) {
    log("Missing required secrets: %s — attempting fallbacks...", missingBefore.join(", "));
  }
  const completeSecrets = ensureRequiredSecrets(appName, secretsFile.secrets, flyApiToken);
  const missingAfter = REQUIRED_SECRETS.filter(key => !completeSecrets[key]);
  if (missingAfter.length > 0) {
    log("Warning: still missing after fallbacks: %s", missingAfter.join(", "));
    log("Tip: ensure flyctl is installed and authenticated, or add missing secrets to local file");
  } else {
    log("Secrets ready: %d keys", keys(completeSecrets).length);
  }
  return completeSecrets;
}

function buildEnvironmentVariables(
  secrets: Record<string, string>,
  mode: "dev" | "prod",
  port: number,
  s3BucketOverride?: string
): NodeJS.ProcessEnv {
  const chromeValidation = validateChromeSetup(secrets.CHROME_VERSION);

  if (!chromeValidation.valid) {
    log("Warning: Chrome not available - %s", chromeValidation.error);
    log("         Scraping features will be disabled");
  }

  const cleanEnv = buildCleanEnvironment();

  const env: NodeJS.ProcessEnv = {
    ...cleanEnv,
    ...secrets,
    NODE_ENV: mode === "dev" ? "development" : "production",
    PORT: String(port),
    DEBUG: secrets.DEBUG || "ngx-ramblers:*",
    DEBUG_COLORS: "true",
    NODE_OPTIONS: "--max_old_space_size=2560",
    PLATFORM_ADMIN_ENABLED: "true"
  };

  if (chromeValidation.valid) {
    env.CHROME_VERSION = chromeValidation.chromeVersion || "";
    env.CHROMEDRIVER_PATH = chromeValidation.chromedriverPath || "";
    env.CHROME_BIN = chromeValidation.chromeBinPath || "";
  }

  if (s3BucketOverride) {
    log("S3 bucket override: %s → %s", env.AWS_BUCKET, s3BucketOverride);
    env.AWS_BUCKET = s3BucketOverride;
  }

  applyServerEnvOverrides(env);

  return env;
}

function createProcessState(): ProcessState {
  return { hasError: false, isShuttingDown: false, stderrBuffer: "" };
}

function resolveLogDir(logDir: string | null): string | null {
  if (!logDir) {
    return null;
  }
  const resolved = path.resolve(PROJECT_ROOT, logDir);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function buildLogFilePath(logDir: string | null, filename: string): string | null {
  if (!logDir) {
    return null;
  }
  return path.join(logDir, filename);
}

function buildLogTimestamp(logTimestamp: boolean): string | null {
  if (!logTimestamp) {
    return null;
  }
  return dateTimeNow().toFormat("yyyyLLdd-HHmmss");
}

function applyLogTimestamp(filename: string, timestamp: string | null): string {
  if (!timestamp) {
    return filename;
  } else {
    const extension = path.extname(filename);
    const baseName = path.basename(filename, extension);
    return `${baseName}-${timestamp}${extension || ""}`;
  }
}

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
  label: string,
  state: ProcessState,
  onError: (label: string, message: string) => void,
  logFilePath: string | null,
  showOutput: boolean
): ChildProcess {
  log(`Starting ${label}...`);
  debugLog(`Running: ${command} ${args.join(" ")}`);

  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["inherit", "pipe", "pipe"]
  });

  const logStream = logFilePath ? fs.createWriteStream(logFilePath, { flags: "a" }) : undefined;

  const ESC = String.fromCharCode(27);
  const stripAnsi = (text: string) => text.replace(new RegExp(ESC + "\\[[0-9;]*m", "g"), "");

  child.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    if (showOutput) {
      process.stdout.write(text);
    }
    if (logStream) {
      logStream.write(stripAnsi(text));
    }
  });

  child.stderr?.on("data", (data: Buffer) => {
    const text = data.toString();
    state.stderrBuffer += text;
    if (showOutput) {
      process.stderr.write(text);
    }
    if (logStream) {
      logStream.write(stripAnsi(text));
    }

    if (text.includes("EADDRINUSE") || text.includes("address already in use")) {
      onError(label, "Port already in use");
    }
  });

  child.on("error", error => {
    if (!state.isShuttingDown) {
      onError(label, error.message);
    }
  });

  child.on("exit", code => {
    if (code !== 0 && code !== null && !state.isShuttingDown) {
      const errorMatch = state.stderrBuffer.match(/Error:?\s*(.+)/i);
      const errorMessage = errorMatch ? errorMatch[1].trim() : `exited with code ${code}`;
      onError(label, errorMessage);
    }
    if (logStream) {
      logStream.end();
    }
  });

  return child;
}

function ensureLogDir(config: LocalRunConfig, allowDefault: boolean): LocalRunConfig {
  if (config.logDir || !allowDefault) {
    return config;
  }
  return {
    ...config,
    logDir: DEFAULT_LOG_DIR
  };
}

function resolveLatestLogPath(logDir: string, prefix: string): string | null {
  if (!fs.existsSync(logDir)) {
    return null;
  }
  const entries = fs.readdirSync(logDir);
  const matches = entries
    .filter(name => name.startsWith(prefix) && name.endsWith(".log"))
    .map(name => ({
      name,
      stats: fs.statSync(path.join(logDir, name))
    }))
    .filter(entry => entry.stats.isFile());

  if (matches.length === 0) {
    return null;
  }

  const latest = matches.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs)[0];
  return path.join(logDir, latest.name);
}

const WORKER_IMAGE_TAG = "ngx-worker:local";
const WORKER_CONTAINER_NAME = "ngx-worker-local";
const WORKER_ENV_KEYS: string[] = [
  Environment.NODE_ENV,
  Environment.DEBUG,
  Environment.DEBUG_COLORS,
  Environment.MONGODB_URI,
  Environment.AUTH_SECRET,
  Environment.AWS_ACCESS_KEY_ID,
  Environment.AWS_SECRET_ACCESS_KEY,
  Environment.AWS_REGION,
  Environment.AWS_BUCKET,
  Environment.BASE_URL,
  Environment.CHROME_VERSION,
  Environment.RAMBLERS_USERNAME,
  Environment.RAMBLERS_PASSWORD,
  Environment.RAMBLERS_FEATURE,
  Environment.RAMBLERS_METADATA_FILE,
  Environment.RAMBLERS_UPLOAD_WORKER_SHARED_SECRET,
  Environment.RAMBLERS_UPLOAD_WORKER_ENCRYPTION_KEY,
  Environment.RAMBLERS_UPLOAD_WORKER_CALLBACK_BASE_URL,
  Environment.RAMBLERS_UPLOAD_WORKER_CALLBACK_SECRET,
  Environment.RAMBLERS_UPLOAD_WORKER_APP_NAME,
  Environment.CMS_URL,
  Environment.CMS_USERNAME,
  Environment.CMS_PASSWORD
];

function dockerAvailable(): boolean {
  const result = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { stdio: "ignore" });
  return result.status === 0;
}

interface ImageInfo {
  exists: boolean;
  createdAtMs: number;
}

function newestMtimeMs(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  const stats = fs.statSync(filePath);
  if (!stats.isDirectory()) {
    return stats.mtimeMs;
  }
  return fs.readdirSync(filePath).reduce((latest, entry) => {
    return Math.max(latest, newestMtimeMs(path.join(filePath, entry)));
  }, stats.mtimeMs);
}

function inspectWorkerImage(): ImageInfo {
  const result = spawnSync("docker", ["image", "inspect", WORKER_IMAGE_TAG, "--format", "{{.Created}}"], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    return { exists: false, createdAtMs: 0 };
  }
  const created = result.stdout.toString().trim();
  const parsed = Date.parse(created);
  return { exists: true, createdAtMs: isNaN(parsed) ? 0 : parsed };
}

function workerImageNeedsRebuild(image: ImageInfo): boolean {
  if (!image.exists) {
    return true;
  }
  const watchPaths = [
    path.join(PROJECT_ROOT, "Dockerfile"),
    path.join(PROJECT_ROOT, "package.json"),
    path.join(PROJECT_ROOT, "package-lock.json"),
    path.join(PROJECT_ROOT, "server/package.json"),
    path.join(PROJECT_ROOT, "server/package-lock.json"),
    path.join(PROJECT_ROOT, "server/playwright.config.ts"),
    path.join(PROJECT_ROOT, "server/lib/ramblers"),
    path.join(PROJECT_ROOT, "server/lib/serenity-js"),
    path.join(PROJECT_ROOT, "server/lib/env-config")
  ];
  return watchPaths.some(filePath => newestMtimeMs(filePath) > image.createdAtMs);
}

async function ensureLocalPlaywrightBrowser(logFilePath: string | null): Promise<void> {
  log("Ensuring local Playwright browser is installed...");
  const args = ["exec", "playwright", "install", "chromium"];
  const logStream = logFilePath ? fs.createWriteStream(logFilePath, { flags: "a" }) : undefined;
  if (logStream) {
    logStream.write(`\n[playwright install] ${new Date().toISOString()} npm ${args.join(" ")}\n`);
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", args, {
      cwd: path.join(PROJECT_ROOT, "server"),
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout?.on("data", (d: Buffer) => {
      const text = d.toString();
      process.stdout.write(text);
      logStream?.write(d);
    });
    child.stderr?.on("data", (d: Buffer) => {
      const text = d.toString();
      process.stderr.write(text);
      logStream?.write(d);
    });
    child.on("error", reject);
    child.on("exit", code => {
      logStream?.end();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Playwright browser install failed with code ${code}`));
      }
    });
  });
}

async function buildWorkerImage(chromeVersion: string, workerLogPath: string | null): Promise<void> {
  log("Building Docker image %s (target worker)...", WORKER_IMAGE_TAG);
  const args = [
    "build", ".",
    "--build-arg", `CHROME_VERSION=${chromeVersion}`,
    "--target", "worker",
    "-t", WORKER_IMAGE_TAG
  ];
  const logStream = workerLogPath ? fs.createWriteStream(workerLogPath, { flags: "a" }) : undefined;
  if (logStream) {
    logStream.write(`\n[docker build] ${new Date().toISOString()} docker ${args.join(" ")}\n`);
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn("docker", args, { cwd: PROJECT_ROOT, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout?.on("data", (d: Buffer) => {
      const text = d.toString();
      process.stdout.write(text);
      logStream?.write(d);
    });
    child.stderr?.on("data", (d: Buffer) => {
      const text = d.toString();
      process.stderr.write(text);
      logStream?.write(d);
    });
    child.on("error", err => reject(err));
    child.on("exit", code => {
      logStream?.end();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`docker build failed with code ${code} (see ${workerLogPath || "logs"})`));
      }
    });
  });
  log("Docker image %s built", WORKER_IMAGE_TAG);
}

function removeWorkerContainerSync(): void {
  spawnSync("docker", ["rm", "-f", WORKER_CONTAINER_NAME], { stdio: "ignore" });
}

async function clearPortForLocalRun(port: number, label: string): Promise<void> {
  await killProcessesListeningOnPort(port, label);
  const portAvailable = await checkPortAvailable(port);
  if (!portAvailable) {
    throw new Error(`${label} port ${port} is already in use`);
  }
}

function startWorkerContainer(
  workerEnv: NodeJS.ProcessEnv,
  workerPort: number,
  backendPort: number,
  logFilePath: string | null,
  showOutput: boolean,
  state: ProcessState,
  onError: (label: string, message: string) => void
): ChildProcess {
  removeWorkerContainerSync();
  const args: string[] = [
    "run", "--rm",
    "--name", WORKER_CONTAINER_NAME,
    "-p", `${workerPort}:5001`,
    "--add-host=host.docker.internal:host-gateway"
  ];
  const containerEnv: Record<string, string> = {
    NODE_ENV: workerEnv.NODE_ENV || "development",
    PORT: "5001",
    DEBUG: workerEnv.DEBUG || "ngx-ramblers:*",
    DEBUG_COLORS: "true",
    RAMBLERS_UPLOAD_WORKER_CALLBACK_BASE_URL: `http://host.docker.internal:${backendPort}`
  };
  for (const key of WORKER_ENV_KEYS) {
    const value = workerEnv[key];
    if (value !== undefined && value !== "" && containerEnv[key] === undefined) {
      containerEnv[key] = value;
    }
  }
  for (const [k, v] of Object.entries(containerEnv)) {
    args.push("-e", `${k}=${v}`);
  }
  args.push(WORKER_IMAGE_TAG);

  log("Starting worker container %s on port %d...", WORKER_CONTAINER_NAME, workerPort);
  debugLog("docker %s", args.join(" "));

  const child = spawn("docker", args, { stdio: ["ignore", "pipe", "pipe"] });
  const logStream = logFilePath ? fs.createWriteStream(logFilePath, { flags: "a" }) : undefined;
  const ESC = String.fromCharCode(27);
  const stripAnsi = (text: string) => text.replace(new RegExp(ESC + "\\[[0-9;]*m", "g"), "");

  child.stdout?.on("data", (d: Buffer) => {
    const text = d.toString();
    if (showOutput) {
      process.stdout.write(text);
    }
    logStream?.write(stripAnsi(text));
  });
  child.stderr?.on("data", (d: Buffer) => {
    const text = d.toString();
    state.stderrBuffer += text;
    if (showOutput) {
      process.stderr.write(text);
    }
    logStream?.write(stripAnsi(text));
  });
  child.on("error", err => {
    if (!state.isShuttingDown) {
      onError("Worker (docker)", err.message);
    }
  });
  child.on("exit", code => {
    if (code !== 0 && code !== null && !state.isShuttingDown) {
      onError("Worker (docker)", `exited with code ${code}`);
    }
    logStream?.end();
  });
  return child;
}

function pingWorkerHealth(workerPort: number): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get({ host: "localhost", port: workerPort, path: "/api/health", timeout: 2000 }, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForWorkerReady(workerPort: number, timeoutMs: number, state: ProcessState): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.isShuttingDown) {
      return false;
    }
    if (await pingWorkerHealth(workerPort)) {
      return true;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

async function runDev(config: LocalRunConfig): Promise<void> {
  const envConfig = await findEnvironmentFromDatabase(config.environmentName);
  if (!envConfig) {
    throw new Error(`Environment ${config.environmentName} not found`);
  }

  if (!secretsExist(envConfig.appName)) {
    log("Note: No local secrets file for %s - will load from database", envConfig.appName);
  }

  const workerPort = config.port + 1;
  removeWorkerContainerSync();
  await clearPortForLocalRun(config.port, "Backend");
  await clearPortForLocalRun(4200, "Frontend");

  const completeSecrets = await loadAndEnsureSecrets(config.environmentName, envConfig.appName, envConfig.apiKey);
  const s3BucketOverride = config.s3BucketOverride ?? await selectS3BucketOverride(config.environmentName, completeSecrets.AWS_BUCKET || "unknown");
  const env = buildEnvironmentVariables(completeSecrets, "dev", config.port, s3BucketOverride);

  const configuredWorkerUrl = (
    env.RAMBLERS_UPLOAD_WORKER_URL
    || readWorkerUrlFromServerEnv()
    || ""
  ).trim();
  const spawnLocalWorker = configuredWorkerUrl === ""
    || configuredWorkerUrl.includes("localhost")
    || configuredWorkerUrl.includes("127.0.0.1");

  const forceInProcessWorker = env.PLAYWRIGHT_HEADLESS === "false";

  if (spawnLocalWorker) {
    await clearPortForLocalRun(workerPort, "Worker");
  }

  const useDockerWorker = spawnLocalWorker && config.dockerWorker !== false && !forceInProcessWorker;
  if (useDockerWorker && !dockerAvailable()) {
    throw new Error("Docker is required for worker but is not available. Start Docker or re-run with --no-docker-worker.");
  }

  if (useDockerWorker) {
    env.RAMBLERS_UPLOAD_WORKER_CALLBACK_BASE_URL = `http://host.docker.internal:${config.port}`;
  }

  const workerEnv: NodeJS.ProcessEnv = { ...env, PORT: String(workerPort) };
  const logDir = resolveLogDir(config.logDir);
  const timestamp = buildLogTimestamp(config.logTimestamp);
  const frontendLogPath = buildLogFilePath(logDir, applyLogTimestamp("frontend.log", timestamp));
  const backendLogPath = buildLogFilePath(logDir, applyLogTimestamp("backend.log", timestamp));
  const workerLogPath = spawnLocalWorker ? buildLogFilePath(logDir, applyLogTimestamp("worker.log", timestamp)) : null;

  log("\n========================================");
  log("Starting in DEVELOPMENT mode");
  log("========================================");
  log("Environment: %s", config.environmentName);
  log("App Name: %s", envConfig.appName);
  log("Port: %d", config.port);
  if (config.s3BucketOverride) {
    log("S3 Bucket: %s (overridden)", config.s3BucketOverride);
  }
  log("Frontend: http://localhost:4200");
  log("Backend: http://localhost:%d", config.port);
  if (spawnLocalWorker) {
    const mode = useDockerWorker ? "docker" : "in-process";
    log("Worker:  http://localhost:%d (%s)", workerPort, mode);
  } else {
    log("Worker:  %s (remote - not spawning local worker)", configuredWorkerUrl);
  }
  log("========================================\n");

  const processes: RunningProcess[] = [];
  const state = createProcessState();
  const showOutput = !config.logViewer;

  let workerContainerStarted = false;
  const teardownWorkerContainer = () => {
    if (!workerContainerStarted) {
      return;
    }
    workerContainerStarted = false;
    try {
      removeWorkerContainerSync();
    } catch (e) {
      debugLog("docker rm failed: %s", (e as Error).message);
    }
  };

  const cleanup = (reason?: string) => {
    if (state.isShuttingDown) {
      process.exit(reason ? 1 : 0);
      return;
    }
    state.isShuttingDown = true;
    if (reason) {
      log("\nError: %s", reason);
    }
    log("Shutting down...");
    teardownWorkerContainer();
    processes.forEach(p => {
      if (!p.child.killed) {
        p.child.kill("SIGTERM");
        setTimeout(() => {
          if (!p.child.killed) {
            p.child.kill("SIGKILL");
          }
        }, 1000);
      }
    });
    setTimeout(() => process.exit(reason ? 1 : 0), 2000);
  };

  const onError = (label: string, message: string) => {
    if (!state.hasError && !state.isShuttingDown) {
      state.hasError = true;
      cleanup(`${label}: ${message}`);
    }
  };

  const backendState = createProcessState();
  const backendProcess = runCommand(
    "npm",
    ["run", "server-live", "--prefix", "server"],
    env,
    PROJECT_ROOT,
    "Backend (tsx watch)",
    backendState,
    onError,
    backendLogPath,
    showOutput
  );
  processes.push({ child: backendProcess, label: "Backend" });

  if (spawnLocalWorker) {
    const workerState = createProcessState();
    if (useDockerWorker) {
      const chromeVersion = env.CHROME_VERSION || completeSecrets.CHROME_VERSION || "";
      if (!chromeVersion) {
        throw new Error("CHROME_VERSION not resolved — cannot build worker image");
      }
      const imageInfo = inspectWorkerImage();
      if (workerImageNeedsRebuild(imageInfo)) {
        log(imageInfo.exists ? "Worker image out of date, rebuilding..." : "Worker image missing, building...");
        await buildWorkerImage(chromeVersion, workerLogPath);
      } else {
        log("Worker image %s up to date", WORKER_IMAGE_TAG);
      }
      const workerProcess = startWorkerContainer(
        workerEnv,
        workerPort,
        config.port,
        workerLogPath,
        showOutput,
        workerState,
        onError
      );
      workerContainerStarted = true;
      processes.push({ child: workerProcess, label: "Worker (docker)" });
      log("Waiting for worker container to become ready at http://localhost:%d/api/health...", workerPort);
      const ready = await waitForWorkerReady(workerPort, 120_000, state);
      if (!ready && !state.isShuttingDown) {
        onError("Worker (docker)", "health check timed out after 120s");
      } else if (ready) {
        log("Worker container ready");
      }
    } else {
      await ensureLocalPlaywrightBrowser(workerLogPath);
      const workerProcess = runCommand(
        "npm",
        ["run", "worker-server-live", "--prefix", "server"],
        workerEnv,
        PROJECT_ROOT,
        "Worker (tsx watch)",
        workerState,
        onError,
        workerLogPath,
        showOutput
      );
      processes.push({ child: workerProcess, label: "Worker" });
    }
  }

  const frontendState = createProcessState();
  const frontendProcess = runCommand(
    "npm",
    ["run", "serve"],
    env,
    PROJECT_ROOT,
    "Frontend (ng serve)",
    frontendState,
    onError,
    frontendLogPath,
    showOutput
  );
  processes.push({ child: frontendProcess, label: "Frontend" });

  process.on("SIGINT", () => cleanup());
  process.on("SIGTERM", () => cleanup());

  if (config.logViewer && frontendLogPath && backendLogPath) {
    await openLogViewer({
      frontendLogPath,
      backendLogPath,
      workerLogPath: workerLogPath || undefined,
      refreshIntervalMs: 500,
      maxLines: 2000
    });
    cleanup();
  }

  await Promise.all(
    processes.map(
      p =>
        new Promise<void>(resolve => {
          p.child.on("exit", () => resolve());
        })
    )
  );
}

async function runProd(config: LocalRunConfig): Promise<void> {
  const envConfig = await findEnvironmentFromDatabase(config.environmentName);
  if (!envConfig) {
    throw new Error(`Environment ${config.environmentName} not found`);
  }

  if (!secretsExist(envConfig.appName)) {
    log("Note: No local secrets file for %s - will load from database", envConfig.appName);
  }

  await clearPortForLocalRun(config.port, "Server");

  const completeSecrets = await loadAndEnsureSecrets(config.environmentName, envConfig.appName, envConfig.apiKey);
  const s3BucketOverride = config.s3BucketOverride ?? await selectS3BucketOverride(config.environmentName, completeSecrets.AWS_BUCKET || "unknown");
  const env = buildEnvironmentVariables(completeSecrets, "prod", config.port, s3BucketOverride);
  const logDir = resolveLogDir(config.logDir);
  const timestamp = buildLogTimestamp(config.logTimestamp);
  const frontendLogPath = buildLogFilePath(logDir, applyLogTimestamp("frontend.log", timestamp));
  const backendLogPath = buildLogFilePath(logDir, applyLogTimestamp("backend.log", timestamp));

  log("\n========================================");
  log("Starting in PRODUCTION mode");
  log("========================================");
  log("Environment: %s", config.environmentName);
  log("App Name: %s", envConfig.appName);
  log("Port: %d", config.port);
  log("URL: http://localhost:%d", config.port);
  log("========================================\n");

  log("Building frontend...");
  const buildProcess = spawn("npm", ["run", "build"], {
    cwd: PROJECT_ROOT,
    env,
    stdio: ["inherit", "pipe", "pipe"]
  });

  const buildLogStream = frontendLogPath ? fs.createWriteStream(frontendLogPath, { flags: "a" }) : undefined;
  const showOutput = !config.logViewer;

  buildProcess.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    if (showOutput) {
      process.stdout.write(text);
    }
    if (buildLogStream) {
      buildLogStream.write(text);
    }
  });

  buildProcess.stderr?.on("data", (data: Buffer) => {
    const text = data.toString();
    if (showOutput) {
      process.stderr.write(text);
    }
    if (buildLogStream) {
      buildLogStream.write(text);
    }
  });

  const buildExitCode = await new Promise<number | null>(resolve => {
    buildProcess.on("exit", resolve);
  });

  if (buildLogStream) {
    buildLogStream.end();
  }

  if (buildExitCode !== 0) {
    throw new Error(`Frontend build failed with exit code ${buildExitCode}`);
  }

  log("\nBuild complete. Starting server...\n");

  const state = createProcessState();

  const cleanup = (reason?: string) => {
    if (state.isShuttingDown) {
      process.exit(reason ? 1 : 0);
      return;
    }
    state.isShuttingDown = true;
    if (reason) {
      log("\nError: %s", reason);
    }
    log("Shutting down...");
    if (!serverProcess.killed) {
      serverProcess.kill("SIGTERM");
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill("SIGKILL");
        }
      }, 1000);
    }
    setTimeout(() => process.exit(reason ? 1 : 0), 2000);
  };

  const onError = (label: string, message: string) => {
    if (!state.hasError && !state.isShuttingDown) {
      state.hasError = true;
      cleanup(`${label}: ${message}`);
    }
  };

  const serverState = createProcessState();
  const serverProcess = runCommand(
    "npm",
    ["run", "server", "--prefix", "server"],
    env,
    PROJECT_ROOT,
    "Production server",
    serverState,
    onError,
    backendLogPath,
    !config.logViewer
  );

  process.on("SIGINT", () => cleanup());
  process.on("SIGTERM", () => cleanup());

  if (config.logViewer && frontendLogPath && backendLogPath) {
    await openLogViewer({
      frontendLogPath,
      backendLogPath,
      refreshIntervalMs: 500,
      maxLines: 2000
    });
    cleanup();
  }

  await new Promise<void>(resolve => {
    serverProcess.on("exit", () => resolve());
  });
}

export function createLocalCommand(): Command {
  const local = new Command("local")
    .alias("l")
    .description("Run the app locally in dev or production mode");

  local
    .command("dev [environment]")
    .description("Start in development mode with hot reload (ng serve + tsx watch)")
    .option("-p, --port <port>", "Backend port", "5001")
    .option("--s3-bucket <bucket>", "Override S3 bucket name (e.g. ngx-ramblers-north-west-kent)")
    .option("--log-dir <dir>", "Directory to write frontend.log and backend.log")
    .option("--log-timestamp", "Add timestamp to log filenames")
    .option("--no-log-viewer", "Disable built-in log viewer and stream to stdout")
    .option("--no-docker-worker", "Run the upload worker as a local Node process instead of a Docker container")
    .action(async (environment, options) => {
      try {
        const environmentName = environment || await (async () => {
          clearScreen();
          return selectEnvironment();
        })();
        if (!environmentName) {
          return;
        }
        const port = parseInt(options.port, 10);
        const logViewer = options.logViewer !== false;
        const dockerWorker = options.dockerWorker !== false;

        const config = ensureLogDir(
          {
            environmentName,
            mode: "dev",
            port,
            logDir: options.logDir || null,
            logTimestamp: options.logTimestamp || false,
            logViewer,
            s3BucketOverride: options.s3Bucket || null,
            dockerWorker
          },
          logViewer
        );

        await runDev({
          environmentName,
          mode: "dev",
          port,
          logDir: config.logDir,
          logTimestamp: config.logTimestamp,
          logViewer: config.logViewer,
          s3BucketOverride: config.s3BucketOverride,
          dockerWorker: config.dockerWorker
        });
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  local
    .command("prod [environment]")
    .description("Build and start in production mode")
    .option("-p, --port <port>", "Server port", "5001")
    .option("--s3-bucket <bucket>", "Override S3 bucket name (e.g. ngx-ramblers-north-west-kent)")
    .option("--log-dir <dir>", "Directory to write frontend.log and backend.log")
    .option("--log-timestamp", "Add timestamp to log filenames")
    .option("--no-log-viewer", "Disable built-in log viewer and stream to stdout")
    .action(async (environment, options) => {
      try {
        const environmentName = environment || await (async () => {
          clearScreen();
          return selectEnvironment();
        })();
        if (!environmentName) {
          return;
        }
        const port = parseInt(options.port, 10);
        const logViewer = options.logViewer !== false;

        const config = ensureLogDir(
          {
            environmentName,
            mode: "prod",
            port,
            logDir: options.logDir || null,
            logTimestamp: options.logTimestamp || false,
            logViewer,
            s3BucketOverride: options.s3Bucket || null
          },
          logViewer
        );

        await runProd({
          environmentName,
          mode: "prod",
          port,
          logDir: config.logDir,
          logTimestamp: config.logTimestamp,
          logViewer: config.logViewer,
          s3BucketOverride: config.s3BucketOverride
        });
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  local
    .command("list")
    .description("List available environments")
    .action(async () => {
      try {
        const environments = await listEnvironmentSummariesFromDatabase();

        if (environments.length === 0) {
          log("No environments configured");
          return;
        }

        log("\nAvailable environments:\n");
        environments.forEach(env => {
          const hasSecrets = secretsExist(env.appName);
          const status = hasSecrets ? "ready" : "missing secrets";
          log("  %s - %s (%s)", env.name, env.appName, status);
        });
        log("");
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  local
    .command("logs")
    .description("Open the built-in log viewer")
    .option("--log-dir <dir>", "Directory containing frontend/backend logs")
    .action(async options => {
      try {
        const logDir = resolveLogDir(options.logDir || DEFAULT_LOG_DIR);
        if (!logDir) {
          log("Error: Log directory not available.");
          process.exit(1);
        }

        const frontendLogPath = resolveLatestLogPath(logDir, "frontend");
        const backendLogPath = resolveLatestLogPath(logDir, "backend");

        if (!frontendLogPath || !backendLogPath) {
          log("Error: Unable to find frontend and backend logs in %s", logDir);
          process.exit(1);
        }

        await openLogViewer({
          frontendLogPath,
          backendLogPath,
          refreshIntervalMs: 500,
          maxLines: 2000
        });
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  return local;
}
