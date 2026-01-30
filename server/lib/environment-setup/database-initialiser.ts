import debug from "debug";
import { MongoClient, Db } from "mongodb";
import { envConfig } from "../env-config/env-config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  EnvironmentSetupRequest,
  MongoDbConnectionParams,
  SetupProgress,
  ValidationResult
} from "./types";
import { createSystemConfig, SystemConfigTemplateParams } from "./templates/system-config-template";
import { createBrevoConfig } from "./templates/brevo-config-template";
import { createCommitteeConfig } from "./templates/committee-config-template";
import { createWalksConfig } from "./templates/walks-config-template";
import { createAdminMember, createSystemMember } from "./templates/sample-data/admin-member-template";
import { createAllSamplePageContent } from "./templates/sample-data/page-content-templates";
import { dateTimeNowAsValue } from "../shared/dates";
import { buildMongoUri as buildMongoUriFromConfig } from "../shared/mongodb-uri";
import { MigrationRunner, closeMigrationConnection } from "../mongo/migrations/migrations-runner";

const debugLog = debug(envConfig.logNamespace("environment-setup:database-initialiser"));
debugLog.enabled = true;

export type ProgressCallback = (progress: SetupProgress) => void;

const COLLECTIONS = {
  CONFIG: "config",
  MEMBERS: "members",
  PAGE_CONTENT: "pageContent",
  WALKS: "walks",
  SOCIAL_EVENTS: "socialEvents",
  COMMITTEE_FILES: "committeeFiles",
  NOTIFICATION_CONFIGS: "notificationConfigs",
  BANNERS: "banners",
  CHANGELOG: "changelog"
} as const;

function buildMongoUri(config: EnvironmentSetupRequest): string {
  const { mongodb } = config.serviceConfigs;
  return buildMongoUriFromConfig({
    cluster: mongodb.cluster,
    username: mongodb.username,
    password: mongodb.password,
    database: mongodb.database
  });
}

export async function connectToDatabase(params: MongoDbConnectionParams): Promise<{ client: MongoClient; db: Db }> {
  debugLog("Connecting to database:", params.database);
  const client = await MongoClient.connect(params.uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
  });
  const db = client.db(params.database);
  debugLog("Connected to database:", params.database);
  return { client, db };
}

export async function validateMongoConnection(params: MongoDbConnectionParams): Promise<ValidationResult> {
  try {
    const { client, db } = await connectToDatabase(params);
    await db.command({ ping: 1 });
    await client.close();
    return { valid: true, message: "MongoDB connection successful" };
  } catch (error) {
    const errorMessage = error.message || "Unknown error";
    let details = "";

    if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
      details = "The cluster hostname could not be resolved. Please check the cluster name is correct.";
    } else if (errorMessage.includes("authentication failed") || errorMessage.includes("AuthenticationFailed")) {
      details = "Invalid username or password. Please verify your MongoDB Atlas credentials.";
    } else if (errorMessage.includes("timed out") || errorMessage.includes("ETIMEDOUT")) {
      details = "Connection timed out. This usually means Network Access is not configured in MongoDB Atlas. Go to MongoDB Atlas > Network Access and add 0.0.0.0/0 to allow connections from any IP, or add your specific IP address.";
    } else if (errorMessage.includes("ECONNREFUSED")) {
      details = "Connection refused. The database server may be down or the port may be blocked.";
    } else if (errorMessage.includes("not authorized") || errorMessage.includes("Unauthorized")) {
      details = "User is not authorised to access this database. Check that the user has the correct permissions in MongoDB Atlas.";
    } else if (errorMessage.includes("certificate")) {
      details = "SSL/TLS certificate error. Check your cluster connection string and SSL settings.";
    }

    const fullMessage = details
      ? `MongoDB connection failed: ${errorMessage}. ${details}`
      : `MongoDB connection failed: ${errorMessage}`;

    return {
      valid: false,
      message: fullMessage,
      details: { errorType: error.name, originalError: errorMessage, suggestion: details }
    };
  }
}

async function ensureCollection(db: Db, collectionName: string): Promise<void> {
  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) {
    await db.createCollection(collectionName);
    debugLog("Created collection:", collectionName);
  } else {
    debugLog("Collection already exists:", collectionName);
  }
}

async function upsertConfigDocument(db: Db, key: ConfigKey, value: unknown): Promise<void> {
  const collection = db.collection(COLLECTIONS.CONFIG);
  await collection.updateOne(
    { key },
    { $set: { key, value } },
    { upsert: true }
  );
  debugLog("Upserted config document:", key);
}

