import debug from "debug";
import crypto from "crypto";
import { envConfig } from "../env-config/env-config";
import { SecretsConfig } from "../../deploy/types";
import {
  AwsCustomerCredentials,
  EnvironmentSetupRequest,
  EnvironmentSetupResult,
  SetupProgress,
  SetupSession,
  SetupStep,
  SetupStepStatus,
  ValidationResult
} from "./types";
import { groupDetails, listGroupsByAreaCode, validateRamblersApiKey } from "./ramblers-api-client";
import {
  adminConfigFromEnvironment,
  copyStandardAssets,
  generateAwsCredentialsResult,
  setupAwsForCustomer,
  validateAwsAdminCredentials
} from "./aws-setup";
import { initialiseDatabase, validateMongoConnection } from "./database-initialiser";
import { dateTimeNowAsValue } from "../shared/dates";
import { uid } from "rand-token";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  EnvironmentConfig,
  EnvironmentsConfig
} from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { seedBrevoTemplatesFromLocal } from "../brevo/templates/template-seeding";
import * as configController from "../mongo/controllers/config";
import { connect as ensureMongoConnection } from "../mongo/mongoose-client";
import { buildMongoUri as buildMongoUriFromConfig } from "../shared/mongodb-uri";
import { secretsPath, writeSecretsFile } from "../shared/secrets";
import { addOrUpdateEnvironment } from "../shared/configs-json";
import { normaliseMemory } from "../shared/spelling";
import { deployToFlyio as deployToFlyioCommand } from "../cli/commands/fly";

const debugLog = debug(envConfig.logNamespace("environment-setup:service"));
debugLog.enabled = true;

const activeSessions = new Map<string, SetupSession>();

export type ProgressCallback = (progress: SetupProgress) => void;

function generateSessionId(): string {
  return uid(32);
}

function generateAuthSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

function buildMongoUri(request: EnvironmentSetupRequest): string {
  const { mongodb } = request.serviceConfigs;
  return buildMongoUriFromConfig({
    cluster: mongodb.cluster,
    username: mongodb.username,
    password: mongodb.password,
    database: mongodb.database
  });
}

async function updateEnvironmentsConfig(
  request: EnvironmentSetupRequest,
  awsCredentials: AwsCustomerCredentials
): Promise<void> {
  const newEnvConfig: EnvironmentConfig = {
    environment: request.environmentBasics.environmentName,
    aws: {
      bucket: awsCredentials.bucket,
      region: awsCredentials.region,
      accessKeyId: awsCredentials.accessKeyId,
      secretAccessKey: awsCredentials.secretAccessKey
    },
    mongo: {
      cluster: request.serviceConfigs.mongodb.cluster,
      db: request.serviceConfigs.mongodb.database,
      username: request.serviceConfigs.mongodb.username,
      password: request.serviceConfigs.mongodb.password
    },
    flyio: {
      appName: request.environmentBasics.appName,
      memory: request.environmentBasics.memory,
      scaleCount: request.environmentBasics.scaleCount,
      organisation: request.environmentBasics.organisation || "personal"
    }
  };

  try {
    await ensureMongoConnection();
    const existingConfigDoc = await configController.queryKey(ConfigKey.ENVIRONMENTS);
    const existingConfig: EnvironmentsConfig = existingConfigDoc?.value || { environments: [] };

    const environments = existingConfig.environments || [];
    const existingEnvIndex = environments.findIndex(
      env => env.environment === request.environmentBasics.environmentName
    );

    if (existingEnvIndex >= 0) {
      environments[existingEnvIndex] = newEnvConfig;
    } else {
      environments.push(newEnvConfig);
    }

    const updatedConfig: EnvironmentsConfig = {
      ...existingConfig,
      environments
    };

    await configController.createOrUpdateKey(ConfigKey.ENVIRONMENTS, updatedConfig);
    debugLog("Updated environments config with new environment:", request.environmentBasics.environmentName);
  } catch (error) {
    debugLog("Error updating environments config:", error);
    throw new Error(`Failed to update environments configuration: ${error.message}`);
  }
}

