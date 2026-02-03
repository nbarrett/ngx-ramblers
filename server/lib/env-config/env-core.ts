import { Environment } from "./environment-model";

export function environmentVariable(variableName: string): string | undefined {
  return process.env[variableName];
}

export const env = environmentVariable(Environment.NODE_ENV) || "development";

export function isProduction(): boolean {
  return env === "production";
}

export function logNamespace(moduleName: string): string {
  return `ngx-ramblers:${env}:${moduleName || ""}`;
}
