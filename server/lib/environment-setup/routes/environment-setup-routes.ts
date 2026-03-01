import debug from "debug";
import express, { Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { envConfig } from "../../env-config/env-config";
import { Environment } from "../../env-config/environment-model";
import { groupDetails, listGroupsByAreaCode, validateRamblersApiKey } from "../ramblers-api-client";
import { assignAdminToCommitteeRoles, seedNotificationConfigs, seedSamplePages, toGroupShortName, validateMongoConnection, wireNotificationConfigsToProcesses } from "../database-initialiser";
import { adminConfigFromEnvironment, copyStandardAssets, validateAwsAdminCredentials } from "../aws-setup";
import { createEnvironment, listSessions, sessionStatus, validateSetupRequest } from "../environment-setup-service";
import { EnvironmentSetupRequest, RamblersAreaLookup, RamblersGroupLookup } from "../types";
import { configuredEnvironments, findEnvironmentFromDatabase } from "../../environments/environments-config";
import { buildMongoUri, extractClusterFromUri, extractUsernameFromUri } from "../../shared/mongodb-uri";
import { resumeEnvironment } from "../../cli/commands/environment";
import { destroyEnvironment } from "../../cli/commands/destroy";
import { setupSubdomainForEnvironment } from "../../cli/commands/subdomain";
import { authenticateSendingDomain } from "../../brevo/domains/domain-authentication";
import { findDomainByName } from "../../brevo/domains/domain-management";
import { listTemplates } from "../../brevo/templates/template-management";
import { seedBrevoTemplatesFromLocal } from "../../brevo/templates/template-seeding";
import { listDnsRecords } from "../../cloudflare/cloudflare-dns";
import { appIpAddresses } from "../../fly/fly-certificates";
import { syncDatabaseToGitHub, transformDatabaseToDeployConfig } from "../../cli/commands/github";
import { execSync } from "child_process";
import { DeploymentConfig } from "../../../deploy/types";
import { booleanOf } from "../../shared/string-utils";
import * as systemConfig from "../../config/system-config";
import { FLYIO_DEFAULTS } from "../../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { ADMIN_SET_PASSWORD_PATH } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { keys } from "es-toolkit/compat";
import { baseDomainFrom, connectToEnvironmentMongo, EnvironmentNotFoundError, loadEnvironmentContext, withBrevoApiKey } from "../environment-context";
import { loadSecretsForEnvironment } from "../../shared/secrets";

const debugLog = debug(envConfig.logNamespace("environment-setup:routes"));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace("environment-setup:routes"));
errorDebugLog.enabled = true;

const router = express.Router();

const isSetupEnabled = (): boolean => {
  const enabled = booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED]);
  debugLog("Setup enabled check:", {enabled, envVar: process.env[Environment.PLATFORM_ADMIN_ENABLED]});
  return enabled;
};

const isAdminRequest = (req: Request): boolean => {
  try {
    const authHeader = req.headers?.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
    if (!token) return false;
    const payload = jwt.verify(token, envConfig.auth().secret) as any;
    return !!(payload?.memberAdmin || payload?.contentAdmin || payload?.fileAdmin ||
      payload?.walkAdmin || payload?.socialAdmin || payload?.treasuryAdmin || payload?.financeAdmin);
  } catch {
    return false;
  }
};

const validateSetupAccess = (req: Request, res: Response): boolean => {
  if (!isSetupEnabled()) {
    res.status(403).json({ error: "Environment setup is not enabled on this environment" });
    return false;
  }

  const setupApiKey = process.env[Environment.ENVIRONMENT_SETUP_API_KEY];
  if (!setupApiKey) {
    return true;
  }

  const providedKey = req.headers["x-setup-api-key"] as string;
  if (providedKey === setupApiKey || isAdminRequest(req)) {
    return true;
  }

  res.status(401).json({ error: "Invalid or missing setup API key" });
  return false;
};

