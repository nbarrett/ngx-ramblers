import debug from "debug";
import crypto from "crypto";
import { envConfig } from "../env-config/env-config";
import { SecretsConfig } from "../../deploy/types";
import {
  AwsCustomerCredentials,
  CopiedAssets,
  EnvironmentSetupRequest,
  EnvironmentSetupResult,
  flySafeResourceName,
  isFullDuplicate,
  ProgressCallback,
  SetupProgress,
  SetupSession,
  SetupStep,
  SetupStepStatus,
  SetupWarning,
  ValidationResult
} from "./types";
import { groupDetails, listGroupsByAreaCode, validateRamblersApiKey } from "./ramblers-api-client";
import {
  adminConfigFromEnvironment,
  copyAllS3Objects,
  copyStandardAssets,
  generateAwsCredentialsResult,
  setupAwsForCustomer,
  validateAwsAdminCredentials
} from "./aws-setup";
import { connectToDatabase, environmentSiteUrl, initialiseDatabase, validateMongoConnection } from "./database-initialiser";
import {
  awsCredentialsFromSource,
  cloneSourceDatabase,
  ensureAdminMemberOnClone,
  groupDomainStagingHostname,
  loadSourceEnvironment,
  sanitiseDuplicatedDatabase,
  sourceMongoParams
} from "./full-duplicate";
import { updateEnvironmentSiteUrl } from "./hostname-health";
import { dateTimeNowAsValue } from "../shared/dates";
import { uid } from "rand-token";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  EnvironmentConfig,
  EnvironmentsConfig
} from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { authenticateSendingDomain } from "../brevo/domains/domain-authentication";
import * as configController from "../mongo/controllers/config";
import { connect as ensureMongoConnection } from "../mongo/mongoose-client";
import { buildMongoUri as buildMongoUriFromConfig } from "../shared/mongodb-uri";
import { normaliseMemory } from "../shared/spelling";
import { pluraliseWithCount } from "../shared/string-utils";
import { deployToFlyio as deployToFlyioCommand } from "../cli/commands/fly";
import { DeployOutputCallback } from "../cli/cli.model";
import { addCustomDomainForEnvironment, setupSubdomainForEnvironment } from "../cli/commands/subdomain";
import { configuredEnvironments } from "../environments/environments-config";
import { baseDomainFrom } from "./environment-context";
import { registerBrevoSender } from "../brevo/senders/create-sender";
import { configuredChromeVersion } from "../shared/chrome-version";

const debugLog = debug(envConfig.logNamespace("environment-setup:service"));
debugLog.enabled = true;

const activeSessions = new Map<string, SetupSession>();

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
  awsCredentials: AwsCustomerCredentials,
  secrets: SecretsConfig
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
      apiKey: request.serviceConfigs.flyio?.personalAccessToken || "",
      memory: request.environmentBasics.memory,
      scaleCount: request.environmentBasics.scaleCount,
      organisation: request.environmentBasics.organisation || "personal"
    },
    secrets: { ...secrets }
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

  return {
    AUTH_SECRET: authSecret,
    AWS_ACCESS_KEY_ID: awsCredentials.accessKeyId,
    AWS_SECRET_ACCESS_KEY: awsCredentials.secretAccessKey,
    AWS_BUCKET: awsCredentials.bucket,
    AWS_REGION: awsCredentials.region,
    CHROME_VERSION: configuredChromeVersion(),
    DEBUG: "ngx-ramblers:*",
    DEBUG_COLORS: "true",
    MONGODB_URI: mongoUri,
    NODE_ENV: "production"
  };
}

