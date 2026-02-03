import { Command } from "commander";
import debug from "debug";
import fs from "fs";
import { MongoClient } from "mongodb";
import { DeleteBucketCommand, DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import {
  DeleteAccessKeyCommand,
  DeletePolicyCommand,
  DeleteUserCommand,
  DetachUserPolicyCommand,
  IAMClient,
  ListAccessKeysCommand,
  ListAttachedUserPoliciesCommand
} from "@aws-sdk/client-iam";
import { envConfig } from "../../env-config/env-config";
import { removeEnvironment } from "../../shared/configs-json";
import { findEnvironmentFromDatabase } from "../../environments/environments-config";
import { loadSecretsForEnvironment, secretsPath } from "../../shared/secrets";
import { runCommand } from "../../../deploy/fly-commands";
import { adminConfigFromEnvironment } from "../../environment-setup/aws-setup";
import { ProgressCallback } from "../types";
import { log } from "../cli-logger";

const debugLog = debug(envConfig.logNamespace("cli:destroy"));

export interface DestroyConfig {
  name: string;
  appName: string;
  apiKey?: string;
  mongoUri?: string;
  database?: string;
  skipFly?: boolean;
  skipS3?: boolean;
  skipDatabase?: boolean;
  skipConfigs?: boolean;
}

export interface DestroyResult {
  success: boolean;
  steps: { step: string; success: boolean; message: string }[];
}

function setFlyApiToken(apiKey?: string): void {
  if (apiKey) {
    process.env.FLY_API_TOKEN = apiKey;
    debugLog("Using stored fly.io API token for destroy");
  }
}

async function deleteS3BucketContents(s3Client: S3Client, bucketName: string, continuationToken?: string): Promise<void> {
  const listResponse = await s3Client.send(new ListObjectsV2Command({
    Bucket: bucketName,
    ContinuationToken: continuationToken
  }));

  const objects = listResponse.Contents || [];
  if (objects.length > 0) {
    await s3Client.send(new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: objects.map(obj => ({Key: obj.Key}))
      }
    }));
    debugLog(`Deleted ${objects.length} objects from bucket ${bucketName}`);
  }

  if (listResponse.NextContinuationToken) {
    await deleteS3BucketContents(s3Client, bucketName, listResponse.NextContinuationToken);
  }
}

async function deleteIamUserWithPolicies(iamClient: IAMClient, userName: string): Promise<void> {
  const attachedPolicies = await iamClient.send(new ListAttachedUserPoliciesCommand({
    UserName: userName
  }));

  const policiesToDelete = (attachedPolicies.AttachedPolicies || [])
    .filter(policy => policy.PolicyArn)
    .map(policy => policy.PolicyArn as string);

  await Promise.all(policiesToDelete.map(async policyArn => {
    await iamClient.send(new DetachUserPolicyCommand({
      UserName: userName,
      PolicyArn: policyArn
    }));
    debugLog(`Detached policy ${policyArn} from user ${userName}`);

    if (policyArn.includes("ngx-ramblers-")) {
      await iamClient.send(new DeletePolicyCommand({PolicyArn: policyArn}));
      debugLog(`Deleted policy ${policyArn}`);
    }
  }));

  const accessKeys = await iamClient.send(new ListAccessKeysCommand({
    UserName: userName
  }));

  const keysToDelete = (accessKeys.AccessKeyMetadata || [])
    .filter(key => key.AccessKeyId)
    .map(key => key.AccessKeyId as string);

  await Promise.all(keysToDelete.map(async accessKeyId => {
    await iamClient.send(new DeleteAccessKeyCommand({
      UserName: userName,
      AccessKeyId: accessKeyId
    }));
    debugLog(`Deleted access key ${accessKeyId} for user ${userName}`);
  }));

  await iamClient.send(new DeleteUserCommand({UserName: userName}));
  debugLog(`Deleted IAM user ${userName}`);
}

