import debug from "debug";
import { Db } from "mongodb";
import { envConfig } from "../env-config/env-config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  AwsCustomerCredentials,
  EnvironmentSetupRequest,
  MongoDbConnectionParams,
  SetupStepStatus
} from "./types";
import { AWS_DEFAULTS, EnvironmentConfig } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { InboxAliasConnectionStatus } from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { connectToDatabase } from "./database-initialiser";
import { createAdminMember } from "./templates/sample-data/admin-member-template";
import { ProgressCallback } from "./types";
import { dateTimeNowAsValue } from "../shared/dates";
import { buildMongoUri } from "../shared/mongodb-uri";
import { configuredEnvironments } from "../environments/environments-config";
import { connectToEnvironmentMongo } from "./environment-context";
import { stagingHostForSiteHref } from "../../../projects/ngx-ramblers/src/app/functions/hosts";

const debugLog = debug(envConfig.logNamespace("environment-setup:full-duplicate"));
debugLog.enabled = true;

const DOCUMENT_BATCH_SIZE = 1000;
const MAILBOX_CONNECTIONS = "inboxMailboxConnections";

export interface CloneDatabaseResult {
  collections: number;
  documents: number;
}

export function mailboxConnectionSandboxUpdate(): Record<string, unknown> {
  return {
    oauthRefreshTokenEncrypted: null,
    enabled: false,
    connectionStatus: InboxAliasConnectionStatus.NOT_CONNECTED,
    lastErrorMessage: null
  };
}

export function sandboxWalksManager(national: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!national) {
    return null;
  } else {
    const walksManager = (national.walksManager || {}) as Record<string, unknown>;
    return {
      ...national,
      walksManager: {
        ...walksManager,
        password: null
      }
    };
  }
}

export function awsCredentialsFromSource(source: EnvironmentConfig): AwsCustomerCredentials {
  const aws = source.aws;
  if (!aws?.bucket || !aws.accessKeyId || !aws.secretAccessKey) {
    throw new Error(`Source environment ${source.environment} has no S3 credentials to share`);
  } else {
    return {
      accessKeyId: aws.accessKeyId,
      secretAccessKey: aws.secretAccessKey,
      bucket: aws.bucket,
      region: aws.region || AWS_DEFAULTS.REGION,
      iamUserName: `${source.environment}-shared`,
      policyArn: `${source.environment}-shared`
    };
  }
}

export async function groupDomainStagingHostname(source: EnvironmentConfig): Promise<string | null> {
  const { client, db } = await connectToEnvironmentMongo(source);
  try {
    const systemDoc = await db.collection("config").findOne({ key: "system" });
    return stagingHostForSiteHref(systemDoc?.value?.group?.href || null);
  } finally {
    await client.close();
  }
}

export async function loadSourceEnvironment(sourceEnvironmentName: string | null | undefined): Promise<EnvironmentConfig> {
  if (!sourceEnvironmentName) {
    throw new Error("Full duplicate requires a source environment");
  } else {
    const config = await configuredEnvironments();
    const source = (config.environments || []).find(environment => environment.environment === sourceEnvironmentName);
    if (!source) {
      throw new Error(`Source environment ${sourceEnvironmentName} was not found`);
    } else {
      return source;
    }
  }
}

export function sourceMongoParams(source: EnvironmentConfig): MongoDbConnectionParams {
  const mongo = source.mongo;
  if (!mongo?.cluster || !mongo.db || !mongo.username || !mongo.password) {
    throw new Error(`Source environment ${source.environment} has no MongoDB credentials to copy from`);
  } else {
    return {
      uri: buildMongoUri({
        cluster: mongo.cluster,
        username: mongo.username,
        password: mongo.password,
        database: mongo.db
      }),
      database: mongo.db
    };
  }
}

