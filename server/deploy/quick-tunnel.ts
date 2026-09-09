import { spawn, ChildProcess } from "child_process";

const TUNNEL_URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
const TUNNEL_READY_TIMEOUT_MS = 20000;

export interface QuickTunnel {
  url: string;
  process: ChildProcess;
}

export function startQuickTunnel(port: number): Promise<QuickTunnel> {
  return new Promise((resolve, reject) => {
    const child = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`, "--no-autoupdate"], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Timed out waiting for cloudflared to report a tunnel URL"));
    }, TUNNEL_READY_TIMEOUT_MS);

    let resolved = false;
    const onOutput = (chunk: Buffer) => {
      const match = chunk.toString().match(TUNNEL_URL_PATTERN);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({url: match[0], process: child});
      }
    };

    child.stdout?.on("data", onOutput);
    child.stderr?.on("data", onOutput);
    child.on("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", code => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(new Error(`cloudflared exited with code ${code} before reporting a tunnel URL`));
      }
    });
  });
}