export async function validateSetupRequest(request: EnvironmentSetupRequest): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  const ramblersValidation = await validateRamblersApiKey(request.serviceConfigs.ramblers.apiKey);
  results.push({
    valid: ramblersValidation.valid,
    message: `Ramblers API Key: ${ramblersValidation.message}`
  });

  if (!request.ramblersInfo.groupCode) {
    results.push({
      valid: false,
      message: "Ramblers Group: group code is required (select an area and group, or pick a clone source that has one)"
    });
  } else {
    results.push({
      valid: true,
      message: `Ramblers Group: ${request.ramblersInfo.groupName || request.ramblersInfo.groupCode}`
    });
  }

  const mongoUri = buildMongoUri(request);
  const mongoValidation = await validateMongoConnection({
    uri: mongoUri,
    database: request.serviceConfigs.mongodb.database
  });
  results.push({
    valid: mongoValidation.valid,
    message: `MongoDB: ${mongoValidation.message}`
  });

  if (isFullDuplicate(request)) {
    if (!request.sourceEnvironmentName) {
      results.push({
        valid: false,
        message: "Full duplicate: a source environment is required"
      });
    } else {
      try {
        const source = await loadSourceEnvironment(request.sourceEnvironmentName);
        if (source.environment === request.environmentBasics.environmentName) {
          results.push({
            valid: false,
            message: "Full duplicate: the new environment name must be different from the source"
          });
        } else if (source.mongo?.db && source.mongo.db === request.serviceConfigs.mongodb.database) {
          results.push({
            valid: false,
            message: "Full duplicate: the target database must be different from the source"
          });
        } else {
          results.push({
            valid: true,
            message: `Full duplicate source: ${source.environment}`
          });
        }
        const sandboxFlyToken = request.serviceConfigs.flyio?.personalAccessToken;
        if (!sandboxFlyToken) {
          results.push({
            valid: false,
            message: "Full duplicate: a Fly token for the sandbox account is required so the new machine is not created on the live site's Fly account"
          });
        } else if (source.flyio?.apiKey && sandboxFlyToken === source.flyio.apiKey) {
          results.push({
            valid: false,
            message: "Full duplicate: the Fly token matches the live site. Use a token from a different Fly account so a free plan is not billed for a second machine"
          });
        } else {
          results.push({
            valid: true,
            message: "Fly: sandbox will deploy with the token you supplied"
          });
        }
      } catch (error) {
        results.push({
          valid: false,
          message: error instanceof Error ? error.message : "Full duplicate: source environment could not be loaded"
        });
      }
    }
  }

  const awsAdminConfig = adminConfigFromEnvironment();
  const needsAwsAdmin = !isFullDuplicate(request) || request.options.copySourceBucket;
  if (!needsAwsAdmin) {
    results.push({
      valid: true,
      message: "AWS: sandbox will share the source S3 bucket"
    });
  } else if (awsAdminConfig) {
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
  return results;
}

