import debug from "debug";
import { keys } from "es-toolkit/compat";
import { Db, MongoClient } from "mongodb";
import { envConfig } from "../env-config/env-config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { BUILT_IN_PROCESS_NOTIFICATION_MAPPINGS, NOTIFICATION_CONFIG_DEFAULTS } from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { AdminUserConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";
import { EnvironmentSetupRequest, MongoDbConnectionParams, SetupProgress, ValidationResult } from "./types";
import { createSystemConfig, SystemConfigTemplateParams } from "./templates/system-config-template";
import { createBrevoConfig } from "./templates/brevo-config-template";
import { createCommitteeConfig } from "./templates/committee-config-template";
import { createWalksConfig } from "./templates/walks-config-template";
import { createAdminMember, createSystemMember } from "./templates/sample-data/admin-member-template";
import { createAllSamplePageContent } from "./templates/sample-data/page-content-templates";
import { dateTimeNowAsValue } from "../shared/dates";
import { buildMongoUri as buildMongoUriFromConfig } from "../shared/mongodb-uri";
import { closeMigrationConnection, MigrationRunner } from "../mongo/migrations/migrations-runner";
import { values } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("environment-setup:database-initialiser"));
debugLog.enabled = true;

export type ProgressCallback = (progress: SetupProgress) => void;

export function toGroupShortName(groupName: string): string {
  return groupName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
}

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

export interface CopiedAssets {
  icons: string[];
  logos: string[];
  backgrounds: string[];
}

export interface InitialiseDatabaseResult {
  passwordResetId: string;
}

export async function initialiseDatabase(
  request: EnvironmentSetupRequest,
  progressCallback?: ProgressCallback,
  copiedAssets?: CopiedAssets
): Promise<InitialiseDatabaseResult> {
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
    const collectionNames = values(COLLECTIONS);
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
      recaptchaSecretKey: request.serviceConfigs.recaptcha?.secretKey,
      copiedAssets
    };
    const systemConfig = createSystemConfig(systemConfigParams);
    await upsertConfigDocument(db, ConfigKey.SYSTEM, systemConfig);
    reportProgress("Creating SystemConfig", "completed");

    reportProgress("Creating Brevo config", "running");
    const brevoConfig = createBrevoConfig({ apiKey: request.serviceConfigs.brevo.apiKey });
    await upsertConfigDocument(db, ConfigKey.BREVO, brevoConfig);
    reportProgress("Creating Brevo config", "completed");

    reportProgress("Creating Committee config", "running");
    const groupShortName = toGroupShortName(request.ramblersInfo.groupName);
    const committeeConfig = createCommitteeConfig({ groupShortName });
    await upsertConfigDocument(db, ConfigKey.COMMITTEE, committeeConfig);
    reportProgress("Creating Committee config", "completed");

    reportProgress("Creating Walks config", "running");
    const walksConfig = createWalksConfig();
    await upsertConfigDocument(db, ConfigKey.WALKS, walksConfig);
    reportProgress("Creating Walks config", "completed");

    reportProgress("Creating admin user", "running");
    const { member: adminMember, passwordResetId } = createAdminMember({
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
    await cleanIncorrectPageContent(db);
    reportProgress("Cleaning up incorrect page content", "completed");

    reportProgress("Creating sample pages", "running");
    await seedSamplePages(db, request.ramblersInfo.groupName, groupShortName);
    reportProgress("Creating sample pages", "completed");

    if (request.options.includeNotificationConfigs) {
      reportProgress("Creating notification configs", "running");
      await seedNotificationConfigs(db);
      await wireNotificationConfigsToProcesses(db);
      reportProgress("Creating notification configs", "completed");
    }

    reportProgress("Assigning admin to committee roles", "running");
    await assignAdminToCommitteeRoles(db, request.adminUser);
    reportProgress("Assigning admin to committee roles", "completed");

    await runMigrations(uri, reportProgress);

    reportProgress("Database initialisation complete", "completed");
    return { passwordResetId };
  } finally {
    await client.close();
    debugLog("Closed database connection");
  }
}

const INCORRECT_PAGE_PATHS = ["walks", "admin", "home", "committee"];

export async function cleanIncorrectPageContent(db: Db): Promise<void> {
  const pageContentCollection = db.collection(COLLECTIONS.PAGE_CONTENT);
  for (const pathToClean of INCORRECT_PAGE_PATHS) {
    const result = await pageContentCollection.deleteMany({ path: pathToClean });
    if (result.deletedCount > 0) {
      debugLog(`Cleaned up ${result.deletedCount} incorrect page content with path: ${pathToClean}`);
    }
  }
}

