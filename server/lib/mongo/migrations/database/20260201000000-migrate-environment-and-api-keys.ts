import { Db, MongoClient } from "mongodb";
import createMigrationLogger from "../migrations-logger";
import { keys } from "es-toolkit/compat";

const debugLog = createMigrationLogger("migrate-environment-and-api-keys");
const CONFIG_COLLECTION = "configs";
const SYSTEM_CONFIG_KEY = "system";
const ENVIRONMENTS_CONFIG_KEY = "environments";

export async function up(db: Db, client: MongoClient) {
  const collection = db.collection(CONFIG_COLLECTION);

  await migrateApiKeysToSystemConfig(collection);
  await migrateEnvironmentConfig(collection);
  await migrateExistingMongoUriToCluster(collection);
}

async function migrateApiKeysToSystemConfig(collection: any) {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_APIKEY;
  const osMapsApiKey = process.env.OS_MAPS_API_KEY;
  const recaptchaSiteKey = process.env.RECAPTCHA_SITE_KEY;
  const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;

  const hasEnvVars = googleMapsApiKey || osMapsApiKey || recaptchaSiteKey || recaptchaSecretKey;
  if (!hasEnvVars) {
    debugLog("No API key environment variables found, skipping system config migration");
    return;
  }

  const systemConfig = await collection.findOne({ key: SYSTEM_CONFIG_KEY });

  if (!systemConfig) {
    debugLog("No system config found, creating new config with API keys");
    const value: any = {};

    if (googleMapsApiKey) {
      value.googleMaps = { apiKey: googleMapsApiKey };
    }
    if (osMapsApiKey) {
      value.externalSystems = { osMaps: { apiKey: osMapsApiKey } };
    }
    if (recaptchaSiteKey || recaptchaSecretKey) {
      value.recaptcha = {};
      if (recaptchaSiteKey) value.recaptcha.siteKey = recaptchaSiteKey;
      if (recaptchaSecretKey) value.recaptcha.secretKey = recaptchaSecretKey;
    }

    await collection.insertOne({ key: SYSTEM_CONFIG_KEY, value });
    debugLog("Created new system config with API keys");
    return;
  }

  const updates: any = {};

  if (googleMapsApiKey && !systemConfig.value?.googleMaps?.apiKey) {
    updates["value.googleMaps.apiKey"] = googleMapsApiKey;
    debugLog("Will migrate GOOGLE_MAPS_APIKEY");
  }

  if (osMapsApiKey && !systemConfig.value?.externalSystems?.osMaps?.apiKey) {
    updates["value.externalSystems.osMaps.apiKey"] = osMapsApiKey;
    debugLog("Will migrate OS_MAPS_API_KEY");
  }

  if (recaptchaSiteKey && !systemConfig.value?.recaptcha?.siteKey) {
    updates["value.recaptcha.siteKey"] = recaptchaSiteKey;
    debugLog("Will migrate RECAPTCHA_SITE_KEY");
  }

  if (recaptchaSecretKey && !systemConfig.value?.recaptcha?.secretKey) {
    updates["value.recaptcha.secretKey"] = recaptchaSecretKey;
    debugLog("Will migrate RECAPTCHA_SECRET_KEY");
  }

  if (keys(updates).length === 0) {
    debugLog("All API keys already exist in database, skipping");
    return;
  }

  const updateResult = await collection.updateOne(
    { key: SYSTEM_CONFIG_KEY },
    { $set: updates }
  );

  if (updateResult.modifiedCount > 0) {
    debugLog("Successfully migrated API keys to system config");
  }
}

