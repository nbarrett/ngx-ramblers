import {
  CopyObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutPublicAccessBlockCommand,
  S3Client
} from "@aws-sdk/client-s3";
import {
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  CreatePolicyCommand,
  CreateUserCommand,
  GetUserCommand,
  IAMClient
} from "@aws-sdk/client-iam";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../env-config/environment-model";
import { AwsAdminConfig, AwsCustomerCredentials, ValidationResult } from "./types";

const debugLog = debug(envConfig.logNamespace("environment-setup:aws-setup"));
debugLog.enabled = true;

export interface AwsSetupResult {
  bucket: string;
  iamUserName: string;
  accessKeyId: string;
  secretAccessKey: string;
  policyArn: string;
}

function createS3Client(adminConfig: AwsAdminConfig): S3Client {
  return new S3Client({
    region: adminConfig.region,
    credentials: {
      accessKeyId: adminConfig.accessKeyId,
      secretAccessKey: adminConfig.secretAccessKey
    }
  });
}

function createIamClient(adminConfig: AwsAdminConfig): IAMClient {
  return new IAMClient({
    region: adminConfig.region,
    credentials: {
      accessKeyId: adminConfig.accessKeyId,
      secretAccessKey: adminConfig.secretAccessKey
    }
  });
}

function generateBucketName(environmentName: string): string {
  return `ngx-ramblers-${environmentName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

function generateIamUserName(environmentName: string): string {
  return `ngx-ramblers-${environmentName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-user`;
}

function generatePolicyName(environmentName: string): string {
  return `ngx-ramblers-${environmentName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-policy`;
}

function createBucketPolicy(bucketName: string): string {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket",
          "s3:PutObjectAcl"
        ],
        Resource: [
          `arn:aws:s3:::${bucketName}`,
          `arn:aws:s3:::${bucketName}/*`
        ]
      }
    ]
  });
}

async function bucketExists(s3Client: S3Client, bucketName: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    return true;
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

async function userExists(iamClient: IAMClient, userName: string): Promise<boolean> {
  try {
    await iamClient.send(new GetUserCommand({ UserName: userName }));
    return true;
  } catch (error) {
    if (error.name === "NoSuchEntity" || error.name === "NoSuchEntityException") {
      return false;
    }
    throw error;
  }
}

export async function createS3Bucket(
  s3Client: S3Client,
  bucketName: string,
  region: string
): Promise<void> {
  debugLog("Creating S3 bucket:", bucketName, "in region:", region);

  const exists = await bucketExists(s3Client, bucketName);
  if (exists) {
    debugLog("Bucket already exists:", bucketName);
    return;
  }

  const createBucketParams: { Bucket: string; CreateBucketConfiguration?: { LocationConstraint: string } } = {
    Bucket: bucketName
  };

  if (region !== "us-east-1") {
    createBucketParams.CreateBucketConfiguration = {
      LocationConstraint: region as any
    };
  }

  await s3Client.send(new CreateBucketCommand(createBucketParams));
  debugLog("Created bucket:", bucketName);

  await s3Client.send(new PutPublicAccessBlockCommand({
    Bucket: bucketName,
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: false,
      IgnorePublicAcls: false,
      BlockPublicPolicy: false,
      RestrictPublicBuckets: false
    }
  }));
  debugLog("Configured public access block for bucket:", bucketName);

  await s3Client.send(new PutBucketCorsCommand({
    Bucket: bucketName,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedHeaders: ["*"],
          AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
          AllowedOrigins: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3000
        }
      ]
    }
  }));
  debugLog("Configured CORS for bucket:", bucketName);
}

export async function createIamUserWithBucketPolicy(
  iamClient: IAMClient,
  userName: string,
  bucketName: string,
  policyName: string
): Promise<{ accessKeyId: string; secretAccessKey: string; policyArn: string }> {
  debugLog("Creating IAM user:", userName, "with policy for bucket:", bucketName);

  const exists = await userExists(iamClient, userName);
  if (exists) {
    debugLog("IAM user already exists:", userName);
    throw new Error(`IAM user ${userName} already exists. Please use a different environment name or delete the existing user.`);
  }

  await iamClient.send(new CreateUserCommand({ UserName: userName }));
  debugLog("Created IAM user:", userName);

  const policyDocument = createBucketPolicy(bucketName);
  const createPolicyResponse = await iamClient.send(new CreatePolicyCommand({
    PolicyName: policyName,
    PolicyDocument: policyDocument,
    Description: `Policy for ngx-ramblers bucket ${bucketName}`
  }));

  const policyArn = createPolicyResponse.Policy?.Arn;
  if (!policyArn) {
    throw new Error("Failed to create policy - no ARN returned");
  }
  debugLog("Created policy:", policyArn);

  await iamClient.send(new AttachUserPolicyCommand({
    UserName: userName,
    PolicyArn: policyArn
  }));
  debugLog("Attached policy to user");

  const accessKeyResponse = await iamClient.send(new CreateAccessKeyCommand({
    UserName: userName
  }));

  const accessKey = accessKeyResponse.AccessKey;
  if (!accessKey?.AccessKeyId || !accessKey?.SecretAccessKey) {
    throw new Error("Failed to create access key - no credentials returned");
  }
  debugLog("Created access key for user");

  return {
    accessKeyId: accessKey.AccessKeyId,
    secretAccessKey: accessKey.SecretAccessKey,
    policyArn
  };
}

export async function setupAwsForCustomer(
  adminConfig: AwsAdminConfig,
  environmentName: string,
  region?: string
): Promise<AwsSetupResult> {
  const effectiveRegion = region || adminConfig.region;
  const bucketName = generateBucketName(environmentName);
  const userName = generateIamUserName(environmentName);
  const policyName = generatePolicyName(environmentName);

  debugLog("Setting up AWS for customer:", environmentName);
  debugLog("Bucket:", bucketName);
  debugLog("IAM User:", userName);
  debugLog("Region:", effectiveRegion);

  const s3Client = createS3Client(adminConfig);
  const iamClient = createIamClient(adminConfig);

  await createS3Bucket(s3Client, bucketName, effectiveRegion);

  const { accessKeyId, secretAccessKey, policyArn } = await createIamUserWithBucketPolicy(
    iamClient,
    userName,
    bucketName,
    policyName
  );

  return {
    bucket: bucketName,
    iamUserName: userName,
    accessKeyId,
    secretAccessKey,
    policyArn
  };
}

export async function validateAwsAdminCredentials(adminConfig: AwsAdminConfig): Promise<ValidationResult> {
  if (!adminConfig.accessKeyId || !adminConfig.secretAccessKey) {
    return { valid: false, message: "AWS admin credentials are required" };
  }

  try {
    const iamClient = createIamClient(adminConfig);
    await iamClient.send(new GetUserCommand({}));
    return { valid: true, message: "AWS admin credentials are valid" };
  } catch (error) {
    if (error.name === "InvalidClientTokenId" || error.name === "SignatureDoesNotMatch") {
      return { valid: false, message: "Invalid AWS credentials" };
    }
    return { valid: true, message: "AWS credentials appear valid" };
  }
}

export function adminConfigFromEnvironment(): AwsAdminConfig | null {
  const accessKeyId = process.env[Environment.SETUP_AWS_ACCESS_KEY_ID] || process.env[Environment.AWS_ACCESS_KEY_ID];
  const secretAccessKey = process.env[Environment.SETUP_AWS_SECRET_ACCESS_KEY] || process.env[Environment.AWS_SECRET_ACCESS_KEY];
  const region = process.env[Environment.SETUP_AWS_REGION] || process.env[Environment.AWS_REGION] || "eu-west-1";

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return { accessKeyId, secretAccessKey, region };
}

export function generateAwsCredentialsResult(
  environmentName: string,
  region: string,
  setupResult: AwsSetupResult
): AwsCustomerCredentials {
  return {
    accessKeyId: setupResult.accessKeyId,
    secretAccessKey: setupResult.secretAccessKey,
    bucket: setupResult.bucket,
    region,
    iamUserName: setupResult.iamUserName,
    policyArn: setupResult.policyArn
  };
}

export const STANDARD_ASSETS = {
  sourceBucket: "ngx-ramblers-demo-staging",
  folders: ["icons", "logos", "backgrounds"],
  defaultIcon: "ramblers-icon.png",
  defaultLogo: "ramblers-logo.png",
  defaultBackground: "ramblers-background.jpg"
};

export async function copyStandardAssets(
  adminConfig: AwsAdminConfig,
  targetBucket: string
): Promise<{ icons: string[]; logos: string[]; backgrounds: string[] }> {
  const s3Client = createS3Client(adminConfig);
  const copiedAssets = { icons: [] as string[], logos: [] as string[], backgrounds: [] as string[] };

  for (const folder of STANDARD_ASSETS.folders) {
    try {
      const listResponse = await s3Client.send(new ListObjectsV2Command({
        Bucket: STANDARD_ASSETS.sourceBucket,
        Prefix: `${folder}/`
      }));

      const objects = listResponse.Contents || [];
      for (const obj of objects) {
        if (!obj.Key || obj.Key.endsWith("/")) continue;

        const fileName = obj.Key.split("/").pop();
        const targetKey = obj.Key;

        try {
          await s3Client.send(new CopyObjectCommand({
            Bucket: targetBucket,
            CopySource: `${STANDARD_ASSETS.sourceBucket}/${obj.Key}`,
            Key: targetKey,
            ACL: "public-read"
          }));

          if (folder === "icons") copiedAssets.icons.push(fileName);
          else if (folder === "logos") copiedAssets.logos.push(fileName);
          else if (folder === "backgrounds") copiedAssets.backgrounds.push(fileName);

          debugLog(`Copied ${obj.Key} to ${targetBucket}/${targetKey}`);
        } catch (copyError) {
          debugLog(`Failed to copy ${obj.Key}: ${copyError.message}`);
        }
      }
    } catch (listError) {
      debugLog(`Failed to list objects in ${folder}: ${listError.message}`);
    }
  }

  return copiedAssets;
}