export async function initialiseDatabase(
  request: EnvironmentSetupRequest,
  progressCallback?: ProgressCallback
): Promise<void> {
  const uri = buildMongoUri(request);
  const database = request.serviceConfigs.mongodb.database;

  const reportProgress = (step: string, status: "running" | "completed" | "failed", message?: string) => {
    if (progressCallback) {
      progressCallback({ step, status, message, timestamp: dateTimeNowAsValue() });
    }
  };

  reportProgress("Connecting to database", "running");
  const { client, db } = await connectToDatabase({ uri, database });

  try {
    reportProgress("Creating collections", "running");
    const collectionNames = Object.values(COLLECTIONS);
    for (const collectionName of collectionNames) {
      await ensureCollection(db, collectionName);
    }
    reportProgress("Creating collections", "completed");

    reportProgress("Creating SystemConfig", "running");
    const systemConfigParams: SystemConfigTemplateParams = {
      groupData: request.ramblersInfo.groupData,
      areaCode: request.ramblersInfo.areaCode,
      areaName: request.ramblersInfo.areaName,
      ramblersApiConfig: request.serviceConfigs.ramblers,
      googleMapsApiKey: request.serviceConfigs.googleMaps?.apiKey,
      osMapsApiKey: request.serviceConfigs.osMaps?.apiKey,
      recaptchaSiteKey: request.serviceConfigs.recaptcha?.siteKey,
      recaptchaSecretKey: request.serviceConfigs.recaptcha?.secretKey
    };
    const systemConfig = createSystemConfig(systemConfigParams);
    await upsertConfigDocument(db, ConfigKey.SYSTEM, systemConfig);
    reportProgress("Creating SystemConfig", "completed");

    reportProgress("Creating Brevo config", "running");
    const brevoConfig = createBrevoConfig({ apiKey: request.serviceConfigs.brevo.apiKey });
    await upsertConfigDocument(db, ConfigKey.BREVO, brevoConfig);
    reportProgress("Creating Brevo config", "completed");

    reportProgress("Creating Committee config", "running");
    const groupShortName = request.ramblersInfo.groupName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    const committeeConfig = createCommitteeConfig({ groupShortName });
    await upsertConfigDocument(db, ConfigKey.COMMITTEE, committeeConfig);
    reportProgress("Creating Committee config", "completed");

    reportProgress("Creating Walks config", "running");
    const walksConfig = createWalksConfig();
    await upsertConfigDocument(db, ConfigKey.WALKS, walksConfig);
    reportProgress("Creating Walks config", "completed");

    reportProgress("Creating admin user", "running");
    const adminMember = await createAdminMember({
      adminUser: request.adminUser,
      groupCode: request.ramblersInfo.groupCode
    });
    const membersCollection = db.collection(COLLECTIONS.MEMBERS);
    const existingAdmin = await membersCollection.findOne({ email: adminMember.email.toLowerCase() });
    if (existingAdmin) {
      debugLog("Admin member already exists, updating");
      await membersCollection.updateOne(
        { email: adminMember.email.toLowerCase() },
        { $set: adminMember }
      );
    } else {
      await membersCollection.insertOne(adminMember);
    }
    reportProgress("Creating admin user", "completed");

    const systemMember = createSystemMember();
    const existingSystemMember = await membersCollection.findOne({ memberId: "system" });
    if (!existingSystemMember) {
      await membersCollection.insertOne(systemMember);
      debugLog("Created system member");
    }

    reportProgress("Cleaning up incorrect page content", "running");
    const pageContentCollection = db.collection(COLLECTIONS.PAGE_CONTENT);
    const incorrectPaths = ["walks", "admin", "home", "committee"];
    for (const pathToClean of incorrectPaths) {
      const result = await pageContentCollection.deleteMany({
        path: pathToClean
      });
      if (result.deletedCount > 0) {
        debugLog(`Cleaned up ${result.deletedCount} incorrect page content with path: ${pathToClean}`);
      }
    }
    reportProgress("Cleaning up incorrect page content", "completed");

    reportProgress("Creating sample pages", "running");
    const pageContents = createAllSamplePageContent({
      groupName: request.ramblersInfo.groupName,
      groupShortName
    });

    for (const pageContent of pageContents) {
      await pageContentCollection.updateOne(
        { path: pageContent.path },
        { $set: pageContent },
        { upsert: true }
      );
      debugLog("Upserted page content:", pageContent.path);
    }
    reportProgress("Creating sample pages", "completed");

    if (request.options.includeNotificationConfigs) {
      reportProgress("Creating notification configs", "running");
      const notificationConfigsCollection = db.collection(COLLECTIONS.NOTIFICATION_CONFIGS);
      const existingCount = await notificationConfigsCollection.countDocuments({});
      if (existingCount === 0) {
        debugLog("No existing notification configs, will be created on first use");
      }
      reportProgress("Creating notification configs", "completed");
    }

    reportProgress("Running database migrations", "running");
    const originalMongoUri = process.env.MONGODB_URI;
    try {
      process.env.MONGODB_URI = uri;
      const runner = new MigrationRunner();
      const result = await runner.runPendingMigrations();
      if (result.success) {
        reportProgress("Running database migrations", "completed", `Applied ${result.appliedFiles.length} migration(s)`);
      } else {
        reportProgress("Running database migrations", "failed", result.error);
        throw new Error(`Migration failed: ${result.error}`);
      }
    } finally {
      await closeMigrationConnection();
      if (originalMongoUri !== undefined) {
        process.env.MONGODB_URI = originalMongoUri;
      } else {
        delete process.env.MONGODB_URI;
      }
    }

    reportProgress("Database initialisation complete", "completed");
  } finally {
    await client.close();
    debugLog("Closed database connection");
  }
}

