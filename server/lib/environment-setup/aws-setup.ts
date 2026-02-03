import {
  CopyObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutPublicAccessBlockCommand,
  S3Client
} from "@aws-sdk/client-s3";
import {
  AttachUserPolicyCommand,
  CreateAccessKeyCommand,
  CreatePolicyCommand,
  CreateUserCommand,
  DeleteAccessKeyCommand,
  GetPolicyCommand,
  GetUserCommand,
  IAMClient,
  ListAccessKeysCommand,
  ListAttachedUserPoliciesCommand
} from "@aws-sdk/client-iam";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../env-config/environment-model";
import { AssetToCopy, AwsAdminConfig, AwsCustomerCredentials, CopyAssetsResult, ValidationResult } from "./types";
import { AWS_DEFAULTS } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";

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

async function configureBucket(s3Client: S3Client, bucketName: string): Promise<void> {
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

export async function createS3Bucket(
  s3Client: S3Client,
  bucketName: string,
  region: string
): Promise<void> {
  debugLog("Creating S3 bucket:", bucketName, "in region:", region);

  const exists = await bucketExists(s3Client, bucketName);
  if (exists) {
    debugLog("Bucket already exists:", bucketName, "- ensuring configuration is correct");
    await configureBucket(s3Client, bucketName);
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

  await configureBucket(s3Client, bucketName);
}

async function getAwsAccountId(adminConfig: AwsAdminConfig): Promise<string> {
  const stsClient = new STSClient({
    region: adminConfig.region,
    credentials: {
      accessKeyId: adminConfig.accessKeyId,
      secretAccessKey: adminConfig.secretAccessKey
    }
  });
  const response = await stsClient.send(new GetCallerIdentityCommand({}));
  return response.Account || "";
}

async function policyExists(iamClient: IAMClient, policyArn: string): Promise<boolean> {
  try {
    await iamClient.send(new GetPolicyCommand({ PolicyArn: policyArn }));
    return true;
  } catch (error) {
    if (error.name === "NoSuchEntity" || error.name === "NoSuchEntityException") {
      return false;
    }
    throw error;
  }
}

async function isPolicyAttachedToUser(iamClient: IAMClient, userName: string, policyArn: string): Promise<boolean> {
  try {
    const response = await iamClient.send(new ListAttachedUserPoliciesCommand({ UserName: userName }));
    return (response.AttachedPolicies || []).some(p => p.PolicyArn === policyArn);
  } catch (error) {
    debugLog("Error checking attached policies:", error.message);
    return false;
  }
}

function generatePolicyArn(accountId: string, policyName: string): string {
  if (accountId) {
    return `arn:aws:iam::${accountId}:policy/${policyName}`;
  }
  return "";
}

async function deleteExistingAccessKeys(iamClient: IAMClient, userName: string): Promise<void> {
  const existingKeysResponse = await iamClient.send(new ListAccessKeysCommand({ UserName: userName }));
  const existingKeys = existingKeysResponse.AccessKeyMetadata || [];
  debugLog(`User ${userName} has ${existingKeys.length} existing access keys`);

  for (const key of existingKeys) {
    if (key.AccessKeyId) {
      await iamClient.send(new DeleteAccessKeyCommand({
        UserName: userName,
        AccessKeyId: key.AccessKeyId
      }));
      debugLog(`Deleted access key: ${key.AccessKeyId}`);
    }
  }
}

async function createAccessKeyForUser(iamClient: IAMClient, userName: string): Promise<{ AccessKeyId: string; SecretAccessKey: string }> {
  const accessKeyResponse = await iamClient.send(new CreateAccessKeyCommand({ UserName: userName }));
  const accessKey = accessKeyResponse.AccessKey;
  if (!accessKey?.AccessKeyId || !accessKey?.SecretAccessKey) {
    throw new Error("Failed to create access key - no credentials returned");
  }
  debugLog("Created access key for user:", userName);
  return { AccessKeyId: accessKey.AccessKeyId, SecretAccessKey: accessKey.SecretAccessKey };
}

export async function createIamUserWithBucketPolicy(
  iamClient: IAMClient,
  adminConfig: AwsAdminConfig,
  userName: string,
  bucketName: string,
  policyName: string
): Promise<{ accessKeyId: string; secretAccessKey: string; policyArn: string }> {
  debugLog("Setting up IAM user:", userName, "with policy for bucket:", bucketName);

  const accountId = await getAwsAccountId(adminConfig);
  debugLog("AWS Account ID:", accountId);

  const userAlreadyExists = await userExists(iamClient, userName);

  if (userAlreadyExists) {
    debugLog("IAM user already exists, reusing:", userName);
  } else {
    await iamClient.send(new CreateUserCommand({ UserName: userName }));
    debugLog("Created IAM user:", userName);
  }

  const policyDocument = createBucketPolicy(bucketName);
  let policyArn: string;

  const expectedPolicyArn = generatePolicyArn(accountId, policyName);
  const policyAlreadyExists = expectedPolicyArn && await policyExists(iamClient, expectedPolicyArn);

  if (policyAlreadyExists) {
    debugLog("Policy already exists, reusing:", expectedPolicyArn);
    policyArn = expectedPolicyArn;
  } else {
    try {
      const createPolicyResponse = await iamClient.send(new CreatePolicyCommand({
        PolicyName: policyName,
        PolicyDocument: policyDocument,
        Description: `Policy for ngx-ramblers bucket ${bucketName}`
      }));
      policyArn = createPolicyResponse.Policy?.Arn;
      if (!policyArn) {
        throw new Error("Failed to create policy - no ARN returned");
      }
      debugLog("Created policy:", policyArn);
    } catch (error) {
      if (error.name === "EntityAlreadyExists") {
        debugLog("Policy already exists (caught during create), using constructed ARN");
        policyArn = expectedPolicyArn;
        if (!policyArn) {
          throw new Error(`Policy ${policyName} exists but couldn't determine ARN`);
        }
      } else {
        throw error;
      }
    }
  }

  const isAttached = await isPolicyAttachedToUser(iamClient, userName, policyArn);
  if (!isAttached) {
    await iamClient.send(new AttachUserPolicyCommand({
      UserName: userName,
      PolicyArn: policyArn
    }));
    debugLog("Attached policy to user");
  } else {
    debugLog("Policy already attached to user");
  }

  await deleteExistingAccessKeys(iamClient, userName);

  const accessKey = await createAccessKeyForUser(iamClient, userName);

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
    adminConfig,
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
  const region = process.env[Environment.SETUP_AWS_REGION] || process.env[Environment.AWS_REGION] || AWS_DEFAULTS.REGION;

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
  sourceBucket: "ngx-ramblers-demo-staging"
};

export async function copyStandardAssets(
  adminConfig: AwsAdminConfig,
  targetBucket: string
): Promise<CopyAssetsResult> {
  const s3Client = createS3Client(adminConfig);
  const result: CopyAssetsResult = {
    icons: [],
    logos: [],
    backgrounds: [],
    failures: []
  };

  const config = await systemConfig();
  if (!config) {
    debugLog("No system config found - cannot determine which assets to copy");
    result.failures.push({file: "system-config", error: "No system config found"});
    return result;
  }

  debugLog("System config icons sample:", config.icons?.images?.[0]);
  debugLog("System config logos sample:", config.logos?.images?.[0]);
  debugLog("System config backgrounds sample:", config.backgrounds?.images?.[0]);

  const assetsToCopy: AssetToCopy[] = [];

  if (config.icons?.images) {
    for (const img of config.icons.images) {
      if (img.awsFileName) {
        assetsToCopy.push({
          sourceKey: img.awsFileName,
          folder: RootFolder.icons,
          image: {
            width: img.width || 150,
            originalFileName: img.originalFileName || img.awsFileName.split("/").pop(),
            awsFileName: img.awsFileName,
            padding: img.padding
          }
        });
      }
    }
  }

  if (config.logos?.images) {
    for (const img of config.logos.images) {
      if (img.awsFileName) {
        assetsToCopy.push({
          sourceKey: img.awsFileName,
          folder: RootFolder.logos,
          image: {
            width: img.width || 300,
            originalFileName: img.originalFileName || img.awsFileName.split("/").pop(),
            awsFileName: img.awsFileName,
            padding: img.padding
          }
        });
      }
    }
  }

  if (config.backgrounds?.images) {
    for (const img of config.backgrounds.images) {
      if (img.awsFileName) {
        assetsToCopy.push({
          sourceKey: img.awsFileName,
          folder: RootFolder.backgrounds,
          image: {
            width: img.width || 1920,
            originalFileName: img.originalFileName || img.awsFileName.split("/").pop(),
            awsFileName: img.awsFileName,
            padding: img.padding
          }
        });
      }
    }
  }

  debugLog(`Found ${assetsToCopy.length} assets to copy from system config`);

  for (const asset of assetsToCopy) {
    try {
      await s3Client.send(new CopyObjectCommand({
        Bucket: targetBucket,
        CopySource: `${STANDARD_ASSETS.sourceBucket}/${asset.sourceKey}`,
        Key: asset.sourceKey
      }));

      if (asset.folder === RootFolder.icons) result.icons.push(asset.image);
      else if (asset.folder === RootFolder.logos) result.logos.push(asset.image);
      else if (asset.folder === RootFolder.backgrounds) result.backgrounds.push(asset.image);

      debugLog(`Copied ${asset.sourceKey} to ${targetBucket}/${asset.sourceKey}`);
    } catch (copyError) {
      const errorMessage = copyError.message || String(copyError);
      debugLog(`Failed to copy ${asset.sourceKey}: ${errorMessage}`);
      result.failures.push({file: asset.sourceKey, error: errorMessage});
    }
  }

  return result;
}