export async function runMigrations(mongoUri: string, reportProgress: (step: string, status: "running" | "completed" | "failed", message?: string) => void): Promise<void> {
  reportProgress("Running database migrations", "running");
  const originalMongoUri = process.env.MONGODB_URI;
  try {
    process.env.MONGODB_URI = mongoUri;
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
}

export async function seedSamplePages(db: Db, groupName: string, groupShortName: string): Promise<{ upsertedCount: number; totalCount: number }> {
  const pageContents = createAllSamplePageContent({ groupName, groupShortName });
  const pageContentCollection = db.collection(COLLECTIONS.PAGE_CONTENT);
  let upsertedCount = 0;
  for (const pageContent of pageContents) {
    const result = await pageContentCollection.updateOne(
      { path: pageContent.path },
      { $set: pageContent },
      { upsert: true }
    );
    if (result.upsertedCount > 0) {
      upsertedCount++;
    }
    debugLog("Upserted page content:", pageContent.path);
  }
  return { upsertedCount, totalCount: pageContents.length };
}

export async function seedNotificationConfigs(db: Db): Promise<{ seededCount: number; skippedCount: number }> {
  const notificationConfigsCollection = db.collection(COLLECTIONS.NOTIFICATION_CONFIGS);
  let seededCount = 0;
  let skippedCount = 0;
  for (const config of NOTIFICATION_CONFIG_DEFAULTS) {
    const result = await notificationConfigsCollection.updateOne(
      {"subject.text": config.subject.text},
      {$setOnInsert: config},
      {upsert: true}
    );
    if (result.upsertedCount > 0) {
      seededCount++;
    } else {
      skippedCount++;
    }
  }
  debugLog(`Notification configs: seeded ${seededCount}, skipped ${skippedCount}`);
  return { seededCount, skippedCount };
}

export async function wireNotificationConfigsToProcesses(db: Db): Promise<{ wiredCount: number }> {
  const notificationConfigsCollection = db.collection(COLLECTIONS.NOTIFICATION_CONFIGS);
  const configCollection = db.collection(COLLECTIONS.CONFIG);

  const updates: Record<string, string> = {};

  for (const [processKey, subjectText] of Object.entries(BUILT_IN_PROCESS_NOTIFICATION_MAPPINGS)) {
    const config = await notificationConfigsCollection.findOne({"subject.text": subjectText});
    if (config?._id) {
      updates[`value.${processKey}`] = config._id.toString();
    }
  }

  const wiredCount = keys(updates).length;
  if (wiredCount > 0) {
    await configCollection.updateOne(
      { key: ConfigKey.BREVO },
      { $set: updates }
    );
  }

  debugLog(`Wired ${wiredCount} notification configs to built-in processes`);
  return { wiredCount };
}

export async function assignAdminToCommitteeRoles(
  db: Db,
  adminUser: AdminUserConfig,
  rolesToAssign: string[] = ["membership", "support"]
): Promise<{ assignedCount: number }> {
  const configCollection = db.collection(COLLECTIONS.CONFIG);
  const committeeDoc = await configCollection.findOne({ key: ConfigKey.COMMITTEE });
  if (!committeeDoc?.value?.roles) return { assignedCount: 0 };

  const fullName = `${adminUser.firstName} ${adminUser.lastName}`;
  const roles = committeeDoc.value.roles;
  let assignedCount = 0;

  for (const role of roles) {
    if (rolesToAssign.includes(role.type) && role.vacant) {
      role.email = adminUser.email.toLowerCase();
      role.fullName = fullName;
      role.nameAndDescription = `${fullName} - ${role.description}`;
      role.vacant = false;
      assignedCount++;
    }
  }

  const contactUs = committeeDoc.value.contactUs || {};
  for (const roleType of rolesToAssign) {
    if (contactUs[roleType]) {
      const matchingRole = roles.find((r: { type: string }) => r.type === roleType);
      if (matchingRole) {
        contactUs[roleType] = { ...matchingRole };
      }
    }
  }

  if (assignedCount > 0) {
    await configCollection.updateOne(
      { key: ConfigKey.COMMITTEE },
      { $set: { "value.roles": roles, "value.contactUs": contactUs } }
    );
  }

  debugLog(`Assigned admin to ${assignedCount} committee roles`);
  return { assignedCount };
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
    const groupShortName = params.groupShortName || toGroupShortName(params.groupName);

    reportProgress("Cleaning up incorrect page content", "running");
    await cleanIncorrectPageContent(db);
    reportProgress("Cleaning up incorrect page content", "completed");

    reportProgress("Seeding sample pages", "running");
    await seedSamplePages(db, params.groupName, groupShortName);
    reportProgress("Seeding sample pages", "completed");

    await runMigrations(params.mongoUri, reportProgress);

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
    const groupShortName = toGroupShortName(params.groupName);

    reportProgress("Creating collections", "running");
    const collectionNames = values(COLLECTIONS);
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
    await cleanIncorrectPageContent(db);
    reportProgress("Cleaning up incorrect page content", "completed");

    reportProgress("Updating sample pages", "running");
    await seedSamplePages(db, params.groupName, groupShortName);
    reportProgress("Updating sample pages", "completed");

    await runMigrations(params.mongoUri, reportProgress);

    reportProgress("Database reinitialisation complete", "completed");
  } finally {
    await client.close();
    debugLog("Closed database connection");
  }
}