export async function databaseAlreadyInitialised(params: MongoDbConnectionParams): Promise<boolean> {
  try {
    const { client, db } = await connectToDatabase(params);
    const configCollection = db.collection(COLLECTIONS.CONFIG);
    const systemConfig = await configCollection.findOne({ key: ConfigKey.SYSTEM });
    await client.close();
    return systemConfig !== null;
  } catch {
    return false;
  }
}

export interface SeedDatabaseParams {
  mongoUri: string;
  database: string;
  groupName: string;
  groupShortName?: string;
}

export async function seedSampleData(
  params: SeedDatabaseParams,
  progressCallback?: ProgressCallback
): Promise<void> {
  const reportProgress = (step: string, status: "running" | "completed" | "failed", message?: string) => {
    if (progressCallback) {
      progressCallback({ step, status, message, timestamp: dateTimeNowAsValue() });
    }
  };

  reportProgress("Connecting to database for seeding", "running");
  const { client, db } = await connectToDatabase({ uri: params.mongoUri, database: params.database });

  try {
    const groupShortName = params.groupShortName || params.groupName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");

    reportProgress("Cleaning up incorrect page content", "running");
    const pageContentCollection = db.collection(COLLECTIONS.PAGE_CONTENT);
    const incorrectPaths = ["walks", "admin", "home", "committee"];
    for (const pathToClean of incorrectPaths) {
      const result = await pageContentCollection.deleteMany({ path: pathToClean });
      if (result.deletedCount > 0) {
        debugLog(`Cleaned up ${result.deletedCount} incorrect page content with path: ${pathToClean}`);
      }
    }
    reportProgress("Cleaning up incorrect page content", "completed");

    reportProgress("Seeding sample pages", "running");
    const pageContents = createAllSamplePageContent({
      groupName: params.groupName,
      groupShortName
    });

    for (const pageContent of pageContents) {
      await pageContentCollection.updateOne(
        { path: pageContent.path },
        { $set: pageContent },
        { upsert: true }
      );
      debugLog("Upserted page content:", pageContent.path);
    }
    reportProgress("Seeding sample pages", "completed");

    reportProgress("Running database migrations", "running");
    const originalMongoUri = process.env.MONGODB_URI;
    try {
      process.env.MONGODB_URI = params.mongoUri;
      const runner = new MigrationRunner();
      const result = await runner.runPendingMigrations();
      if (result.success) {
        reportProgress("Running database migrations", "completed", `Applied ${result.appliedFiles.length} migration(s)`);
      } else {
        reportProgress("Running database migrations", "failed", result.error);
        throw new Error(`Migration failed: ${result.error}`);
      }
    } finally {
      await closeMigrationConnection();
      if (originalMongoUri !== undefined) {
        process.env.MONGODB_URI = originalMongoUri;
      } else {
        delete process.env.MONGODB_URI;
      }
    }

    reportProgress("Database seeding complete", "completed");
  } finally {
    await client.close();
    debugLog("Closed database connection");
  }
}