export async function createEnvironment(
  request: EnvironmentSetupRequest,
  progressCallback?: ProgressCallback,
  onDeployOutput?: DeployOutputCallback
): Promise<EnvironmentSetupResult> {
  const sessionId = generateSessionId();
  const session: SetupSession = {
    sessionId,
    request,
    progress: [],
    status: SetupStepStatus.Running,
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

  const warnings: SetupWarning[] = [];

  const recordWarning = (step: SetupStep, message: string) => {
    warnings.push({step, message});
    reportProgress(step, SetupStepStatus.Failed, `${message} — continuing with remaining steps`);
  };

  const runOptionalStep = async (step: SetupStep, runningMessage: string, action: () => Promise<string>): Promise<void> => {
    reportProgress(step, SetupStepStatus.Running, runningMessage);
    try {
      reportProgress(step, SetupStepStatus.Completed, await action());
    } catch (error) {
      recordWarning(step, error instanceof Error ? error.message : String(error));
    }
  };

  try {
    reportProgress(SetupStep.VALIDATE_INPUTS, SetupStepStatus.Running, "Validating configuration");
    const validationResults = await validateSetupRequest(request);
    const failedValidations = validationResults.filter(r => !r.valid);
    if (failedValidations.length > 0) {
      const errorMessage = failedValidations.map(r => r.message).join("; ");
      throw new Error(`Validation failed: ${errorMessage}`);
    }
    reportProgress(SetupStep.VALIDATE_INPUTS, SetupStepStatus.Completed, "All validations passed");

    reportProgress(SetupStep.QUERY_RAMBLERS_API, SetupStepStatus.Running, "Fetching group details from Ramblers API");
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
    reportProgress(SetupStep.QUERY_RAMBLERS_API, SetupStepStatus.Completed, `Found group: ${groupData.name}`);

    const fullDuplicate = isFullDuplicate(request);
    const sourceEnvironment = fullDuplicate ? await loadSourceEnvironment(request.sourceEnvironmentName) : null;
    request.environmentBasics.appName = flySafeResourceName(request.environmentBasics.appName);
    let awsCredentials: AwsCustomerCredentials;
    let copiedAssets: CopiedAssets | undefined;
    const awsAdminConfig = adminConfigFromEnvironment();

    if (fullDuplicate && sourceEnvironment && !request.options.copySourceBucket) {
      awsCredentials = awsCredentialsFromSource(sourceEnvironment);
      reportProgress(SetupStep.CREATE_AWS_RESOURCES, SetupStepStatus.Completed, `Reusing S3 bucket ${awsCredentials.bucket} from ${sourceEnvironment.environment}`);
      reportProgress(SetupStep.COPY_STANDARD_ASSETS, SetupStepStatus.Completed, "Skipped — sandbox shares the live bucket");
    } else if (!request.options.skipFlyDeployment && awsAdminConfig) {
      reportProgress(SetupStep.CREATE_AWS_RESOURCES, SetupStepStatus.Running, "Creating S3 bucket and IAM user");
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
      reportProgress(SetupStep.CREATE_AWS_RESOURCES, SetupStepStatus.Completed, `Created bucket: ${awsCredentials.bucket}`);

      const sourceBucket = sourceEnvironment?.aws?.bucket;
      if (fullDuplicate && sourceBucket) {
        await runOptionalStep(SetupStep.COPY_STANDARD_ASSETS, "Copying files from the source bucket", async () => {
          const copyResult = await copyAllS3Objects(awsAdminConfig, sourceBucket, awsCredentials.bucket);
          return `Copied ${copyResult.copied} objects from ${sourceBucket}`;
        });
      } else if (request.options.copyStandardAssets) {
        await runOptionalStep(SetupStep.COPY_STANDARD_ASSETS, "Copying standard assets to S3 bucket", async () => {
          const copyResult = await copyStandardAssets(awsAdminConfig, awsCredentials.bucket);
          copiedAssets = {
            icons: copyResult.icons,
            logos: copyResult.logos,
            backgrounds: copyResult.backgrounds
          };
          const totalCopied = copyResult.icons.length + copyResult.logos.length + copyResult.backgrounds.length;
          if (copyResult.failures.length > 0) {
            const failureMsg = copyResult.failures.map(f => `${f.file}: ${f.error}`).join("; ");
            throw new Error(`Copied ${totalCopied} assets but ${copyResult.failures.length} failed: ${failureMsg}`);
          }
          return `Copied ${totalCopied} assets (${copyResult.icons.length} icons, ${copyResult.logos.length} logos, ${copyResult.backgrounds.length} backgrounds)`;
        });
      } else {
        reportProgress(SetupStep.COPY_STANDARD_ASSETS, SetupStepStatus.Completed, "Skipped copying standard assets");
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
      reportProgress(SetupStep.CREATE_AWS_RESOURCES, SetupStepStatus.Completed, "Skipped AWS resource creation (using placeholder)");
      reportProgress(SetupStep.COPY_STANDARD_ASSETS, SetupStepStatus.Completed, "Skipped copying standard assets");
    }

    reportProgress(SetupStep.GENERATE_SECRETS, SetupStepStatus.Running, "Generating authentication secret");
    const authSecret = generateAuthSecret();
    reportProgress(SetupStep.GENERATE_SECRETS, SetupStepStatus.Completed, "Generated AUTH_SECRET");

    const secrets = buildSecretsConfig(request, awsCredentials, authSecret);

    reportProgress(SetupStep.WRITE_SECRETS_FILE, SetupStepStatus.Completed, "Secrets persisted to database (no local file)");

    reportProgress(SetupStep.UPDATE_ENVIRONMENTS_CONFIG, SetupStepStatus.Running, "Saving environment configuration");
    await ensureMongoConnection();
    await updateEnvironmentsConfig(request, awsCredentials, secrets);
    reportProgress(SetupStep.UPDATE_ENVIRONMENTS_CONFIG, SetupStepStatus.Completed, "Environment configuration and secrets saved");

    const adminAccess = { passwordResetId: null as string | null };
    if (fullDuplicate && sourceEnvironment) {
      reportProgress(SetupStep.CLONE_SOURCE_DATABASE, SetupStepStatus.Running, `Copying database from ${sourceEnvironment.environment}`);
      const cloneTimeout = 600000;
      const cloneResult = await Promise.race([
        cloneSourceDatabase(
          sourceMongoParams(sourceEnvironment),
          {
            uri: buildMongoUri(request),
            database: request.serviceConfigs.mongodb.database
          },
          dbProgress => {
            reportProgress(SetupStep.CLONE_SOURCE_DATABASE, SetupStepStatus.Running, dbProgress.message || dbProgress.step);
          }
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Database copy timed out after ${cloneTimeout / 1000} seconds`)), cloneTimeout)
        )
      ]);
      reportProgress(SetupStep.CLONE_SOURCE_DATABASE, SetupStepStatus.Completed, `Copied ${cloneResult.documents} documents in ${cloneResult.collections} collections`);

      reportProgress(SetupStep.ISOLATE_SANDBOX, SetupStepStatus.Running, "Disconnecting mail, Walks Manager and inbox from the live site");
      const provisionalSiteUrl = await environmentSiteUrl(request.environmentBasics.environmentName, request.environmentBasics.appName);
      const targetConnection = await connectToDatabase({
        uri: buildMongoUri(request),
        database: request.serviceConfigs.mongodb.database
      });
      try {
        await sanitiseDuplicatedDatabase(targetConnection.db, provisionalSiteUrl);
        adminAccess.passwordResetId = await ensureAdminMemberOnClone(targetConnection.db, request);
      } finally {
        await targetConnection.client.close();
      }
      reportProgress(SetupStep.ISOLATE_SANDBOX, SetupStepStatus.Completed, "Sandbox cannot send mail, publish to Walks Manager or poll the live mailbox");
      reportProgress(SetupStep.INITIALISE_DATABASE, SetupStepStatus.Completed, "Skipped seed — database copied from source");
    } else {
      reportProgress(SetupStep.INITIALISE_DATABASE, SetupStepStatus.Running, "Initialising MongoDB database");
      const dbInitTimeout = 120000;
      const dbResult = await Promise.race([
        initialiseDatabase(request, dbProgress => {
          reportProgress(SetupStep.INITIALISE_DATABASE, SetupStepStatus.Running, dbProgress.message || dbProgress.step);
        }, copiedAssets),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Database initialisation timed out after ${dbInitTimeout / 1000} seconds`)), dbInitTimeout)
        )
      ]);
      adminAccess.passwordResetId = dbResult.passwordResetId;
      reportProgress(SetupStep.INITIALISE_DATABASE, SetupStepStatus.Completed, "Database initialised successfully");
    }

    if (request.serviceConfigs.brevo.apiKey && !fullDuplicate) {
      const adminFullName = `${request.adminUser.firstName} ${request.adminUser.lastName}`;
      try {
        await registerBrevoSender(request.serviceConfigs.brevo.apiKey, adminFullName, request.adminUser.email);
        debugLog(`[${sessionId}] Registered admin ${request.adminUser.email} as Brevo sender`);
      } catch (error) {
        debugLog(`[${sessionId}] Brevo sender registration skipped: ${error.message}`);
        warnings.push({
          step: SetupStep.AUTHENTICATE_BREVO_DOMAIN,
          message: `Brevo sender registration for ${request.adminUser.email} failed: ${error.message}`
        });
      }
    }

    await ensureMongoConnection();

    if (!request.options.skipFlyDeployment) {
      reportProgress(SetupStep.DEPLOY_APP, SetupStepStatus.Running, "Deploying to Fly.io");
      await deployToFlyioCommand(
        {
          name: request.environmentBasics.environmentName,
          appName: request.environmentBasics.appName,
          memory: normaliseMemory(request.environmentBasics.memory),
          scaleCount: request.environmentBasics.scaleCount,
          organisation: request.environmentBasics.organisation || "personal",
          secrets,
          apiKey: request.serviceConfigs.flyio?.personalAccessToken
        }, {
          onProgress: progress => debugLog(`[${sessionId}] Fly.io: ${progress.step} - ${progress.status}`),
          onDeployOutput
        }
      );
      reportProgress(SetupStep.DEPLOY_APP, SetupStepStatus.Completed, `Deployed ${request.environmentBasics.appName} to Fly.io`);
    } else {
      reportProgress(SetupStep.DEPLOY_APP, SetupStepStatus.Completed, "Skipped Fly.io deployment");
    }

    let appUrl = `https://${request.environmentBasics.appName}.fly.dev`;
    let subdomainHostname = "";

    const customDomainHostname = fullDuplicate && sourceEnvironment && request.options.customDomainHostname
      ? (await groupDomainStagingHostname(sourceEnvironment) || request.options.customDomainHostname)
      : request.options.customDomainHostname;
    if (customDomainHostname && !request.options.skipFlyDeployment) {
      reportProgress(SetupStep.SETUP_SUBDOMAIN, SetupStepStatus.Running, `Attaching ${customDomainHostname} (Cloudflare DNS + Fly certificate)`);
      const customDomain = await addCustomDomainForEnvironment(request.environmentBasics.environmentName, customDomainHostname);
      subdomainHostname = customDomain.hostname;
      appUrl = `https://${customDomain.hostname}`;
      reportProgress(SetupStep.SETUP_SUBDOMAIN, SetupStepStatus.Completed, `Hostname configured: ${appUrl}`);
    } else if (request.options.setupSubdomain && !request.options.skipFlyDeployment) {
      await runOptionalStep(SetupStep.SETUP_SUBDOMAIN, "Setting up subdomain (DNS + SSL certificate)", async () => {
        await setupSubdomainForEnvironment(request.environmentBasics.environmentName);
        const envConfigData = await configuredEnvironments();
        subdomainHostname = `${request.environmentBasics.environmentName}.${baseDomainFrom(envConfigData)}`;
        appUrl = `https://${subdomainHostname}`;
        return `Subdomain configured: ${appUrl}`;
      });
    } else {
      reportProgress(SetupStep.SETUP_SUBDOMAIN, SetupStepStatus.Completed, "Skipped subdomain setup");
    }

    if (fullDuplicate) {
      await runOptionalStep(SetupStep.ISOLATE_SANDBOX, `Pointing the copied site URL at ${appUrl}`, async () => {
        await updateEnvironmentSiteUrl(request.environmentBasics.environmentName, appUrl);
        return `Site URL set to ${appUrl}`;
      });
    }

    if (request.options.authenticateBrevoDomain && request.serviceConfigs.brevo.apiKey && subdomainHostname && !fullDuplicate) {
      await runOptionalStep(SetupStep.AUTHENTICATE_BREVO_DOMAIN, `Authenticating domain ${subdomainHostname}`, async () => {
        const authResult = await authenticateSendingDomain(subdomainHostname);
        if (!authResult.authenticated) {
          throw new Error(`Domain ${authResult.domainName}: ${authResult.message}`);
        }
        return `Domain ${authResult.domainName} authenticated successfully`;
      });
    } else if (request.options.authenticateBrevoDomain && !subdomainHostname) {
      reportProgress(
        SetupStep.AUTHENTICATE_BREVO_DOMAIN,
        SetupStepStatus.Completed,
        "Skipped Brevo domain authentication (needs deploy and subdomain setup first so DNS exists for the environment host)"
      );
    } else {
      reportProgress(SetupStep.AUTHENTICATE_BREVO_DOMAIN, SetupStepStatus.Completed, "Skipped Brevo domain authentication");
    }

    session.status = SetupStepStatus.Completed;
    session.completedAt = dateTimeNowAsValue();

    const result: EnvironmentSetupResult = {
      environmentName: request.environmentBasics.environmentName,
      appName: request.environmentBasics.appName,
      appUrl,
      mongoDbUri: buildMongoUri(request),
      awsCredentials,
      adminUserCreated: true,
      configsJsonUpdated: !request.options.skipFlyDeployment,
      passwordResetId: adminAccess.passwordResetId || undefined,
      adminUserName: request.adminUser.email.toLowerCase(),
      adminEmail: request.adminUser.email.toLowerCase(),
      warnings
    };

    if (warnings.length > 0) {
      debugLog(`[${sessionId}] Setup completed with ${pluraliseWithCount(warnings.length, "warning")}:`, warnings.map(warning => `${warning.step}: ${warning.message}`).join("; "));
    }

    session.result = result;
    return result;

  } catch (error) {
    session.status = SetupStepStatus.Failed;
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
