import { Command } from "commander";
import { BucketResult, CopyAssetsCliResult, IamUserResult, ProgressCallback } from "../types";
import { log } from "../cli-logger";
import { AWS_DEFAULTS } from "../../../../projects/ngx-ramblers/src/app/models/environment-config.model";

export async function createBucketAndUser(
  environmentName: string,
  region?: string,
  onProgress?: ProgressCallback
): Promise<{ bucket: BucketResult; user: IamUserResult }> {
  const { setupAwsForCustomer, adminConfigFromEnvironment } = await import("../../environment-setup/aws-setup");

  const adminConfig = adminConfigFromEnvironment();
  if (!adminConfig) {
    throw new Error("AWS admin credentials not configured");
  }

  if (onProgress) {
    onProgress({ step: "create-aws-resources", status: "running", message: "Creating S3 bucket and IAM user" });
  }

  const effectiveRegion = region || adminConfig.region;
  const result = await setupAwsForCustomer(adminConfig, environmentName, effectiveRegion);

  if (onProgress) {
    onProgress({ step: "create-aws-resources", status: "completed", message: `Created bucket: ${result.bucket}` });
  }

  return {
    bucket: {
      success: true,
      bucketName: result.bucket,
      region: effectiveRegion
    },
    user: {
      success: true,
      userName: result.iamUserName,
      accessKeyId: result.accessKeyId,
      secretAccessKey: result.secretAccessKey,
      policyArn: result.policyArn
    }
  };
}

export async function copyAssets(
  targetBucket: string,
  onProgress?: ProgressCallback
): Promise<CopyAssetsCliResult> {
  const { copyStandardAssets, adminConfigFromEnvironment } = await import("../../environment-setup/aws-setup");

  const adminConfig = adminConfigFromEnvironment();
  if (!adminConfig) {
    throw new Error("AWS admin credentials not configured");
  }

  if (onProgress) {
    onProgress({ step: "copy-assets", status: "running", message: "Copying standard assets" });
  }

  const result = await copyStandardAssets(adminConfig, targetBucket);

  if (onProgress) {
    const status = result.failures.length > 0 ? "failed" : "completed";
    onProgress({
      step: "copy-assets",
      status,
      message: `Copied ${result.icons.length} icons, ${result.logos.length} logos, ${result.backgrounds.length} backgrounds${result.failures.length > 0 ? `, ${result.failures.length} failed` : ""}`
    });
  }

  return {
    icons: result.icons.map(img => img.originalFileName),
    logos: result.logos.map(img => img.originalFileName),
    backgrounds: result.backgrounds.map(img => img.originalFileName),
    failures: result.failures
  };
}

export function createAwsCommand(): Command {
  const aws = new Command("aws")
    .alias("a")
    .description("AWS resource management commands");

  aws
    .command("create-resources [name]")
    .description("Create S3 bucket and IAM user for an environment")
    .option("--region <region>", `AWS region (defaults to env or ${AWS_DEFAULTS.REGION})`)
    .action(async (name, options) => {
      try {
        if (!name) {
          log("Environment name is required");
          process.exit(1);
        }
        log("Creating AWS resources for: %s", name);

        const result = await createBucketAndUser(name, options.region, progress => {
          log("[%s] %s: %s", progress.status, progress.step, progress.message);
        });

        log("\n✓ AWS resources created successfully");
        log("\nBucket: %s", result.bucket.bucketName);
        log("Region: %s", result.bucket.region);
        log("IAM User: %s", result.user.userName);
        log("Access Key ID: %s", result.user.accessKeyId);
        log("Secret Access Key: %s", result.user.secretAccessKey);
        log("Policy ARN: %s", result.user.policyArn);
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  aws
    .command("copy-assets [bucket]")
    .description("Copy standard assets to a bucket")
    .action(async bucket => {
      try {
        if (!bucket) {
          log("Bucket name is required");
          process.exit(1);
        }
        log("Copying assets to: %s", bucket);

        const result = await copyAssets(bucket, progress => {
          log("[%s] %s: %s", progress.status, progress.step, progress.message);
        });

        log("\n✓ Assets copied successfully");
        log("Icons: %d", result.icons.length);
        log("Logos: %d", result.logos.length);
        log("Backgrounds: %d", result.backgrounds.length);
      } catch (error) {
        log("Error: %s", error.message);
        process.exit(1);
      }
    });

  return aws;
}
