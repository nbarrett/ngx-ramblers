import { Command } from "commander";
import debug from "debug";
import { spawn, ChildProcess } from "child_process";
import net from "net";
import path from "path";
import { findEnvironment, listEnvironmentSummaries } from "../../shared/configs-json";
import { loadSecretsForEnvironment, secretsExist } from "../../shared/secrets";
import { log } from "../cli-logger";
import { select, isBack, isQuit, handleQuit, clearScreen } from "../cli-prompt";

const debugLog = debug("ngx-ramblers:cli:local");

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

interface LocalRunConfig {
  environmentName: string;
  mode: "dev" | "prod";
  port: number;
}

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");

async function selectEnvironment(): Promise<string | null> {
  const environments = listEnvironmentSummaries();

  if (environments.length === 0) {
    throw new Error("No environments configured in configs.json");
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

function buildEnvironmentVariables(
  secrets: Record<string, string>,
  mode: "dev" | "prod",
  port: number
): NodeJS.ProcessEnv {
  const chromeVersion = secrets.CHROME_VERSION || "131";
  const chromedriverPath = path.join(
    PROJECT_ROOT,
    `server/chromedriver/mac_arm-${chromeVersion}/chromedriver-mac-arm64/chromedriver`
  );
  const chromeBinPath = path.join(
    PROJECT_ROOT,
    `server/chrome/mac_arm-${chromeVersion}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
  );

  return {
    ...process.env,
    ...secrets,
    NODE_ENV: mode === "dev" ? "development" : "production",
    PORT: String(port),
    DEBUG: secrets.DEBUG || "ngx-ramblers:*",
    DEBUG_COLORS: "true",
    NODE_OPTIONS: "--max_old_space_size=2560",
    CHROME_VERSION: chromeVersion,
    CHROMEDRIVER_PATH: chromedriverPath,
    CHROME_BIN: chromeBinPath
  };
}

interface RunningProcess {
  child: ChildProcess;
  label: string;
}

interface ProcessState {
  hasError: boolean;
  isShuttingDown: boolean;
  stderrBuffer: string;
}

function createProcessState(): ProcessState {
  return { hasError: false, isShuttingDown: false, stderrBuffer: "" };
}

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
  label: string,
  state: ProcessState,
  onError: (label: string, message: string) => void
): ChildProcess {
  log(`Starting ${label}...`);
  debugLog(`Running: ${command} ${args.join(" ")}`);

  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["inherit", "inherit", "pipe"],
    shell: true
  });

  child.stderr?.on("data", (data: Buffer) => {
    const text = data.toString();
    state.stderrBuffer += text;
    process.stderr.write(text);

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
  });

  return child;
}

async function runDev(config: LocalRunConfig): Promise<void> {
  const envConfig = findEnvironment(config.environmentName);
  if (!envConfig) {
    throw new Error(`Environment ${config.environmentName} not found in configs.json`);
  }

  if (!secretsExist(envConfig.appName)) {
    throw new Error(`No secrets file found for ${envConfig.appName}. Expected at non-vcs/secrets/secrets.${envConfig.appName}.env`);
  }

  const backendPortAvailable = await checkPortAvailable(config.port);
  if (!backendPortAvailable) {
    throw new Error(`Backend port ${config.port} is already in use`);
  }

  const frontendPortAvailable = await checkPortAvailable(4200);
  if (!frontendPortAvailable) {
    throw new Error(`Frontend port 4200 is already in use`);
  }

  const secretsFile = loadSecretsForEnvironment(envConfig.appName);
  const env = buildEnvironmentVariables(secretsFile.secrets, "dev", config.port);

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

  const cleanup = (reason?: string) => {
    state.isShuttingDown = true;
    if (reason) {
      log("\nError: %s", reason);
    }
    log("Shutting down...");
    processes.forEach(p => {
      if (!p.child.killed) {
        p.child.kill("SIGTERM");
      }
    });
    if (reason) {
      process.exit(1);
    }
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
    onError
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
    onError
  );
  processes.push({ child: frontendProcess, label: "Frontend" });

  process.on("SIGINT", () => cleanup());
  process.on("SIGTERM", () => cleanup());

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
  const envConfig = findEnvironment(config.environmentName);
  if (!envConfig) {
    throw new Error(`Environment ${config.environmentName} not found in configs.json`);
  }

  if (!secretsExist(envConfig.appName)) {
    throw new Error(`No secrets file found for ${envConfig.appName}. Expected at non-vcs/secrets/secrets.${envConfig.appName}.env`);
  }

  const portAvailable = await checkPortAvailable(config.port);
  if (!portAvailable) {
    throw new Error(`Port ${config.port} is already in use`);
  }

  const secretsFile = loadSecretsForEnvironment(envConfig.appName);
  const env = buildEnvironmentVariables(secretsFile.secrets, "prod", config.port);

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
    stdio: "inherit",
    shell: true
  });

  const buildExitCode = await new Promise<number | null>(resolve => {
    buildProcess.on("exit", resolve);
  });

  if (buildExitCode !== 0) {
    throw new Error(`Frontend build failed with exit code ${buildExitCode}`);
  }

  log("\nBuild complete. Starting server...\n");

  const state = createProcessState();

  const cleanup = (reason?: string) => {
    state.isShuttingDown = true;
    if (reason) {
      log("\nError: %s", reason);
    }
    log("Shutting down...");
    if (!serverProcess.killed) {
      serverProcess.kill("SIGTERM");
    }
    if (reason) {
      process.exit(1);
    }
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
    onError
  );

  process.on("SIGINT", () => cleanup());
  process.on("SIGTERM", () => cleanup());

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

        await runDev({
          environmentName,
          mode: "dev",
          port
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

        await runProd({
          environmentName,
          mode: "prod",
          port
        });
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  local
    .command("list")
    .description("List available environments")
    .action(() => {
      try {
        const environments = listEnvironmentSummaries();

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

  return local;
}