function buildSecretsConfig(
  request: EnvironmentSetupRequest,
  awsCredentials: AwsCustomerCredentials,
  authSecret: string
): SecretsConfig {
  const mongoUri = buildMongoUri(request);

  const secrets: SecretsConfig = {
    AUTH_SECRET: authSecret,
    AWS_ACCESS_KEY_ID: awsCredentials.accessKeyId,
    AWS_SECRET_ACCESS_KEY: awsCredentials.secretAccessKey,
    AWS_BUCKET: awsCredentials.bucket,
    AWS_REGION: awsCredentials.region,
    CHROME_VERSION: "131",
    DEBUG: "ngx-ramblers:*",
    DEBUG_COLORS: "true",
    MONGODB_URI: mongoUri,
    NODE_ENV: "production",
    RAMBLERS_API_KEY: request.serviceConfigs.ramblers.apiKey,
    RAMBLERS_AREA_CODE: request.ramblersInfo.areaCode,
    RAMBLERS_AREA_NAME: request.ramblersInfo.areaName,
    RAMBLERS_GROUP_CODE: request.ramblersInfo.groupCode,
    RAMBLERS_GROUP_NAME: request.ramblersInfo.groupName || ""
  };

  if (request.serviceConfigs.googleMaps?.apiKey) {
    secrets.GOOGLE_MAPS_APIKEY = request.serviceConfigs.googleMaps.apiKey;
  }
  if (request.serviceConfigs.osMaps?.apiKey) {
    secrets.OS_MAPS_API_KEY = request.serviceConfigs.osMaps.apiKey;
  }
  if (request.serviceConfigs.brevo?.apiKey) {
    secrets.BREVO_API_KEY = request.serviceConfigs.brevo.apiKey;
  }
  if (request.serviceConfigs.recaptcha?.siteKey) {
    secrets.RECAPTCHA_SITE_KEY = request.serviceConfigs.recaptcha.siteKey;
  }
  if (request.serviceConfigs.recaptcha?.secretKey) {
    secrets.RECAPTCHA_SECRET_KEY = request.serviceConfigs.recaptcha.secretKey;
  }

  return secrets;
}

export async function validateSetupRequest(request: EnvironmentSetupRequest): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  const ramblersValidation = await validateRamblersApiKey(request.serviceConfigs.ramblers.apiKey);
  results.push({
    valid: ramblersValidation.valid,
    message: `Ramblers API Key: ${ramblersValidation.message}`
  });

  const mongoUri = buildMongoUri(request);
  const mongoValidation = await validateMongoConnection({
    uri: mongoUri,
    database: request.serviceConfigs.mongodb.database
  });
  results.push({
    valid: mongoValidation.valid,
    message: `MongoDB: ${mongoValidation.message}`
  });

  const awsAdminConfig = adminConfigFromEnvironment();
  if (awsAdminConfig) {
    const awsValidation = await validateAwsAdminCredentials(awsAdminConfig);
    results.push({
      valid: awsValidation.valid,
      message: `AWS Admin Credentials: ${awsValidation.message}`
    });
  } else {
    results.push({
      valid: false,
      message: "AWS Admin Credentials: AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or SETUP_AWS_ACCESS_KEY_ID/SETUP_AWS_SECRET_ACCESS_KEY environment variables not set"
    });
  }

  if (!request.serviceConfigs.brevo.apiKey) {
    results.push({
      valid: true,
      message: "Brevo API Key: Not provided (optional)"
    });
  } else {
    results.push({
      valid: true,
      message: "Brevo API Key: Provided"
    });
  }
  if (request.options.populateBrevoTemplates && !request.serviceConfigs.brevo.apiKey) {
    results.push({
      valid: false,
      message: "Populate Brevo Templates: requires Brevo API Key"
    });
  }

  return results;
}

