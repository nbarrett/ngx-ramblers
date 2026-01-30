import debug from "debug";
import express, { Request, Response } from "express";
import { envConfig } from "../../env-config/env-config";
import { Environment } from "../../env-config/environment-model";
import { groupDetails, listGroupsByAreaCode, validateRamblersApiKey } from "../ramblers-api-client";
import { connectToDatabase, validateMongoConnection } from "../database-initialiser";
import { adminConfigFromEnvironment, copyStandardAssets, validateAwsAdminCredentials } from "../aws-setup";
import { createEnvironment, listSessions, sessionStatus, validateSetupRequest } from "../environment-setup-service";
import { EnvironmentSetupRequest, RamblersAreaLookup, RamblersGroupLookup } from "../types";
import { findEnvironment } from "../../shared/configs-json";
import { buildMongoUri, extractClusterFromUri, extractUsernameFromUri } from "../../shared/mongodb-uri";
import { loadSecretsForEnvironment } from "../../shared/secrets";
import { resumeEnvironment } from "../../cli/commands/environment";
import { destroyEnvironment } from "../../cli/commands/destroy";
import { booleanOf } from "../../shared/string-utils";
import { configuredEnvironments } from "../../environments/environments-config";
import * as systemConfig from "../../config/system-config";
import { FLYIO_DEFAULTS } from "../../../../projects/ngx-ramblers/src/app/models/environment-config.model";

const debugLog = debug(envConfig.logNamespace("environment-setup:routes"));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace("environment-setup:routes"));
errorDebugLog.enabled = true;

const router = express.Router();

const isSetupEnabled = (): boolean => {
  const enabled = booleanOf(process.env[Environment.ENVIRONMENT_SETUP_ENABLED]);
  debugLog("Setup enabled check:", {enabled, envVar: process.env[Environment.ENVIRONMENT_SETUP_ENABLED]});
  return enabled;
};

const validateSetupAccess = (req: Request, res: Response): boolean => {
  if (!isSetupEnabled()) {
    res.status(403).json({ error: "Environment setup is not enabled on this environment" });
    return false;
  }

  const setupApiKey = process.env[Environment.ENVIRONMENT_SETUP_API_KEY];
  if (setupApiKey) {
    const providedKey = req.headers["x-setup-api-key"] as string;
    if (providedKey !== setupApiKey) {
      res.status(401).json({ error: "Invalid or missing setup API key" });
      return false;
    }
  }

  return true;
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
  res.json({
    enabled: isSetupEnabled(),
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

    const envConfig = findEnvironment(environmentName);
    if (!envConfig) {
      debugLog(`Environment ${environmentName} not found in configs.json`);
      res.status(404).json({ error: `Environment ${environmentName} not found in configs.json` });
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

    const envConfigData = findEnvironment(environmentName);
    if (!envConfigData) {
      debugLog(`Environment ${environmentName} not found in configs.json`);
      res.status(404).json({ error: `Environment ${environmentName} not found in configs.json` });
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

    const environmentsConfig = await configuredEnvironments();
    const envConfigData = environmentsConfig.environments?.find(e => e.environment === environmentName);

    if (!envConfigData) {
      res.status(404).json({ error: `Environment ${environmentName} not found in environments config` });
      return;
    }

    const bucket = envConfigData.aws?.bucket;
    if (!bucket) {
      res.status(400).json({ error: `No S3 bucket configured for environment ${environmentName}` });
      return;
    }

    const mongoConfig = envConfigData.mongo;
    if (!mongoConfig?.cluster || !mongoConfig?.db) {
      res.status(400).json({ error: `No MongoDB configured for environment ${environmentName}` });
      return;
    }
    const database = mongoConfig.db;
    const mongoUri = buildMongoUri({
      cluster: mongoConfig.cluster,
      username: mongoConfig.username || "",
      password: mongoConfig.password || "",
      database
    });

    const awsAdminConfig = adminConfigFromEnvironment();
    if (!awsAdminConfig) {
      res.status(400).json({ error: "AWS admin credentials not configured on this server" });
      return;
    }

    debugLog("Copying standard assets to bucket:", bucket);
    const copiedAssets = await copyStandardAssets(awsAdminConfig, bucket);
    const totalCopied = copiedAssets.icons.length + copiedAssets.logos.length + copiedAssets.backgrounds.length;

    debugLog("Copied assets:", copiedAssets);

    if (totalCopied > 0) {
      debugLog("Updating system config in database:", database);
      const { client, db } = await connectToDatabase({ uri: mongoUri, database });
      try {
        const configCollection = db.collection("config");
        const systemConfigDoc = await configCollection.findOne({ key: "system" });

        if (systemConfigDoc?.value) {
          const updates: any = {};

          if (copiedAssets.icons.length > 0) {
            updates["value.icons.images"] = copiedAssets.icons.map(fileName => ({
              width: 150,
              originalFileName: fileName,
              awsFileName: `icons/${fileName}`
            }));
          }
          if (copiedAssets.logos.length > 0) {
            updates["value.logos.images"] = copiedAssets.logos.map(fileName => ({
              width: 300,
              originalFileName: fileName,
              awsFileName: `logos/${fileName}`
            }));
          }
          if (copiedAssets.backgrounds.length > 0) {
            updates["value.backgrounds.images"] = copiedAssets.backgrounds.map(fileName => ({
              width: 1920,
              originalFileName: fileName,
              awsFileName: `backgrounds/${fileName}`
            }));
          }

          if (Object.keys(updates).length > 0) {
            await configCollection.updateOne({ key: "system" }, { $set: updates });
            debugLog("Updated system config with copied assets");
          }
        }
      } finally {
        await client.close();
      }
    }

    res.json({
      success: true,
      message: `Copied ${totalCopied} assets to ${bucket} and updated system config`,
      copiedAssets
    });
  } catch (error) {
    errorDebugLog("Error copying assets:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export const environmentSetupRoutes = router;