router.post("/ramblers/groups-by-area", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const lookup: RamblersAreaLookup = req.body;
    if (!lookup.areaCode || !lookup.apiKey) {
      res.status(400).json({ error: "areaCode and apiKey are required" });
      return;
    }

    const groups = await listGroupsByAreaCode(lookup);
    res.json({ success: true, groups });
  } catch (error) {
    errorDebugLog("Error fetching groups by area:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/ramblers/group-details", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const lookup: RamblersGroupLookup = req.body;
    if (!lookup.groupCode || !lookup.apiKey) {
      res.status(400).json({ error: "groupCode and apiKey are required" });
      return;
    }

    const group = await groupDetails(lookup);
    if (!group) {
      res.status(404).json({ error: `Group not found: ${lookup.groupCode}` });
      return;
    }

    res.json({ success: true, group });
  } catch (error) {
    errorDebugLog("Error fetching group details:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/ramblers/validate-api-key", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      res.status(400).json({ error: "apiKey is required" });
      return;
    }

    const result = await validateRamblersApiKey(apiKey);
    res.json(result);
  } catch (error) {
    errorDebugLog("Error validating Ramblers API key:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/validate/mongodb", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { cluster, username, password, database } = req.body;
    if (!cluster || !username || !password || !database) {
      res.status(400).json({ error: "cluster, username, password, and database are required" });
      return;
    }

    const uri = buildMongoUri({ cluster, username, password, database });
    const result = await validateMongoConnection({ uri, database });
    res.json(result);
  } catch (error) {
    errorDebugLog("Error validating MongoDB connection:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/validate/aws-admin", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const adminConfig = adminConfigFromEnvironment();
    if (!adminConfig) {
      res.json({
        valid: false,
        message: "AWS admin credentials not configured (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or SETUP_AWS_ACCESS_KEY_ID/SETUP_AWS_SECRET_ACCESS_KEY)"
      });
      return;
    }

    const result = await validateAwsAdminCredentials(adminConfig);
    res.json(result);
  } catch (error) {
    errorDebugLog("Error validating AWS admin credentials:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/validate/request", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const request: EnvironmentSetupRequest = req.body;
    const results = await validateSetupRequest(request);
    const allValid = results.every(r => r.valid);
    res.json({ valid: allValid, results });
  } catch (error) {
    errorDebugLog("Error validating setup request:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/create", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const request: EnvironmentSetupRequest = req.body;

    const validationResults = await validateSetupRequest(request);
    const failedValidations = validationResults.filter(r => !r.valid);
    if (failedValidations.length > 0) {
      res.status(400).json({
        error: "Validation failed",
        validationResults
      });
      return;
    }

    const result = await createEnvironment(request);
    res.json({ success: true, result });
  } catch (error) {
    errorDebugLog("Error creating environment:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/session/:sessionId", (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  const session = sessionStatus(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json(session);
});

router.get("/sessions", (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  const sessions = listSessions();
  res.json(sessions);
});

router.get("/status", (req: Request, res: Response) => {
  const platformAdminEnabled = isSetupEnabled();
  res.json({
    enabled: platformAdminEnabled,
    platformAdminEnabled,
    requiresApiKey: Boolean(process.env[Environment.ENVIRONMENT_SETUP_API_KEY]),
    awsAdminConfigured: Boolean(adminConfigFromEnvironment())
  });
});

router.get("/defaults", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const mongoUri = envConfig.mongo().uri;
    const mongoCluster = extractClusterFromUri(mongoUri) || "";
    const mongoUsername = extractUsernameFromUri(mongoUri) || "";

    const config = await systemConfig.systemConfig();

    const defaults = {
      mongodb: {
        cluster: mongoCluster,
        username: mongoUsername
      },
      aws: {
        region: envConfig.aws().region
      },
      googleMaps: {
        apiKey: config?.googleMaps?.apiKey || ""
      },
      osMaps: {
        apiKey: config?.externalSystems?.osMaps?.apiKey || ""
      },
      ramblers: {
        apiKey: config?.national?.walksManager?.apiKey || ""
      },
      recaptcha: {
        siteKey: config?.recaptcha?.siteKey || "",
        secretKey: config?.recaptcha?.secretKey || ""
      }
    };

    debugLog("Returning environment defaults:", {
      mongoCluster, mongoUsername, awsRegion: defaults.aws.region,
      hasOsMaps: !!defaults.osMaps.apiKey, hasRecaptcha: !!defaults.recaptcha.siteKey
    });
    res.json(defaults);
  } catch (error) {
    errorDebugLog("Error getting defaults:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/environment-details/:environmentName", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { environmentName } = req.params;
    debugLog("Environment details request received for:", environmentName);

    const { envConfigData, secrets } = await loadEnvironmentContext(environmentName);

    const details = {
      environmentBasics: {
        memory: envConfigData.flyio?.memory || FLYIO_DEFAULTS.MEMORY,
        scaleCount: envConfigData.flyio?.scaleCount || FLYIO_DEFAULTS.SCALE_COUNT,
        organisation: envConfigData.flyio?.organisation || FLYIO_DEFAULTS.ORGANISATION
      },
      serviceConfigs: {
        mongodb: {
          cluster: envConfigData.mongo?.cluster || "",
          username: envConfigData.mongo?.username || "",
          password: envConfigData.mongo?.password || ""
        },
        aws: {
          region: secrets.secrets.AWS_REGION || envConfigData.aws?.region || "eu-west-2"
        },
        brevo: {
          apiKey: secrets.secrets.BREVO_API_KEY || ""
        },
        googleMaps: {
          apiKey: secrets.secrets.GOOGLE_MAPS_APIKEY || ""
        },
        osMaps: {
          apiKey: secrets.secrets.OS_MAPS_API_KEY || ""
        },
        recaptcha: {
          siteKey: secrets.secrets.RECAPTCHA_SITE_KEY || "",
          secretKey: secrets.secrets.RECAPTCHA_SECRET_KEY || ""
        },
        ramblers: {
          apiKey: secrets.secrets.RAMBLERS_API_KEY || ""
        },
        flyio: {
          personalAccessToken: envConfigData.flyio?.apiKey || ""
        }
      },
      ramblersInfo: {
        areaCode: secrets.secrets.RAMBLERS_AREA_CODE || "",
        areaName: secrets.secrets.RAMBLERS_AREA_NAME || "",
        groupCode: secrets.secrets.RAMBLERS_GROUP_CODE || "",
        groupName: secrets.secrets.RAMBLERS_GROUP_NAME || ""
      }
    };

    debugLog("Returning environment details for:", environmentName);
    res.json(details);
  } catch (error) {
    if (error instanceof EnvironmentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    errorDebugLog("Error fetching environment details:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get("/environment-status/:environmentName", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { environmentName } = req.params;
    debugLog("Environment status request for:", environmentName);

    const { environmentsConfig, envConfigData, appName, secrets } = await loadEnvironmentContext(environmentName);

    const checks = await Promise.allSettled([
      (async () => {
        const { client, db } = await connectToEnvironmentMongo(envConfigData);
        try {
          const configCollection = db.collection("config");
          const systemConfigDoc = await configCollection.findOne({ key: "system" });
          const pageCount = await db.collection("pageContent").countDocuments();
          const notifCount = await db.collection("notificationConfigs").countDocuments();
          return { databaseInitialised: systemConfigDoc !== null, samplePagesPresent: pageCount > 0, notificationConfigsPresent: notifCount > 0 };
        } finally {
          await client.close();
        }
      })(),
      (async () => {
        const flyToken = envConfigData.flyio?.apiKey || "";
        if (!flyToken) return { flyAppDeployed: false };
        const ips = await appIpAddresses({ apiToken: flyToken, appName });
        return { flyAppDeployed: !!(ips.ipv4 || ips.ipv6) };
      })(),
      (async () => {
        const baseDomain = environmentsConfig.cloudflare?.baseDomain;
        const apiToken = environmentsConfig.cloudflare?.apiToken;
        const zoneId = environmentsConfig.cloudflare?.zoneId;
        if (!baseDomain || !apiToken || !zoneId) return { subdomainConfigured: false };
        const fullHostname = `${environmentName}.${baseDomain}`;
        const records = await listDnsRecords({ apiToken, zoneId }, fullHostname);
        const hasARecord = records.some(r => r.type === "A");
        return { subdomainConfigured: hasARecord };
      })(),
      (async () => {
        const brevoKey = secrets.secrets.BREVO_API_KEY || "";
        if (!brevoKey) return { brevoTemplatesPresent: false, brevoDomainAuthenticated: false };
        return withBrevoApiKey(brevoKey, async () => {
          const templates = await listTemplates();
          const baseDomain = baseDomainFrom(environmentsConfig);
          const domain = await findDomainByName(baseDomain);
          return {
            brevoTemplatesPresent: templates.count > 0,
            brevoDomainAuthenticated: domain?.authenticated === true
          };
        });
      })(),
      (async () => {
        const awsBucket = envConfigData.aws?.bucket || secrets.secrets.AWS_BUCKET || "";
        if (!awsBucket) return { standardAssetsPresent: false };
        const { S3Client, ListObjectsV2Command } = await import("@aws-sdk/client-s3");
        const s3 = new S3Client({
          region: envConfigData.aws?.region || secrets.secrets.AWS_REGION || "eu-west-2",
          credentials: {
            accessKeyId: envConfigData.aws?.accessKeyId || secrets.secrets.AWS_ACCESS_KEY_ID || "",
            secretAccessKey: envConfigData.aws?.secretAccessKey || secrets.secrets.AWS_SECRET_ACCESS_KEY || ""
          }
        });
        const result = await s3.send(new ListObjectsV2Command({ Bucket: awsBucket, Prefix: "icons/", MaxKeys: 1 }));
        return { standardAssetsPresent: (result.KeyCount || 0) > 0 };
      })()
    ]);

    const status = {
      databaseInitialised: false,
      samplePagesPresent: false,
      notificationConfigsPresent: false,
      flyAppDeployed: false,
      standardAssetsPresent: false,
      subdomainConfigured: false,
      brevoTemplatesPresent: false,
      brevoDomainAuthenticated: false
    };

    checks.forEach(result => {
      if (result.status === "fulfilled") {
        Object.assign(status, result.value);
      }
    });

    debugLog("Environment status for %s:", environmentName, status);
    res.json(status);
  } catch (error) {
    if (error instanceof EnvironmentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    errorDebugLog("Error checking environment status:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get("/existing-environments", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const environmentsConfig = await configuredEnvironments();
    const environments = (environmentsConfig.environments || []).map(env => ({
      name: env.environment,
      appName: env.flyio?.appName || `ngx-ramblers-${env.environment}`,
      memory: env.flyio?.memory || FLYIO_DEFAULTS.MEMORY,
      scaleCount: env.flyio?.scaleCount || FLYIO_DEFAULTS.SCALE_COUNT,
      organisation: env.flyio?.organisation || FLYIO_DEFAULTS.ORGANISATION,
      hasApiKey: Boolean(env.flyio?.apiKey)
    }));
    debugLog("Returning existing environments from MongoDB:", environments.length);
    res.json({ environments });
  } catch (error) {
    errorDebugLog("Error listing existing environments:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/resume", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { environmentName, runDbInit, runFlyDeployment } = req.body;
    debugLog("Resume request received:", { environmentName, runDbInit, runFlyDeployment });

    if (!environmentName) {
      debugLog("Missing environmentName in request");
      res.status(400).json({ error: "environmentName is required" });
      return;
    }

    const envConfig = await findEnvironmentFromDatabase(environmentName);
    if (!envConfig) {
      debugLog(`Environment ${environmentName} not found in database`);
      res.status(404).json({ error: `Environment ${environmentName} not found in database` });
      return;
    }

    debugLog("Found environment config:", { name: envConfig.name, appName: envConfig.appName });

    const result = await resumeEnvironment(
      environmentName,
      {
        runDbInit: runDbInit || false,
        runFlyDeployment: runFlyDeployment || false
      }, progress => debugLog(`Resume: ${progress.step} - ${progress.status}`)
    );

    debugLog("Resume completed successfully for:", environmentName);
    res.json({
      success: true,
      result: {
        environmentName: result.environmentName,
        appName: result.appName,
        appUrl: result.appUrl
      }
    });

  } catch (error) {
    errorDebugLog("Error resuming setup:", error.message);
    errorDebugLog("Error stack:", error.stack);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/destroy/:environmentName", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { environmentName } = req.params;
    const { skipFly, skipS3, skipDatabase, skipConfigs } = req.query;
    debugLog("Destroy request received:", { environmentName, skipFly, skipS3, skipDatabase, skipConfigs });

    const envConfigData = await findEnvironmentFromDatabase(environmentName);
    if (!envConfigData) {
      debugLog(`Environment ${environmentName} not found in database`);
      res.status(404).json({ error: `Environment ${environmentName} not found in database` });
      return;
    }

    debugLog("Found environment config:", { name: envConfigData.name, appName: envConfigData.appName });

    const secrets = loadSecretsForEnvironment(envConfigData.appName);
    const mongoUri = secrets.secrets.MONGODB_URI;
    let database: string | undefined;

    if (mongoUri) {
      const match = mongoUri.match(/\/([^/?]+)(\?|$)/);
      database = match ? match[1] : undefined;
    }

    const result = await destroyEnvironment(
      {
        name: environmentName,
        appName: envConfigData.appName,
        apiKey: envConfigData.apiKey,
        mongoUri,
        database,
        skipFly: booleanOf(skipFly),
        skipS3: booleanOf(skipS3),
        skipDatabase: booleanOf(skipDatabase),
        skipConfigs: booleanOf(skipConfigs)
      }, progress => debugLog(`Destroy: ${progress.step} - ${progress.status}: ${progress.message}`)
    );

    const failedSteps = result.steps.filter(s => !s.success);
    const successSteps = result.steps.filter(s => s.success);

    debugLog("Destroy completed for:", environmentName, "Success:", result.success);
    debugLog("Successful steps:", successSteps.map(s => s.step).join(", "));
    if (failedSteps.length > 0) {
      debugLog("Failed steps:", failedSteps.map(s => `${s.step}: ${s.message}`).join("; "));
    }

    const message = result.success
      ? `Environment ${environmentName} destroyed successfully`
      : `Environment ${environmentName} partially destroyed. Failed: ${failedSteps.map(s => s.step).join(", ")}`;

    res.json({
      success: result.success,
      message,
      steps: result.steps
    });

  } catch (error) {
    errorDebugLog("Error destroying environment:", error.message);
    errorDebugLog("Error stack:", error.stack);
    res.status(500).json({ error: error.message });
  }
});

router.post("/copy-assets/:environmentName", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { environmentName } = req.params;
    debugLog("Copy assets request received for:", environmentName);

    const { envConfigData } = await loadEnvironmentContext(environmentName);

    const bucket = envConfigData.aws?.bucket;
    if (!bucket) {
      res.status(400).json({ error: `No S3 bucket configured for environment ${environmentName}` });
      return;
    }

    const awsAdminConfig = adminConfigFromEnvironment();
    if (!awsAdminConfig) {
      res.status(400).json({ error: "AWS admin credentials not configured on this server" });
      return;
    }

    debugLog("Copying standard assets to bucket:", bucket);
    const copyResult = await copyStandardAssets(awsAdminConfig, bucket);
    const totalCopied = copyResult.icons.length + copyResult.logos.length + copyResult.backgrounds.length;
    const totalFailed = copyResult.failures.length;

    debugLog("Copied assets:", { totalCopied, totalFailed, failures: copyResult.failures });

    if (totalCopied > 0) {
      const { client, db } = await connectToEnvironmentMongo(envConfigData);
      try {
        const configCollection = db.collection("config");
        const systemConfigDoc = await configCollection.findOne({ key: "system" });

        if (systemConfigDoc?.value) {
          const updates: any = {};
          const existingConfig = systemConfigDoc.value;

          const mergeImages = (existing: any[] = [], copied: any[]) => {
            const existingKeys = new Set(existing.map(img => img.awsFileName));
            const newImages = copied.filter(img => !existingKeys.has(img.awsFileName));
            return [...existing, ...newImages];
          };

          if (copyResult.icons.length > 0) {
            updates["value.icons.images"] = mergeImages(existingConfig.icons?.images, copyResult.icons);
          }
          if (copyResult.logos.length > 0) {
            updates["value.logos.images"] = mergeImages(existingConfig.logos?.images, copyResult.logos);
          }
          if (copyResult.backgrounds.length > 0) {
            updates["value.backgrounds.images"] = mergeImages(existingConfig.backgrounds?.images, copyResult.backgrounds);
          }

          if (keys(updates).length > 0) {
            await configCollection.updateOne({ key: "system" }, { $set: updates });
            debugLog("Updated system config with merged assets");
          }
        }
      } finally {
        await client.close();
      }
    }

    const hasFailures = totalFailed > 0;
    const message = hasFailures
      ? `Copied ${totalCopied} assets but ${totalFailed} failed: ${copyResult.failures.map(f => f.file).join(", ")}`
      : `Copied ${totalCopied} assets to ${bucket} and updated system config`;

    res.json({
      success: !hasFailures,
      message,
      copiedAssets: {
        icons: copyResult.icons,
        logos: copyResult.logos,
        backgrounds: copyResult.backgrounds
      },
      failures: copyResult.failures
    });
  } catch (error) {
    if (error instanceof EnvironmentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    errorDebugLog("Error copying assets:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post("/setup-subdomain/:environmentName", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { environmentName } = req.params;
    debugLog("Setup subdomain request received for:", environmentName);

    const { environmentsConfig } = await loadEnvironmentContext(environmentName);

    await setupSubdomainForEnvironment(environmentName);

    const baseDomain = baseDomainFrom(environmentsConfig);
    const hostname = `${environmentName}.${baseDomain}`;

    res.json({
      success: true,
      message: `Subdomain configured successfully`,
      hostname
    });
  } catch (error) {
    errorDebugLog("Error setting up subdomain:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/authenticate-brevo-domain/:environmentName", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { environmentName } = req.params;
    debugLog("Authenticate Brevo domain request received for:", environmentName);

    const { environmentsConfig } = await loadEnvironmentContext(environmentName);
    const baseDomain = baseDomainFrom(environmentsConfig);
    const hostname = `${environmentName}.${baseDomain}`;

    debugLog("Authenticating Brevo sending domain:", hostname);
    const result = await authenticateSendingDomain(hostname);

    res.json({
      success: result.authenticated,
      message: result.message,
      hostname: result.domainName || hostname
    });
  } catch (error) {
    if (error instanceof EnvironmentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    errorDebugLog("Error authenticating Brevo domain:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/seed-sample-pages/:environmentName", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { environmentName } = req.params;
    debugLog("Seed sample pages request received for:", environmentName);

    const { envConfigData } = await loadEnvironmentContext(environmentName);
    const { client, db } = await connectToEnvironmentMongo(envConfigData);
    try {
      const configCollection = db.collection("config");
      const systemConfigDoc = await configCollection.findOne({ key: "system" });
      const groupName = systemConfigDoc?.value?.group?.longName || environmentName;
      const groupShortName = toGroupShortName(groupName);

      const { upsertedCount, totalCount } = await seedSamplePages(db, groupName, groupShortName);

      debugLog(`Seeded ${upsertedCount} new sample pages, updated ${totalCount - upsertedCount} existing`);
      res.json({
        success: true,
        message: `Upserted ${totalCount} sample pages (${upsertedCount} new)`,
        upsertedCount
      });
    } finally {
      await client.close();
    }
  } catch (error) {
    if (error instanceof EnvironmentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    errorDebugLog("Error seeding sample pages:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post("/seed-notification-configs/:environmentName", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { environmentName } = req.params;
    debugLog("Seed notification configs request received for:", environmentName);

    const { envConfigData } = await loadEnvironmentContext(environmentName);
    const { client, db } = await connectToEnvironmentMongo(envConfigData);
    try {
      const { seededCount, skippedCount } = await seedNotificationConfigs(db);
      const { wiredCount } = await wireNotificationConfigsToProcesses(db);

      const membersCollection = db.collection("members");
      const adminMember = await membersCollection.findOne({ memberAdmin: true });
      let rolesAssigned = 0;
      if (adminMember?.firstName && adminMember?.lastName && adminMember?.email) {
        const result = await assignAdminToCommitteeRoles(db, {
          firstName: adminMember.firstName,
          lastName: adminMember.lastName,
          email: adminMember.email
        });
        rolesAssigned = result.assignedCount;
      }

      debugLog(`Notification configs: seeded ${seededCount}, skipped ${skippedCount}, wired ${wiredCount}, roles assigned ${rolesAssigned}`);
      res.json({
        success: true,
        message: `Seeded ${seededCount} notification configs, skipped ${skippedCount} existing, wired ${wiredCount} to built-in processes, assigned admin to ${rolesAssigned} committee roles`,
        seededCount,
        skippedCount,
        wiredCount,
        rolesAssigned
      });
    } finally {
      await client.close();
    }
  } catch (error) {
    if (error instanceof EnvironmentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    errorDebugLog("Error seeding notification configs:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post("/populate-brevo-templates/:environmentName", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { environmentName } = req.params;
    debugLog("Populate Brevo templates request received for:", environmentName);

    const { secrets } = await loadEnvironmentContext(environmentName);
    const brevoApiKey = secrets.secrets.BREVO_API_KEY;

    if (!brevoApiKey) {
      res.status(400).json({ error: `No Brevo API key configured for environment ${environmentName}` });
      return;
    }

    const seedResult = await withBrevoApiKey(brevoApiKey, () => seedBrevoTemplatesFromLocal());
    res.json({
      success: true,
      message: `Created ${seedResult.createdCount}, updated ${seedResult.updatedCount}, skipped ${seedResult.skippedCount}`,
      createdCount: seedResult.createdCount,
      updatedCount: seedResult.updatedCount,
      skippedCount: seedResult.skippedCount
    });
  } catch (error) {
    if (error instanceof EnvironmentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    errorDebugLog("Error populating Brevo templates:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post("/admin-password-reset/:environmentName", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const { environmentName } = req.params;
    debugLog("Admin password reset request received for:", environmentName);

    const { environmentsConfig, envConfigData } = await loadEnvironmentContext(environmentName);
    const { client, db } = await connectToEnvironmentMongo(envConfigData);
    try {
      const membersCollection = db.collection("members");
      const adminMember = await membersCollection.findOne({ memberAdmin: true });
      if (!adminMember) {
        res.status(404).json({ success: false, message: "No admin member found in target environment" });
        return;
      }

      const { generateUid } = await import("../../shared/string-utils");
      const passwordResetId = generateUid();
      await membersCollection.updateOne(
        { _id: adminMember._id },
        { $set: { passwordResetId, expiredPassword: true } }
      );

      const baseDomain = baseDomainFrom(environmentsConfig);
      const appName = envConfigData.flyio?.appName || `ngx-ramblers-${environmentName}`;
      const appUrl = `https://${environmentName}.${baseDomain}`;
      const flyUrl = `https://${appName}.fly.dev`;
      const resetPath = `/${ADMIN_SET_PASSWORD_PATH}/${passwordResetId}`;

      res.json({
        success: true,
        message: `Password reset generated for ${adminMember.userName || adminMember.email}`,
        resetUrl: appUrl + resetPath,
        flyResetUrl: flyUrl + resetPath,
        userName: adminMember.userName,
        email: adminMember.email
      });
    } finally {
      await client.close();
    }
  } catch (error) {
    if (error instanceof EnvironmentNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }
    errorDebugLog("Error generating admin password reset:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/github/status", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    if (!process.env.CONFIGS_JSON) {
      const dbConfig = await configuredEnvironments();
      process.env.CONFIGS_JSON = JSON.stringify(transformDatabaseToDeployConfig(dbConfig));
      debugLog("Initialised CONFIGS_JSON from database (assuming in sync with GitHub)");
    }
    const secretConfig: DeploymentConfig = JSON.parse(process.env.CONFIGS_JSON);

    const dbConfig = await configuredEnvironments();
    const dbEnvironments = dbConfig.environments || [];
    const environmentCount = dbEnvironments.length;

    const secretByName = new Map(secretConfig.environments.map(e => [e.name, e]));
    const secretByAppName = new Map(secretConfig.environments.map(e => [e.appName, e]));
    const matchedSecretAppNames = new Set<string>();

    const reconciliation: { name: string; inConfigsJson: boolean; inDatabase: boolean; differences: string[] }[] = [];

    dbEnvironments.forEach(dbEnv => {
      let secretEnv = secretByName.get(dbEnv.environment) || null;
      if (!secretEnv) {
        const candidateAppNames = dbEnv.flyio?.appName
          ? [dbEnv.flyio.appName]
          : [dbEnv.environment, `ngx-ramblers-${dbEnv.environment}`];
        const matchedAppName = candidateAppNames.find(n => secretByAppName.has(n));
        secretEnv = matchedAppName ? secretByAppName.get(matchedAppName) : null;
      }

      if (secretEnv && !matchedSecretAppNames.has(secretEnv.appName)) {
        matchedSecretAppNames.add(secretEnv.appName);
        const differences: string[] = [];
        const dbMemory = dbEnv.flyio?.memory || FLYIO_DEFAULTS.MEMORY;
        const dbScaleCount = dbEnv.flyio?.scaleCount || FLYIO_DEFAULTS.SCALE_COUNT;
        const dbOrganisation = dbEnv.flyio?.organisation || FLYIO_DEFAULTS.ORGANISATION;
        if (dbMemory !== secretEnv.memory) differences.push(`memory: ${secretEnv.memory} → ${dbMemory}`);
        if (dbScaleCount !== secretEnv.scaleCount) differences.push(`scaleCount: ${secretEnv.scaleCount} → ${dbScaleCount}`);
        if (dbOrganisation !== secretEnv.organisation) differences.push(`organisation: ${secretEnv.organisation} → ${dbOrganisation}`);
        reconciliation.push({ name: secretEnv.name, inConfigsJson: true, inDatabase: true, differences });
      } else if (!secretEnv) {
        reconciliation.push({ name: dbEnv.environment, inConfigsJson: false, inDatabase: true, differences: [] });
      }
    });

    secretConfig.environments.forEach(secretEnv => {
      if (!matchedSecretAppNames.has(secretEnv.appName)) {
        reconciliation.push({ name: secretEnv.name, inConfigsJson: true, inDatabase: false, differences: [] });
      }
    });

    reconciliation.sort((a, b) => a.name.localeCompare(b.name));
    const isUpToDate = reconciliation.every(e => e.inDatabase && e.inConfigsJson && e.differences.length === 0);

    let secretUpdatedAt: string;
    try {
      const output = execSync("gh api repos/nbarrett/ngx-ramblers/actions/secrets/CONFIGS_JSON", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"]
      });
      secretUpdatedAt = JSON.parse(output).updated_at;
    } catch (ghError) {
      res.json({ secretUpdatedAt: null, environmentCount, isUpToDate, reconciliation,
        error: `Unable to fetch GitHub secret status: ${ghError.message}` });
      return;
    }

    res.json({ secretUpdatedAt, environmentCount, isUpToDate, reconciliation });
  } catch (error) {
    errorDebugLog("Error fetching GitHub secret status:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/github/push", async (req: Request, res: Response) => {
  if (!validateSetupAccess(req, res)) return;

  try {
    const result = await syncDatabaseToGitHub();
    process.env.CONFIGS_JSON = result.configJson;
    res.json({ environmentCount: result.environmentCount });
  } catch (error) {
    errorDebugLog("Error pushing to GitHub:", error);
    res.status(500).json({ error: error.message });
  }
});

export const environmentSetupRoutes = router;