export async function createEnvironment(
  request: EnvironmentSetupRequest,
  progressCallback?: ProgressCallback
): Promise<EnvironmentSetupResult> {
  const sessionId = generateSessionId();
  const session: SetupSession = {
    sessionId,
    request,
    progress: [],
    status: "running",
    createdAt: dateTimeNowAsValue()
  };

  activeSessions.set(sessionId, session);

  const reportProgress = (step: SetupStep, status: SetupStepStatus, message?: string) => {
    const progress: SetupProgress = {
      step,
      status,
      message,
      timestamp: dateTimeNowAsValue()
    };
    session.progress.push(progress);
    debugLog(`[${sessionId}] ${step}: ${status}${message ? ` - ${message}` : ""}`);
    if (progressCallback) {
      progressCallback(progress);
    }
  };

  try {
    reportProgress(SetupStep.VALIDATE_INPUTS, "running", "Validating configuration");
    const validationResults = await validateSetupRequest(request);
    const failedValidations = validationResults.filter(r => !r.valid);
    if (failedValidations.length > 0) {
      const errorMessage = failedValidations.map(r => r.message).join("; ");
      throw new Error(`Validation failed: ${errorMessage}`);
    }
    reportProgress(SetupStep.VALIDATE_INPUTS, "completed", "All validations passed");

    reportProgress(SetupStep.QUERY_RAMBLERS_API, "running", "Fetching group details from Ramblers API");
    const groupData = await groupDetails({
      groupCode: request.ramblersInfo.groupCode,
      apiKey: request.serviceConfigs.ramblers.apiKey
    });
    if (!groupData) {
      throw new Error(`Failed to fetch group details for ${request.ramblersInfo.groupCode}`);
    }
    request.ramblersInfo.groupData = groupData;
    request.ramblersInfo.groupName = groupData.name;
    request.ramblersInfo.groupUrl = groupData.url || groupData.external_url;

    const areaGroups = await listGroupsByAreaCode({
      areaCode: request.ramblersInfo.areaCode,
      apiKey: request.serviceConfigs.ramblers.apiKey
    });
    if (areaGroups.length > 0) {
      request.ramblersInfo.areaData = areaGroups[0];
    }
    reportProgress(SetupStep.QUERY_RAMBLERS_API, "completed", `Found group: ${groupData.name}`);

    let awsCredentials: AwsCustomerCredentials;
    let copiedAssets: { icons: string[]; logos: string[]; backgrounds: string[] } | undefined;
    const awsAdminConfig = adminConfigFromEnvironment();

    if (!request.options.skipFlyDeployment && awsAdminConfig) {
      reportProgress(SetupStep.CREATE_AWS_RESOURCES, "running", "Creating S3 bucket and IAM user");
      const awsSetupResult = await setupAwsForCustomer(
        awsAdminConfig,
        request.environmentBasics.environmentName,
        request.serviceConfigs.aws.region
      );
      awsCredentials = generateAwsCredentialsResult(
        request.environmentBasics.environmentName,
        request.serviceConfigs.aws.region,
        awsSetupResult
      );
      reportProgress(SetupStep.CREATE_AWS_RESOURCES, "completed", `Created bucket: ${awsCredentials.bucket}`);

      if (request.options.copyStandardAssets) {
        reportProgress(SetupStep.COPY_STANDARD_ASSETS, "running", "Copying standard assets to S3 bucket");
        const copyResult = await copyStandardAssets(awsAdminConfig, awsCredentials.bucket);
        copiedAssets = {
          icons: copyResult.icons.map(img => img.originalFileName),
          logos: copyResult.logos.map(img => img.originalFileName),
          backgrounds: copyResult.backgrounds.map(img => img.originalFileName)
        };
        const totalCopied = copyResult.icons.length + copyResult.logos.length + copyResult.backgrounds.length;
        if (copyResult.failures.length > 0) {
          const failureMsg = copyResult.failures.map(f => `${f.file}: ${f.error}`).join("; ");
          reportProgress(SetupStep.COPY_STANDARD_ASSETS, "failed", `Copied ${totalCopied} assets but ${copyResult.failures.length} failed: ${failureMsg}`);
        } else {
          reportProgress(SetupStep.COPY_STANDARD_ASSETS, "completed", `Copied ${totalCopied} assets (${copyResult.icons.length} icons, ${copyResult.logos.length} logos, ${copyResult.backgrounds.length} backgrounds)`);
        }
      } else {
        reportProgress(SetupStep.COPY_STANDARD_ASSETS, "completed", "Skipped copying standard assets");
      }
    } else {
      awsCredentials = {
        accessKeyId: "PLACEHOLDER",
        secretAccessKey: "PLACEHOLDER",
        bucket: request.serviceConfigs.aws.bucket,
        region: request.serviceConfigs.aws.region,
        iamUserName: "placeholder",
        policyArn: "placeholder"
      };
      reportProgress(SetupStep.CREATE_AWS_RESOURCES, "completed", "Skipped AWS resource creation (using placeholder)");
      reportProgress(SetupStep.COPY_STANDARD_ASSETS, "completed", "Skipped copying standard assets");
    }

    reportProgress(SetupStep.GENERATE_SECRETS, "running", "Generating authentication secret");
    const authSecret = generateAuthSecret();
    reportProgress(SetupStep.GENERATE_SECRETS, "completed", "Generated AUTH_SECRET");

    const secrets = buildSecretsConfig(request, awsCredentials, authSecret);

    if (!request.options.skipFlyDeployment) {
      reportProgress(SetupStep.WRITE_SECRETS_FILE, "running", "Writing secrets file");
      const filePath = secretsPath(request.environmentBasics.appName);
      writeSecretsFile(filePath, secrets);
      reportProgress(SetupStep.WRITE_SECRETS_FILE, "completed", `Wrote ${filePath}`);
    } else {
      reportProgress(SetupStep.WRITE_SECRETS_FILE, "completed", "Skipped writing secrets file");
    }

    reportProgress(SetupStep.INITIALISE_DATABASE, "running", "Initialising MongoDB database");
    await initialiseDatabase(request, dbProgress => {
      debugLog(`[${sessionId}] Database: ${dbProgress.step} - ${dbProgress.status}`);
    }, copiedAssets);
    reportProgress(SetupStep.INITIALISE_DATABASE, "completed", "Database initialised successfully");

    if (request.options.populateBrevoTemplates && request.serviceConfigs.brevo.apiKey) {
      reportProgress(SetupStep.POPULATE_BREVO_TEMPLATES, "running", "Populating Brevo templates");
      const seedResult = await seedBrevoTemplatesFromLocal();
      const message = `Created ${seedResult.createdCount}, updated ${seedResult.updatedCount}, skipped ${seedResult.skippedCount}`;
      reportProgress(SetupStep.POPULATE_BREVO_TEMPLATES, "completed", message);
    } else {
      reportProgress(SetupStep.POPULATE_BREVO_TEMPLATES, "completed", "Skipped Brevo template population");
    }

    if (!request.options.skipFlyDeployment) {
      reportProgress(SetupStep.UPDATE_CONFIGS_JSON, "running", "Updating configs.json");

      const envConfigToSave = {
        name: request.environmentBasics.environmentName,
        apiKey: "",
        appName: request.environmentBasics.appName,
        memory: normaliseMemory(request.environmentBasics.memory),
        scaleCount: request.environmentBasics.scaleCount,
        organisation: request.environmentBasics.organisation || "personal"
      };

      addOrUpdateEnvironment(envConfigToSave);
      reportProgress(SetupStep.UPDATE_CONFIGS_JSON, "completed", "Updated configs.json");

      reportProgress(SetupStep.DEPLOY_APP, "running", "Deploying to Fly.io");
      await deployToFlyioCommand(
        {
          name: request.environmentBasics.environmentName,
          appName: request.environmentBasics.appName,
          memory: normaliseMemory(request.environmentBasics.memory),
          scaleCount: request.environmentBasics.scaleCount,
          organisation: request.environmentBasics.organisation || "personal",
          secrets,
          apiKey: request.serviceConfigs.flyio?.personalAccessToken
        }, progress => debugLog(`[${sessionId}] Fly.io: ${progress.step} - ${progress.status}`)
      );
      reportProgress(SetupStep.DEPLOY_APP, "completed", `Deployed ${request.environmentBasics.appName} to Fly.io`);
    } else {
      reportProgress(SetupStep.UPDATE_CONFIGS_JSON, "completed", "Skipped updating configs.json");
      reportProgress(SetupStep.DEPLOY_APP, "completed", "Skipped Fly.io deployment");
    }

    reportProgress(SetupStep.UPDATE_ENVIRONMENTS_CONFIG, "running", "Adding environment to environments configuration");
    await updateEnvironmentsConfig(request, awsCredentials);
    reportProgress(SetupStep.UPDATE_ENVIRONMENTS_CONFIG, "completed", "Environments configuration updated");

    session.status = "completed";
    session.completedAt = dateTimeNowAsValue();

    const result: EnvironmentSetupResult = {
      environmentName: request.environmentBasics.environmentName,
      appName: request.environmentBasics.appName,
      appUrl: `https://${request.environmentBasics.appName}.fly.dev`,
      mongoDbUri: buildMongoUri(request),
      awsCredentials,
      adminUserCreated: true,
      configsJsonUpdated: !request.options.skipFlyDeployment
    };

    session.result = result;
    return result;

  } catch (error) {
    session.status = "failed";
    session.error = error.message;
    debugLog(`[${sessionId}] Setup failed:`, error);
    throw error;
  }
}

export function sessionStatus(sessionId: string): SetupSession | null {
  return activeSessions.get(sessionId) || null;
}

export function listSessions(): SetupSession[] {
  return Array.from(activeSessions.values());
}

export function clearSession(sessionId: string): boolean {
  return activeSessions.delete(sessionId);
}