function documentBatches<T>(documents: T[]): T[][] {
  return documents.reduce<T[][]>((groups, document) => {
    const last = groups[groups.length - 1];
    if (!last || last.length >= DOCUMENT_BATCH_SIZE) {
      return groups.concat([[document]]);
    } else {
      return groups.slice(0, -1).concat([last.concat([document])]);
    }
  }, []);
}

export async function cloneSourceDatabase(
  source: MongoDbConnectionParams,
  target: MongoDbConnectionParams,
  progressCallback?: ProgressCallback
): Promise<CloneDatabaseResult> {
  const report = (message: string) => {
    if (progressCallback) {
      progressCallback({
        step: "clone-source-database",
        status: SetupStepStatus.Running,
        message,
        timestamp: dateTimeNowAsValue()
      });
    }
  };
  const sourceConnection = await connectToDatabase(source);
  const targetConnection = await connectToDatabase(target);
  try {
    const existing = await targetConnection.db.listCollections().toArray();
    if (existing.length > 0) {
      throw new Error(`Target database ${target.database} already has ${existing.length} collections — choose an empty database`);
    } else {
      const collections = (await sourceConnection.db.listCollections().toArray())
        .filter(collection => collection.type !== "view");
      debugLog("Cloning %d collections from %s to %s", collections.length, source.database, target.database);
      const totals = await collections.reduce<Promise<{ collections: number; documents: number }>>(async (previous, collection) => {
        const progress = await previous;
        report(`Copying collection ${collection.name}`);
        const documents = await sourceConnection.db.collection(collection.name).find().toArray();
        await targetConnection.db.createCollection(collection.name);
        const batches = documentBatches(documents);
        await batches.reduce<Promise<void>>(async (written, batch) => {
          await written;
          if (batch.length > 0) {
            await targetConnection.db.collection(collection.name).insertMany(batch);
          }
        }, Promise.resolve());
        debugLog("Cloned %d documents into %s.%s", documents.length, target.database, collection.name);
        return {
          collections: progress.collections + 1,
          documents: progress.documents + documents.length
        };
      }, Promise.resolve({ collections: 0, documents: 0 }));
      return totals;
    }
  } finally {
    await sourceConnection.client.close();
    await targetConnection.client.close();
  }
}

export async function sanitiseDuplicatedDatabase(db: Db, siteUrl: string): Promise<void> {
  const configCollection = db.collection("config");
  const systemDoc = await configCollection.findOne({ key: ConfigKey.SYSTEM });
  if (systemDoc?.value) {
    const value = systemDoc.value;
    const national = sandboxWalksManager(value.national || null);
    await configCollection.updateOne(
      { key: ConfigKey.SYSTEM },
      {
        $set: {
          "value.group.href": siteUrl,
          ...(national ? { "value.national": national } : {})
        }
      }
    );
  }
  await configCollection.updateOne(
    { key: ConfigKey.BREVO },
    { $set: { "value.apiKey": null } }
  );
  await db.collection(MAILBOX_CONNECTIONS).updateMany({}, { $set: mailboxConnectionSandboxUpdate() });
  debugLog("Sandbox isolation applied for site URL %s", siteUrl);
}

export async function ensureAdminMemberOnClone(db: Db, request: EnvironmentSetupRequest): Promise<string | null> {
  const { member, passwordResetId } = createAdminMember({
    adminUser: request.adminUser,
    groupCode: request.ramblersInfo.groupCode
  });
  const members = db.collection("members");
  const existing = await members.findOne({ email: member.email });
  if (existing) {
    await members.updateOne(
      { email: member.email },
      {
        $set: {
          memberAdmin: true,
          userAdmin: true,
          walkAdmin: true,
          contentAdmin: true,
          committee: true,
          groupMember: true
        }
      }
    );
    debugLog("Admin member %s already present — left password unchanged", member.email);
    return null;
  } else {
    await members.insertOne(member);
    debugLog("Inserted admin member %s with password reset", member.email);
    return passwordResetId;
  }
}
