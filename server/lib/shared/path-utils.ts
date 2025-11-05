import * as path from "path";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("path-utils"));
debugLog.enabled = false;

export function navigateUpFromCurrentExecutionDirectory(): string {
  return envConfig.isProduction() ? "../../" : "";
}

export function resolveClientPath(...pathSegments: string[]): string {
  const path1 = __dirname;
  const path2 = navigateUpFromCurrentExecutionDirectory();
  const path3 = "../../../";
  const resolvedPath = path.resolve(path1, path2, path3, ...pathSegments);
  debugLog(`Resolved path from root for pathSegments: ${pathSegments.join(", ")} path1: ${path1} path2: ${path2} path3: ${path3} resolvedPath: ${resolvedPath}`);
  return resolvedPath;
}
