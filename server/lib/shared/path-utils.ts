import * as path from "path";
import debug from "debug";
import { isProduction, logNamespace } from "../env-config/env-core";

const debugLog = debug(logNamespace("path-utils"));
debugLog.enabled = false;

export function navigateUpFromCurrentExecutionDirectory(): string {
  return isProduction() ? "../../" : "";
}

export function resolveClientPath(...pathSegments: string[]): string {
  const path1 = __dirname;
  const path2 = navigateUpFromCurrentExecutionDirectory();
  const path3 = "../../../";
  const resolvedPath = path.resolve(path1, path2, path3, ...pathSegments);
  debugLog(`Resolved path from root for pathSegments: ${pathSegments.join(", ")} path1: ${path1} path2: ${path2} path3: ${path3} resolvedPath: ${resolvedPath}`);
  return resolvedPath;
}

export function resolveServerPath(...pathSegments: string[]): string {
  const path1 = __dirname;
  const path2 = navigateUpFromCurrentExecutionDirectory();
  const path3 = "../../";
  const resolvedPath = path.resolve(path1, path2, path3, ...pathSegments);
  debugLog(`Resolved server path for pathSegments: ${pathSegments.join(", ")} path1: ${path1} path2: ${path2} path3: ${path3} resolvedPath: ${resolvedPath}`);
  return resolvedPath;
}