export async function destroyEnvironment(config: DestroyConfig, onProgress?: ProgressCallback): Promise<DestroyResult> {
  const steps: { step: string; success: boolean; message: string }[] = [];

  const report = (step: string, success: boolean, message: string) => {
    debugLog(`[${success ? "SUCCESS" : "FAILED"}] ${step}: ${message}`);
    steps.push({step, success, message});
    if (onProgress) {
      onProgress({step: "destroy", status: success ? "completed" : "failed", message: `${step}: ${message}`});
    }
  };

  debugLog(`Destroying environment: ${config.name}`);

  if (!config.skipFly) {
    try {
      setFlyApiToken(config.apiKey);
      runCommand(`flyctl apps destroy ${config.appName} --yes`, true, true);
      report("fly.io app", true, `Deleted ${config.appName}`);
    } catch (error) {
      const notFound = error.message?.includes("Could not find App") || error.stderr?.includes("Could not find App");
      if (notFound) {
        report("fly.io app", true, `App ${config.appName} not found (already deleted)`);
      } else {
        report("fly.io app", false, `Failed to delete: ${error.message}`);
      }
    }
  }

  if (!config.skipS3) {
    const adminConfig = adminConfigFromEnvironment();
    if (!adminConfig) {
      report("S3 bucket", false, "AWS admin credentials not configured");
      report("IAM user", false, "AWS admin credentials not configured");
    } else {
      const s3Client = new S3Client({
        region: adminConfig.region,
        credentials: {
          accessKeyId: adminConfig.accessKeyId,
          secretAccessKey: adminConfig.secretAccessKey
        }
      });

      const iamClient = new IAMClient({
        region: adminConfig.region,
        credentials: {
          accessKeyId: adminConfig.accessKeyId,
          secretAccessKey: adminConfig.secretAccessKey
        }
      });

      const bucketName = `ngx-ramblers-${config.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
      try {
        await deleteS3BucketContents(s3Client, bucketName);
        await s3Client.send(new DeleteBucketCommand({Bucket: bucketName}));
        report("S3 bucket", true, `Deleted ${bucketName}`);
      } catch (error) {
        const notFound = error.name === "NoSuchBucket" || error.$metadata?.httpStatusCode === 404;
        if (notFound) {
          report("S3 bucket", true, `Bucket ${bucketName} not found (already deleted)`);
        } else {
          report("S3 bucket", false, `Failed to delete: ${error.message}`);
        }
      }

      const userName = `ngx-ramblers-${config.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-user`;
      try {
        await deleteIamUserWithPolicies(iamClient, userName);
        report("IAM user", true, `Deleted ${userName}`);
      } catch (error) {
        const notFound = error.name === "NoSuchEntity" || error.name === "NoSuchEntityException";
        if (notFound) {
          report("IAM user", true, `User ${userName} not found (already deleted)`);
        } else {
          report("IAM user", false, `Failed to delete: ${error.message}`);
        }
      }

      const policyName = `ngx-ramblers-${config.name.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-policy`;
      try {
        const {GetCallerIdentityCommand, STSClient} = await import("@aws-sdk/client-sts");
        const stsClient = new STSClient({
          region: adminConfig.region,
          credentials: {
            accessKeyId: adminConfig.accessKeyId,
            secretAccessKey: adminConfig.secretAccessKey
          }
        });
        const identity = await stsClient.send(new GetCallerIdentityCommand({}));
        const policyArn = `arn:aws:iam::${identity.Account}:policy/${policyName}`;

        await iamClient.send(new DeletePolicyCommand({PolicyArn: policyArn}));
        report("IAM policy", true, `Deleted ${policyName}`);
      } catch (error) {
        const notFound = error.name === "NoSuchEntity" || error.name === "NoSuchEntityException";
        if (notFound) {
          report("IAM policy", true, `Policy ${policyName} not found (already deleted)`);
        } else {
          report("IAM policy", false, `Failed to delete: ${error.message}`);
        }
      }
    }
  }

  if (!config.skipDatabase && config.mongoUri && config.database) {
    try {
      const client = await MongoClient.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000
      });
      const db = client.db(config.database);
      const collections = await db.listCollections().toArray();

      await collections.reduce(async (promise, collection) => {
        await promise;
        await db.dropCollection(collection.name);
        debugLog(`Dropped collection: ${collection.name}`);
      }, Promise.resolve());

      await client.close();
      report("Database", true, `Cleared ${collections.length} collections from ${config.database}`);
    } catch (error) {
      report("Database", false, `Failed to clear: ${error.message}`);
    }
  }

  if (!config.skipConfigs) {
    try {
      removeEnvironment(config.name);
      report("configs.json", true, "Removed environment entry");
    } catch (error) {
      report("configs.json", false, `Failed to remove: ${error.message}`);
    }

    try {
      const secretsFilePath = secretsPath(config.appName);
      if (fs.existsSync(secretsFilePath)) {
        fs.unlinkSync(secretsFilePath);
        report("Secrets file", true, "Deleted");
      } else {
        report("Secrets file", true, "Not found (already deleted)");
      }
    } catch (error) {
      report("Secrets file", false, `Failed to delete: ${error.message}`);
    }
  }

  const allSucceeded = steps.every(s => s.success);
  return {success: allSucceeded, steps};
}

export function createDestroyCommand(): Command {
  const destroy = new Command("destroy")
    .alias("des")
    .argument("<name>", "Environment name")
    .description("Destroy an environment completely")
    .option("--skip-fly", "Skip fly.io app deletion")
    .option("--skip-s3", "Skip S3 bucket and IAM user deletion")
    .option("--skip-database", "Skip database collection clearing")
    .option("--skip-configs", "Skip configs.json and secrets file deletion")
    .option("--yes", "Skip confirmation prompt")
    .action(async (name, options) => {
      try {
        const envConfig = await findEnvironmentFromDatabase(name);
        if (!envConfig) {
          log(`Environment not found: ${name}`);
          process.exit(1);
        }

        const secrets = loadSecretsForEnvironment(envConfig.appName);
        const mongoUri = secrets.secrets.MONGODB_URI;
        let database: string | undefined;

        if (mongoUri) {
          const match = mongoUri.match(/\/([^/?]+)(\?|$)/);
          database = match ? match[1] : undefined;
        }

        if (!options.yes) {
          log(`\n⚠️  WARNING: This will permanently destroy the environment "${name}"`);
          log(`   - fly.io app: ${envConfig.appName}`);
          log(`   - S3 bucket: ngx-ramblers-${name.toLowerCase()}`);
          log(`   - IAM user: ngx-ramblers-${name.toLowerCase()}-user`);
          if (database) {
            log(`   - Database collections in: ${database}`);
          }
          log(`   - configs.json entry`);
          log(`   - Secrets file\n`);

          const readline = await import("readline");
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

          const answer = await new Promise<string>(resolve => {
            rl.question(`Type "${name}" to confirm destruction: `, resolve);
          });
          rl.close();

          if (answer !== name) {
            log("Destroy cancelled.");
            process.exit(0);
          }
        }

        log(`\nDestroying environment: ${name}\n`);

        const result = await destroyEnvironment({
          name: name,
          appName: envConfig.appName,
          apiKey: envConfig.apiKey,
          mongoUri,
          database,
          skipFly: options.skipFly,
          skipS3: options.skipS3,
          skipDatabase: options.skipDatabase,
          skipConfigs: options.skipConfigs
        }, progress => {
          log(`[${progress.status}] ${progress.message}`);
        });

        log("\nResults:");
        result.steps.forEach(step => {
          log(`  ${step.success ? "✓" : "✗"} ${step.step}: ${step.message}`);
        });

        if (result.success) {
          log("\n✓ Environment destroyed successfully");
        } else {
          log("\n⚠ Environment partially destroyed - some steps failed");
          process.exit(1);
        }
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  return destroy;
}
