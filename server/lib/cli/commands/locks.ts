import { Command } from "commander";
import fs from "fs";
import path from "path";
import { error, log } from "../cli-logger";

const PROJECT_ROOT = path.resolve(__dirname, "../../../../");
const FRONTEND_LOCK_PATH = path.join(PROJECT_ROOT, "package-lock.json");
const BACKEND_LOCK_PATH = path.join(PROJECT_ROOT, "server/package-lock.json");

function resolveOutDir(outDir?: string): string {
  const defaultOutDir = path.join(PROJECT_ROOT, "cli-output", "locks");
  const resolved = outDir ? path.resolve(PROJECT_ROOT, outDir) : defaultOutDir;
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function writeLockFile(sourcePath: string, targetPath: string): void {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Lockfile not found at ${sourcePath}`);
  }
  const content = fs.readFileSync(sourcePath, "utf8");
  fs.writeFileSync(targetPath, content, "utf8");
}

export function createLocksCommand(): Command {
  const locks = new Command("locks")
    .description("Write front-end and back-end lockfiles to separate files")
    .option("-o, --out-dir <dir>", "Output directory for lockfiles");

  locks.action(options => {
    try {
      const outDir = resolveOutDir(options.outDir);
      const frontendOut = path.join(outDir, "frontend-package-lock.json");
      const backendOut = path.join(outDir, "backend-package-lock.json");

      writeLockFile(FRONTEND_LOCK_PATH, frontendOut);
      writeLockFile(BACKEND_LOCK_PATH, backendOut);

      log("Front-end lockfile written to %s", frontendOut);
      log("Back-end lockfile written to %s", backendOut);
    } catch (err) {
      error("Failed to write lockfiles: %s", err.message);
      process.exit(1);
    }
  });

  return locks;
}
