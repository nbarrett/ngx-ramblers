import { Command } from "commander";
import debug from "debug";
import { ChildProcess, spawn, spawnSync } from "child_process";
import net from "net";
import path from "path";
import fs from "fs";
import { findEnvironmentFromDatabase, listEnvironmentSummariesFromDatabase } from "../../environments/environments-config";
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

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
const DEFAULT_LOG_DIR = "cli-output/logs";

function detectInstalledChromeVersion(): string | null {
  const chromedriverDir = path.join(PROJECT_ROOT, "server/chromedriver");
  if (!fs.existsSync(chromedriverDir)) {
    return null;
  }
  const dirs = fs.readdirSync(chromedriverDir).filter(d => d.startsWith("mac_arm-"));
  if (dirs.length === 0) {
    return null;
  }
  const latest = dirs.sort().reverse()[0];
  const match = latest.match(/^mac_arm-(.+)$/);
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

function validateChromeSetup(chromeVersionOverride?: string): ChromeValidationResult {
  const chromeVersion = chromeVersionOverride || detectInstalledChromeVersion();

  if (!chromeVersion) {
    return {
      valid: false,
      error: "No Chrome version detected in server/chromedriver/",
      chromeBinPath: null,
      chromedriverPath: null,
      chromeVersion: null
    };
  }

  const chromedriverPath = path.join(
    PROJECT_ROOT,
    `server/chromedriver/mac_arm-${chromeVersion}/chromedriver-mac-arm64/chromedriver`
  );
  const chromeBinPath = path.join(
    PROJECT_ROOT,
    `server/chrome/mac_arm-${chromeVersion}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
  );

  if (!fs.existsSync(chromedriverPath)) {
    return {
      valid: false,
      chromeVersion,
      error: `Chromedriver not found at ${chromedriverPath}`,
      chromeBinPath: null,
      chromedriverPath: null
    };
  }

  if (!validateChromeBinary(chromeBinPath)) {
    return {
      valid: false,
      chromeVersion,
      chromedriverPath,
      error: `Chrome binary not found or not executable at ${chromeBinPath}`,
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
  port: number
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
    stdio: ["inherit", "pipe", "pipe"],
    shell: true
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

async function runDev(config: LocalRunConfig): Promise<void> {
  const envConfig = await findEnvironmentFromDatabase(config.environmentName);
  if (!envConfig) {
    throw new Error(`Environment ${config.environmentName} not found`);
  }

  if (!secretsExist(envConfig.appName)) {
    log("Note: No local secrets file for %s - will load from database", envConfig.appName);
  }

  const backendPortAvailable = await checkPortAvailable(config.port);
  if (!backendPortAvailable) {
    throw new Error(`Backend port ${config.port} is already in use`);
  }

  const frontendPortAvailable = await checkPortAvailable(4200);
  if (!frontendPortAvailable) {
    throw new Error(`Frontend port 4200 is already in use`);
  }

  const completeSecrets = await loadAndEnsureSecrets(config.environmentName, envConfig.appName, envConfig.apiKey);
  const env = buildEnvironmentVariables(completeSecrets, "dev", config.port);
  const logDir = resolveLogDir(config.logDir);
  const timestamp = buildLogTimestamp(config.logTimestamp);
  const frontendLogPath = buildLogFilePath(logDir, applyLogTimestamp("frontend.log", timestamp));
  const backendLogPath = buildLogFilePath(logDir, applyLogTimestamp("backend.log", timestamp));

  log("\n========================================");
  log("Starting in DEVELOPMENT mode");
  log("========================================");
  log("Environment: %s", config.environmentName);
  log("App Name: %s", envConfig.appName);
  log("Port: %d", config.port);
  log("Frontend: http://localhost:4200");
  log("Backend: http://localhost:%d", config.port);
  log("========================================\n");

  const processes: RunningProcess[] = [];
  const state = createProcessState();
  const showOutput = !config.logViewer;

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

  const portAvailable = await checkPortAvailable(config.port);
  if (!portAvailable) {
    throw new Error(`Port ${config.port} is already in use`);
  }

  const completeSecrets = await loadAndEnsureSecrets(config.environmentName, envConfig.appName, envConfig.apiKey);
  const env = buildEnvironmentVariables(completeSecrets, "prod", config.port);
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
    stdio: ["inherit", "pipe", "pipe"],
    shell: true
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
            mode: "dev",
            port,
            logDir: options.logDir || null,
            logTimestamp: options.logTimestamp || false,
            logViewer
          },
          logViewer
        );

        await runDev({
          environmentName,
          mode: "dev",
          port,
          logDir: config.logDir,
          logTimestamp: config.logTimestamp,
          logViewer: config.logViewer
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
            logViewer
          },
          logViewer
        );

        await runProd({
          environmentName,
          mode: "prod",
          port,
          logDir: config.logDir,
          logTimestamp: config.logTimestamp,
          logViewer: config.logViewer
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