export interface ReinitDatabaseParams {
  mongoUri: string;
  database: string;
  groupName: string;
  groupCode: string;
  areaCode: string;
  areaName: string;
  ramblersApiKey: string;
  googleMapsApiKey?: string;
  osMapsApiKey?: string;
}

export async function reinitialiseDatabase(
  params: ReinitDatabaseParams,
  progressCallback?: ProgressCallback
): Promise<void> {
  const reportProgress = (step: string, status: "running" | "completed" | "failed", message?: string) => {
    if (progressCallback) {
      progressCallback({ step, status, message, timestamp: dateTimeNowAsValue() });
    }
  };

  reportProgress("Connecting to database for reinitialisation", "running");
  const { client, db } = await connectToDatabase({ uri: params.mongoUri, database: params.database });

  try {
    const groupShortName = params.groupName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");

    reportProgress("Creating collections", "running");
    const collectionNames = Object.values(COLLECTIONS);
    for (const collectionName of collectionNames) {
      await ensureCollection(db, collectionName);
    }
    reportProgress("Creating collections", "completed");

    reportProgress("Fetching group data from Ramblers API", "running");
    const { groupDetails } = await import("./ramblers-api-client");
    const groupData = await groupDetails({
      groupCode: params.groupCode,
      apiKey: params.ramblersApiKey
    });
    if (!groupData) {
      throw new Error(`Failed to fetch group details for ${params.groupCode}`);
    }
    reportProgress("Fetching group data from Ramblers API", "completed", `Found: ${groupData.name}`);

    reportProgress("Updating SystemConfig", "running");
    const systemConfigParams: SystemConfigTemplateParams = {
      groupData,
      areaCode: params.areaCode,
      areaName: params.areaName,
      ramblersApiConfig: { apiKey: params.ramblersApiKey },
      googleMapsApiKey: params.googleMapsApiKey,
      osMapsApiKey: params.osMapsApiKey
    };
    const systemConfig = createSystemConfig(systemConfigParams);
    await upsertConfigDocument(db, ConfigKey.SYSTEM, systemConfig);
    reportProgress("Updating SystemConfig", "completed");

    reportProgress("Updating Committee config", "running");
    const committeeConfig = createCommitteeConfig({ groupShortName });
    await upsertConfigDocument(db, ConfigKey.COMMITTEE, committeeConfig);
    reportProgress("Updating Committee config", "completed");

    reportProgress("Updating Walks config", "running");
    const walksConfig = createWalksConfig();
    await upsertConfigDocument(db, ConfigKey.WALKS, walksConfig);
    reportProgress("Updating Walks config", "completed");

    reportProgress("Cleaning up incorrect page content", "running");
    const pageContentCollection = db.collection(COLLECTIONS.PAGE_CONTENT);
    const incorrectPaths = ["walks", "admin", "home", "committee"];
    for (const pathToClean of incorrectPaths) {
      const result = await pageContentCollection.deleteMany({ path: pathToClean });
      if (result.deletedCount > 0) {
        debugLog(`Cleaned up ${result.deletedCount} incorrect page content with path: ${pathToClean}`);
      }
    }
    reportProgress("Cleaning up incorrect page content", "completed");

    reportProgress("Updating sample pages", "running");
    const pageContents = createAllSamplePageContent({
      groupName: params.groupName,
      groupShortName
    });

    for (const pageContent of pageContents) {
      await pageContentCollection.updateOne(
        { path: pageContent.path },
        { $set: pageContent },
        { upsert: true }
      );
      debugLog("Upserted page content:", pageContent.path);
    }
    reportProgress("Updating sample pages", "completed");

    reportProgress("Running database migrations", "running");
    const originalMongoUri = process.env.MONGODB_URI;
    try {
      process.env.MONGODB_URI = params.mongoUri;
      const runner = new MigrationRunner();
      const result = await runner.runPendingMigrations();
      if (result.success) {
        reportProgress("Running database migrations", "completed", `Applied ${result.appliedFiles.length} migration(s)`);
      } else {
        reportProgress("Running database migrations", "failed", result.error);
        throw new Error(`Migration failed: ${result.error}`);
      }
    } finally {
      await closeMigrationConnection();
      if (originalMongoUri !== undefined) {
        process.env.MONGODB_URI = originalMongoUri;
      } else {
        delete process.env.MONGODB_URI;
      }
    }

    reportProgress("Database reinitialisation complete", "completed");
  } finally {
    await client.close();
    debugLog("Closed database connection");
  }
}
