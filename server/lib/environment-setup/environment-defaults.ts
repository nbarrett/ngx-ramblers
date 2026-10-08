import { Request, Response } from "express";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { recaptchaKeys } from "../config/recaptcha-keys";
import { systemConfig } from "../config/system-config";
import { envConfig } from "../env-config/env-config";
import { configuredEnvironments } from "../environments/environments-config";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { extractClusterFromUri, extractUsernameFromUri, parseMongoUri } from "../shared/mongodb-uri";

const errorDebugLog = createErrorDebugLog("environment-setup:defaults");

export async function environmentDefaults(req: Request, res: Response): Promise<void> {
  try {
    const mongoUri = envConfig.mongo().uri;
    const parsedMongo = parseMongoUri(mongoUri);
    const config = await systemConfig();
    const recaptcha = await recaptchaKeys();
    const environments = await configuredEnvironments();
    const atlasDefaultCluster = environments.atlas?.defaultCluster || "";
    res.json({
      environment: (parsedMongo?.database || "").replace(/^ngx-ramblers-/, ""),
      database: parsedMongo?.database || "",
      atlasDefaultCluster,
      mongodb: {
        cluster: atlasDefaultCluster || extractClusterFromUri(mongoUri) || "",
        username: atlasDefaultCluster ? "" : (extractUsernameFromUri(mongoUri) || "")
      },
      aws: {
        region: envConfig.value(Environment.AWS_REGION) || ""
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
      recaptcha
    });
  } catch (error) {
    errorDebugLog("Error getting defaults:", error);
    res.status(500).json({error: error.message});
  }
}
