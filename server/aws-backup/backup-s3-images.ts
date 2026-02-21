import { CopyObjectCommand, CreateBucketCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import fs from "fs/promises";
import path from "path";
import winston from "winston";
import { BucketConfig } from "../../projects/ngx-ramblers/src/app/models/aws-object.model";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({filename: "backup-log.json"}),
  ],
});

const currentDir = path.resolve(__dirname);
const backupConfigFile = path.resolve(currentDir, "../../non-vcs/aws/buckets-config.json");
const backupBucketName = "ngx-ramblers-backups";
const dryRun = process.env.DRY_RUN === "true";


async function loadBucketConfig(): Promise<BucketConfig[]> {
  try {
    const data = await fs.readFile(backupConfigFile, "utf-8");
    const parsedData = JSON.parse(data);
    return parsedData.buckets;
  } catch (error) {
    logger.error("Error loading bucket config:", error);
    throw error;
  }
}

async function validateAWSCredentials() {
  try {
    const sts = new STSClient({});
    await sts.send(new GetCallerIdentityCommand({}));
    logger.info("AWS credentials validated successfully.");
  } catch (err) {
    logger.error("Invalid AWS credentials:", err);
    throw err;
  }
}

async function doesBucketExist(bucketName: string, region: string): Promise<boolean> {
  const s3 = new S3Client({region});
  try {
    await s3.send(new ListObjectsV2Command({Bucket: bucketName}));
    return true;
  } catch (err) {
    if (err.name === "NoSuchBucket") {
      return false;
    }
    throw err;
  }
}

async function createBackupBucket(region: string) {
  const s3 = new S3Client({region});
  try {
    await s3.send(new CreateBucketCommand({Bucket: backupBucketName}));
    logger.info(`Bucket '${backupBucketName}' created successfully.`);
  } catch (err) {
    logger.error(`Failed to create bucket '${backupBucketName}':`, err);
    throw err;
  }
}

async function copyFilesToBackup(sourceBucketName: string, sourceRegion: string) {
  logger.info(`Processing bucket: ${sourceBucketName} in region: ${sourceRegion}`);
  const s3 = new S3Client({region: sourceRegion});

  try {
    const processPage = async (token: string | undefined): Promise<void> => {
      const listResponse = await s3.send(
        new ListObjectsV2Command({
          Bucket: sourceBucketName,
          ContinuationToken: token,
        })
      );

      if (listResponse.Contents) {
        for (const obj of listResponse.Contents) {
          if (obj.Key) {
            const destinationKey = `${sourceBucketName}/${obj.Key}`;
            logger.info(`Found file: ${obj.Key}`);
            if (!dryRun) {
              try {
                await s3.send(
                  new CopyObjectCommand({
                    Bucket: backupBucketName,
                    CopySource: `/${sourceBucketName}/${obj.Key}`,
                    Key: destinationKey,
                  })
                );
                logger.info(`Successfully copied ${obj.Key} to ${backupBucketName}/${destinationKey}`);
              } catch (err) {
                logger.error(`Failed to copy ${obj.Key}:`, err);
              }
            }
          }
        }
      }
      if (listResponse.NextContinuationToken) return processPage(listResponse.NextContinuationToken);
    };
    await processPage(undefined);
  } catch (err) {
    logger.error(`Failed to process bucket ${sourceBucketName}:`, err);
  }
}

async function backupAllBuckets() {
  try {
    const bucketConfigs = await loadBucketConfig();
    logger.info(`Starting backup to bucket '${backupBucketName}'...`);
    bucketConfigs
      .filter(bucketConfig => bucketConfig.include && bucketConfig.name !== backupBucketName)
      .forEach(async bucketConfig => {
        const exists = await doesBucketExist(backupBucketName, bucketConfig.region);
        if (!exists) {
          await createBackupBucket(bucketConfig.region);
        }
        await copyFilesToBackup(bucketConfig.name, bucketConfig.region);
      });
    logger.info("Backup completed.");
  } catch (err) {
    logger.error("Error during backup:", err);
  }
}

process.on("SIGINT", () => {
  logger.warn("Backup interrupted. Exiting...");
  process.exit();
});

(async () => {
  try {
    await validateAWSCredentials();
    await backupAllBuckets();
  } catch (err) {
    logger.error("Script failed:", err);
    process.exit(1);
  }
})();
