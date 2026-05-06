import * as fs from "fs";
import * as path from "path";
import debug from "debug";
import { logNamespace } from "../env-config/env-core";

const debugLog = debug(logNamespace("path-utils"));
debugLog.enabled = false;

const PROJECT_ROOT_MARKER = "fly.toml";

function findProjectRootFrom(dir: string): string {
  if (fs.existsSync(path.join(dir, PROJECT_ROOT_MARKER))) {
    debugLog("Found project root at " + dir + " (via " + PROJECT_ROOT_MARKER + ")");
    return dir;
  }
  const parent = path.dirname(dir);
  if (parent !== dir) return findProjectRootFrom(parent);
  throw new Error("Could not locate project root from " + __dirname + " - no " + PROJECT_ROOT_MARKER + " found in any parent directory");
}

function findProjectRoot(): string {
  return findProjectRootFrom(__dirname);
}

const projectRoot = findProjectRoot();

export function resolveClientPath(...pathSegments: string[]): string {
  return path.resolve(projectRoot, ...pathSegments);
}

export function resolveServerPath(...pathSegments: string[]): string {
  return path.resolve(projectRoot, "server", ...pathSegments);
}
