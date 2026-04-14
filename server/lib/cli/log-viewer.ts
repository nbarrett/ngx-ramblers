import fs from "fs";
import { spawn, spawnSync } from "child_process";
import { LogViewerConfig } from "./cli.model";
import { log } from "./cli-logger";

async function waitForLogFiles(config: LogViewerConfig, timeoutMs: number = 30000): Promise<void> {
  const pollForLogFiles = async (elapsed: number): Promise<void> => {
    if (elapsed >= timeoutMs) return;
    if (fs.existsSync(config.frontendLogPath) || fs.existsSync(config.backendLogPath)) return;
    await new Promise(resolve => setTimeout(resolve, 500));
    return pollForLogFiles(elapsed + 500);
  };
  await pollForLogFiles(0);
}

function isTmuxAvailable(): boolean {
  const result = spawnSync("which", ["tmux"], { stdio: "ignore" });
  return result.status === 0;
}

function openWithTmux(config: LogViewerConfig): Promise<void> {
  spawnSync("tmux", ["split-window", "-h", "tail", "-f", config.backendLogPath]);

  if (config.workerLogPath) {
    spawnSync("tmux", ["split-window", "-v", "-t", ".", "tail", "-f", config.workerLogPath]);
  }

  const tail = spawn("tail", ["-f", config.frontendLogPath], {
    stdio: "inherit"
  });

  return new Promise<void>(resolve => {
    tail.on("exit", () => resolve());
  });
}

function openWithIterm(config: LogViewerConfig): Promise<void> {
  const workerSplit = config.workerLogPath
    ? `
        set workerSession to (split horizontally with default profile)
        tell workerSession
          write text "exec tail -f '${config.workerLogPath}'"
        end tell`
    : "";

  const script = `
    tell application "iTerm2"
      tell current session of current window
        set backendSession to (split vertically with default profile)
        tell backendSession
          write text "exec tail -f '${config.backendLogPath}'"${workerSplit}
        end tell
      end tell
    end tell
  `;
  spawnSync("osascript", ["-e", script]);

  const killSplitPane = () => {
    spawnSync("pkill", ["-f", `tail -f ${config.backendLogPath}`], { stdio: "ignore" });
    if (config.workerLogPath) {
      spawnSync("pkill", ["-f", `tail -f ${config.workerLogPath}`], { stdio: "ignore" });
    }
  };

  process.on("SIGINT", killSplitPane);
  process.on("SIGTERM", killSplitPane);
  process.on("exit", killSplitPane);

  const tail = spawn("tail", ["-f", config.frontendLogPath], {
    stdio: "inherit"
  });

  return new Promise<void>(resolve => {
    tail.on("exit", () => {
      killSplitPane();
      resolve();
    });
  });
}

function openWithTerminalApp(config: LogViewerConfig): Promise<void> {
  const backendScript = `
    tell application "Terminal"
      activate
      do script "tail -f '${config.backendLogPath}'"
    end tell
  `;
  spawnSync("osascript", ["-e", backendScript]);

  if (config.workerLogPath) {
    const workerScript = `
      tell application "Terminal"
        activate
        do script "tail -f '${config.workerLogPath}'"
      end tell
    `;
    spawnSync("osascript", ["-e", workerScript]);
  }

  const tail = spawn("tail", ["-f", config.frontendLogPath], {
    stdio: "inherit"
  });

  return new Promise<void>(resolve => {
    tail.on("exit", () => resolve());
  });
}

export async function openLogViewer(config: LogViewerConfig): Promise<void> {
  if (!fs.existsSync(config.frontendLogPath) && !fs.existsSync(config.backendLogPath)) {
    log("Waiting for log files...");
    await waitForLogFiles(config);
  }

  if (!fs.existsSync(config.frontendLogPath) && !fs.existsSync(config.backendLogPath)) {
    log("No log files found after waiting.");
    return;
  }

  if (isTmuxAvailable()) {
    return openWithTmux(config);
  }

  const termProgram = process.env.TERM_PROGRAM || "";
  if (termProgram.includes("iTerm")) {
    return openWithIterm(config);
  }

  return openWithTerminalApp(config);
}
