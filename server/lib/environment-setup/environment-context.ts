import debug from "debug";
import { Db, MongoClient } from "mongodb";
import { envConfig } from "../env-config/env-config";
import { EnvironmentConfig, EnvironmentsConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { configuredEnvironments } from "../environments/environments-config";
import { loadSecretsForEnvironment } from "../shared/secrets";
import { buildMongoUri } from "../shared/mongodb-uri";
import { connectToDatabase } from "./database-initialiser";
import { SecretsFile } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";

const debugLog = debug(envConfig.logNamespace("environment-setup:context"));
debugLog.enabled = true;

export interface EnvironmentContext {
  environmentsConfig: EnvironmentsConfig;
  envConfigData: EnvironmentConfig;
  appName: string;
  secrets: SecretsFile;
}

export interface EnvironmentMongoConnection {
  client: MongoClient;
  db: Db;
  database: string;
}

export async function loadEnvironmentContext(environmentName: string): Promise<EnvironmentContext> {
  const environmentsConfig = await configuredEnvironments();
  const envConfigData = environmentsConfig.environments?.find(e => e.environment === environmentName);
  if (!envConfigData) {
    throw new EnvironmentNotFoundError(environmentName);
  }
  const appName = envConfigData.flyio?.appName || `ngx-ramblers-${environmentName}`;
  const secrets = loadSecretsForEnvironment(appName);
  return { environmentsConfig, envConfigData, appName, secrets };
}

export async function connectToEnvironmentMongo(envConfigData: EnvironmentConfig): Promise<EnvironmentMongoConnection> {
  const mongoConfig = envConfigData.mongo;
  if (!mongoConfig?.cluster || !mongoConfig?.db) {
    throw new Error(`No MongoDB configured for environment ${envConfigData.environment}`);
  }
  const database = mongoConfig.db;
  const mongoUri = buildMongoUri({
    cluster: mongoConfig.cluster,
    username: mongoConfig.username || "",
    password: mongoConfig.password || "",
    database
  });
  const { client, db } = await connectToDatabase({ uri: mongoUri, database });
  return { client, db, database };
}

export async function withBrevoApiKey<T>(brevoKey: string, fn: () => Promise<T>): Promise<T> {
  const originalKey = process.env.BREVO_API_KEY;
  process.env.BREVO_API_KEY = brevoKey;
  try {
    return await fn();
  } finally {
    if (originalKey !== undefined) {
      process.env.BREVO_API_KEY = originalKey;
    } else {
      delete process.env.BREVO_API_KEY;
    }
  }
}

export const DEFAULT_BASE_DOMAIN = "ngx-ramblers.org.uk";

export function baseDomainFrom(environmentsConfig: EnvironmentsConfig): string {
  return environmentsConfig.cloudflare?.baseDomain || DEFAULT_BASE_DOMAIN;
}

export class EnvironmentNotFoundError extends Error {
  constructor(environmentName: string) {
    super(`Environment ${environmentName} not found`);
    this.name = "EnvironmentNotFoundError";
  }
}