async function migrateEnvironmentConfig(collection: any) {
  const appName = process.env.APP_NAME;

  if (!appName) {
    debugLog("No APP_NAME environment variable found, skipping environment config migration");
    return;
  }

  const environmentName = appName.replace(/^ngx-ramblers-/, "");
  debugLog(`Migrating environment configuration for: ${environmentName}`);

  const awsConfig = {
    bucket: process.env.AWS_BUCKET || "",
    region: process.env.AWS_REGION || "eu-west-2",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
  };

  const mongoUri = process.env.MONGODB_URI || "";
  const mongoConfig = {
    cluster: extractClusterFromUri(mongoUri),
    db: extractDatabaseFromUri(mongoUri),
    username: extractUsernameFromUri(mongoUri),
    password: extractPasswordFromUri(mongoUri)
  };

  const flyioConfig = {
    apiKey: process.env.FLY_API_TOKEN || "",
    appName: appName,
    memory: "512mb",
    scaleCount: 1,
    organisation: "personal"
  };

  const hasAws = !!(awsConfig.bucket || awsConfig.accessKeyId);
  const hasMongo = !!mongoUri;
  const hasFlyio = !!flyioConfig.apiKey;

  if (!hasAws && !hasMongo && !hasFlyio) {
    debugLog("No environment configuration values found, skipping");
    return;
  }

  const existingConfig = await collection.findOne({ key: ENVIRONMENTS_CONFIG_KEY });

  const environmentEntry: any = { environment: environmentName };
  if (hasAws) environmentEntry.aws = awsConfig;
  if (hasMongo) environmentEntry.mongo = mongoConfig;
  if (hasFlyio) environmentEntry.flyio = flyioConfig;

  if (!existingConfig) {
    const newConfig = {
      key: ENVIRONMENTS_CONFIG_KEY,
      value: {
        environments: [environmentEntry],
        aws: { bucket: awsConfig.bucket, region: awsConfig.region },
        secrets: {}
      }
    };

    await collection.insertOne(newConfig);
    debugLog(`Created environments config with ${environmentName}`);
    return;
  }

  const existingEnvironments = existingConfig.value?.environments || [];
  const existingEnvIndex = existingEnvironments.findIndex(
    (env: any) => env.environment === environmentName
  );

  if (existingEnvIndex >= 0) {
    const existingEnv = existingEnvironments[existingEnvIndex];
    existingEnvironments[existingEnvIndex] = {
      ...existingEnv,
      aws: mergeConfig(existingEnv.aws, environmentEntry.aws),
      mongo: mergeConfig(existingEnv.mongo, environmentEntry.mongo),
      flyio: mergeConfig(existingEnv.flyio, environmentEntry.flyio)
    };
    debugLog(`Merged config for existing environment ${environmentName}`);
  } else {
    existingEnvironments.push(environmentEntry);
    debugLog(`Added new environment ${environmentName}`);
  }

  const globalAws = existingConfig.value?.aws || {};
  if (!globalAws.bucket && awsConfig.bucket) globalAws.bucket = awsConfig.bucket;
  if (!globalAws.region && awsConfig.region) globalAws.region = awsConfig.region;

  await collection.updateOne(
    { key: ENVIRONMENTS_CONFIG_KEY },
    { $set: { "value.environments": existingEnvironments, "value.aws": globalAws } }
  );

  debugLog(`Successfully migrated environment configuration for ${environmentName}`);
}

async function migrateExistingMongoUriToCluster(collection: any) {
  const existingConfig = await collection.findOne({ key: ENVIRONMENTS_CONFIG_KEY });

  if (!existingConfig?.value?.environments?.length) {
    debugLog("No existing environments config found, skipping uri to cluster migration");
    return;
  }

  const environments = existingConfig.value.environments;
  let updated = false;

  for (const env of environments) {
    if (env.mongo?.uri && !env.mongo?.cluster) {
      const cluster = extractClusterFromUri(env.mongo.uri);
      const db = env.mongo.db || extractDatabaseFromUri(env.mongo.uri);
      const username = env.mongo.username || extractUsernameFromUri(env.mongo.uri);
      const password = env.mongo.password || extractPasswordFromUri(env.mongo.uri);

      if (cluster) {
        env.mongo.cluster = cluster;
        env.mongo.db = db;
        env.mongo.username = username;
        env.mongo.password = password;
        delete env.mongo.uri;
        updated = true;
        debugLog(`Converted mongo.uri to cluster for environment: ${env.environment}`);
      }
    }
  }

  if (updated) {
    await collection.updateOne(
      { key: ENVIRONMENTS_CONFIG_KEY },
      { $set: { "value.environments": environments } }
    );
    debugLog("Successfully migrated existing mongo.uri fields to cluster format");
  } else {
    debugLog("No environments needed uri to cluster migration");
  }
}

export async function down(db: Db, client: MongoClient) {
  debugLog("No down migration - configuration is intentionally left in place");
}

function extractClusterFromUri(uri: string): string {
  if (!uri) return "";
  let match = uri.match(/@([^.]+\.[^.]+)\.mongodb\.net/);
  if (match) return match[1];
  match = uri.match(/mongodb(?:\+srv)?:\/\/([^.]+\.[^.]+)\.mongodb\.net/);
  return match ? match[1] : "";
}

function extractDatabaseFromUri(uri: string): string {
  if (!uri) return "";
  const match = uri.match(/\/([^/?]+)(\?|$)/);
  return match ? match[1] : "";
}

function extractUsernameFromUri(uri: string): string {
  if (!uri) return "";
  const match = uri.match(/mongodb(?:\+srv)?:\/\/([^:]+):/);
  return match ? match[1] : "";
}

function extractPasswordFromUri(uri: string): string {
  if (!uri) return "";
  const match = uri.match(/mongodb(?:\+srv)?:\/\/[^:]+:([^@]+)@/);
  return match ? decodeURIComponent(match[1]) : "";
}

function mergeConfig(existing: any, newValues: any): any {
  if (!existing && !newValues) return undefined;
  if (!existing) return newValues;
  if (!newValues) return existing;

  const merged = { ...existing };
  for (const [key, value] of Object.entries(newValues)) {
    if (!merged[key] && value) {
      merged[key] = value;
    }
  }
  return merged;
}
