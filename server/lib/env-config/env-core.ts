import { Environment } from "./environment-model";

export function environmentVariable(environmentVariable: Environment): string | undefined {
  return process.env[environmentVariable];
}

export const env = environmentVariable(Environment.NODE_ENV) || "development";

export function isProduction(): boolean {
  return env === "production";
}

export function logNamespace(moduleName: string): string {
  return `ngx-ramblers:${env}:${moduleName || ""}`;
}
