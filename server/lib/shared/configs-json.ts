import fs from "fs";
import path from "path";
import debug from "debug";
import { DeploymentConfig, EnvironmentConfig } from "../../deploy/types";
import { EnvironmentSummary } from "../environment-setup/types";
import { envConfig } from "../env-config/env-config";
import { resolveClientPath } from "./path-utils";

const debugLog = debug(envConfig.logNamespace("shared:configs-json"));

export function configsJsonPath(): string {
  return resolveClientPath("non-vcs/fly-io/configs.json");
}

export function configsJsonExists(): boolean {
  return fs.existsSync(configsJsonPath());
}

export function loadConfigsJson(): DeploymentConfig {
  const filePath = configsJsonPath();

  if (!fs.existsSync(filePath)) {
    debugLog("configs.json not found, returning empty config");
    return {
      environments: [],
      dockerImage: "nbarrett/ngx-ramblers:latest",
      region: "iad"
    };
  }

  try {
    const rawConfig = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(rawConfig) as DeploymentConfig;
  } catch (error) {
    debugLog("Error reading or parsing configs.json:", error);
    throw new Error(`Failed to read configs.json: ${error.message}`);
  }
}

export function saveConfigsJson(config: DeploymentConfig): void {
  const filePath = configsJsonPath();
  const directory = path.dirname(filePath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    debugLog("Created configs directory:", directory);
  }

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), { encoding: "utf-8" });
  debugLog("Saved configs.json");
}

export function findEnvironment(name: string): EnvironmentConfig | null {
  const config = loadConfigsJson();
  return config.environments.find(env => env.name === name) || null;
}

export function addOrUpdateEnvironment(newEnvConfig: EnvironmentConfig): void {
  const config = loadConfigsJson();

  const existingIndex = config.environments.findIndex(env => env.name === newEnvConfig.name);

  if (existingIndex >= 0) {
    const existing = config.environments[existingIndex];
    const hasChanges = existing.apiKey !== newEnvConfig.apiKey ||
      existing.appName !== newEnvConfig.appName ||
      existing.memory !== newEnvConfig.memory ||
      existing.scaleCount !== newEnvConfig.scaleCount ||
      existing.organisation !== newEnvConfig.organisation;

    if (hasChanges) {
      config.environments[existingIndex] = newEnvConfig;
      debugLog("Updated existing environment:", newEnvConfig.name);
    } else {
      debugLog("No changes detected for environment:", newEnvConfig.name);
      return;
    }
  } else {
    config.environments.push(newEnvConfig);
    debugLog("Added new environment:", newEnvConfig.name);
  }

  saveConfigsJson(config);
}

export function removeEnvironment(name: string): boolean {
  const config = loadConfigsJson();
  const initialLength = config.environments.length;

  config.environments = config.environments.filter(env => env.name !== name);

  if (config.environments.length < initialLength) {
    saveConfigsJson(config);
    debugLog("Removed environment:", name);
    return true;
  }

  debugLog("Environment not found:", name);
  return false;
}

export function listEnvironmentNames(): string[] {
  const config = loadConfigsJson();
  return config.environments.map(env => env.name);
}

export function listEnvironmentSummaries(): EnvironmentSummary[] {
  const config = loadConfigsJson();
  return config.environments.map(env => ({
    name: env.name,
    appName: env.appName,
    memory: env.memory,
    scaleCount: env.scaleCount,
    organisation: env.organisation,
    hasApiKey: Boolean(env.apiKey)
  }));
}
