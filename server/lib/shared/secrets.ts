import fs from "fs";
import path from "path";
import debug from "debug";
import { keys } from "es-toolkit/compat";
import { SecretsFile } from "../environment-setup/types";
import { envConfig } from "../env-config/env-config";
import { resolveClientPath } from "./path-utils";
import { EnvironmentConfig, EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { entries } from "../../../projects/ngx-ramblers/src/app/functions/object-utils";

const debugLog = debug(envConfig.logNamespace("shared:secrets"));

export function secretsDirectory(): string {
  return resolveClientPath("non-vcs/secrets");
}

export function secretsPath(appName: string): string {
  return path.join(secretsDirectory(), `secrets.${appName}.env`);
}

export function parseSecretsFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    debugLog("Secrets file not found:", filePath);
    return {};
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return parseSecretsContent(content);
}

export function parseSecretsContent(content: string): Record<string, string> {
  const secrets: Record<string, string> = {};

  content.split("\n").forEach((line: string) => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      return;
    }

    const equalsIndex = trimmedLine.indexOf("=");
    if (equalsIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, equalsIndex).trim();
    const value = trimmedLine.slice(equalsIndex + 1).trim().replace(/^"|"$/g, "");

    if (key) {
      secrets[key] = value;
    }
  });

  return secrets;
}

export function buildSecretsContent(secrets: Record<string, string>): string {
  return entries(secrets)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n") + "\n";
}

export function writeSecretsFile(filePath: string, secrets: Record<string, string>): void {
  const secretsContent = buildSecretsContent(secrets);
  const directory = path.dirname(filePath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    debugLog("Created secrets directory:", directory);
  }

  fs.writeFileSync(filePath, secretsContent, { encoding: "utf-8" });
  debugLog("Wrote secrets file:", filePath);
}

function buildMongoDbUri(mongo: { cluster?: string; db?: string; username?: string; password?: string }): string {
  if (!mongo.cluster || !mongo.username || !mongo.password || !mongo.db) {
    return "";
  }
  return `mongodb+srv://${mongo.username}:${mongo.password}@${mongo.cluster}.mongodb.net/${mongo.db}?retryWrites=true&w=majority`;
}

export function buildSecretsFromDatabaseConfig(
  envConfig: EnvironmentConfig,
  globalConfig?: EnvironmentsConfig
): Record<string, string> {
  const secrets: Record<string, string> = {};

  if (globalConfig?.secrets) {
    entries(globalConfig.secrets).forEach(([key, value]) => {
      if (value) secrets[key] = value;
    });
  }

  if (globalConfig?.aws) {
    if (globalConfig.aws.accessKeyId) secrets.AWS_ACCESS_KEY_ID = globalConfig.aws.accessKeyId;
    if (globalConfig.aws.secretAccessKey) secrets.AWS_SECRET_ACCESS_KEY = globalConfig.aws.secretAccessKey;
    if (globalConfig.aws.region) secrets.AWS_REGION = globalConfig.aws.region;
  }

  if (envConfig.aws) {
    if (envConfig.aws.accessKeyId) secrets.AWS_ACCESS_KEY_ID = envConfig.aws.accessKeyId;
    if (envConfig.aws.secretAccessKey) secrets.AWS_SECRET_ACCESS_KEY = envConfig.aws.secretAccessKey;
    if (envConfig.aws.bucket) secrets.AWS_BUCKET = envConfig.aws.bucket;
    if (envConfig.aws.region) secrets.AWS_REGION = envConfig.aws.region;
  }

  if (envConfig.mongo) {
    const mongoUri = buildMongoDbUri(envConfig.mongo);
    if (mongoUri) {
      secrets.MONGODB_URI = mongoUri;
    }
  }

  if (envConfig.secrets) {
    entries(envConfig.secrets).forEach(([key, value]) => {
      if (value) secrets[key] = value;
    });
  }

  return secrets;
}

export function loadSecretsForEnvironment(appName: string): SecretsFile {
  const filePath = secretsPath(appName);
  const secrets = parseSecretsFile(filePath);

  return {
    path: filePath,
    secrets
  };
}

export async function loadSecretsForEnvironmentFromDatabase(
  environmentName: string
): Promise<SecretsFile | null> {
  try {
    const { configuredEnvironments } = await import("../environments/environments-config");
    const envConfigData = await configuredEnvironments();

    const envConfig = envConfigData.environments?.find(e => e.environment === environmentName);
    if (!envConfig) {
      debugLog("Environment not found in database:", environmentName);
      return null;
    }

    const secrets = buildSecretsFromDatabaseConfig(envConfig, envConfigData);

    if (keys(secrets).length === 0) {
      debugLog("No secrets found in database for environment:", environmentName);
      return null;
    }

    debugLog("Loaded %d secrets from database for environment: %s", keys(secrets).length, environmentName);
    return {
      path: `database:${environmentName}`,
      secrets
    };
  } catch (error) {
    debugLog("Error loading secrets from database:", error);
    return null;
  }
}

export async function loadSecretsWithFallback(
  environmentName: string,
  appName: string
): Promise<SecretsFile> {
  const dbSecrets = await loadSecretsForEnvironmentFromDatabase(environmentName);
  if (dbSecrets && keys(dbSecrets.secrets).length > 0) {
    debugLog("Using database secrets for environment:", environmentName);
    return dbSecrets;
  }

  debugLog("Falling back to file-based secrets for app:", appName);
  return loadSecretsForEnvironment(appName);
}

export function secretsExist(appName: string): boolean {
  return fs.existsSync(secretsPath(appName));
}

export function updateSecretsFile(appName: string, newSecrets: Record<string, string>): void {
  const filePath = secretsPath(appName);
  const existingSecrets = parseSecretsFile(filePath);
  const mergedSecrets = { ...existingSecrets, ...newSecrets };
  writeSecretsFile(filePath, mergedSecrets);
  debugLog("Updated secrets file with new keys:", keys(newSecrets));
}
