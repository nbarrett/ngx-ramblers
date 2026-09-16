import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { configuredBrevo } from "../brevo/brevo-config";
import { EnvironmentConfig, FLYIO_DEFAULTS } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import { connectToEnvironmentMongo, EnvironmentNotFoundError, loadEnvironmentContext } from "./environment-context";
import { Request, Response } from "express";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { EnvironmentDetails, EnvironmentStoredRamblersInfo } from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";

const debugLog = debug(envConfig.logNamespace("environment-setup:details"));
const errorDebugLog = createErrorDebugLog("environment-setup:details");

async function environmentRamblersInfo(envConfigData: EnvironmentConfig): Promise<EnvironmentStoredRamblersInfo> {
  try {
    const {client, db} = await connectToEnvironmentMongo(envConfigData);
    try {
      const systemConfigDoc = await db.collection("config").findOne({key: "system"});
      const systemConfig = systemConfigDoc?.value;
      return {
        groupCode: systemConfig?.group?.groupCode,
        groupName: systemConfig?.group?.longName,
        areaCode: systemConfig?.area?.shortName,
        areaName: systemConfig?.area?.longName,
        siteHref: systemConfig?.group?.href || ""
      };
    } finally {
      await client.close();
    }
  } catch (error) {
    debugLog("Could not load Ramblers info from source DB systemConfig:", error.message);
    return {};
  }
}

export async function environmentDetails(environmentName: string): Promise<EnvironmentDetails> {
  const {envConfigData, secrets} = await loadEnvironmentContext(environmentName);
  const brevoConfig = await configuredBrevo();
  const ramblersInfoFromDb = await environmentRamblersInfo(envConfigData);
  return {
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
        apiKey: brevoConfig?.apiKey || ""
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
      areaCode: secrets.secrets.RAMBLERS_AREA_CODE || ramblersInfoFromDb.areaCode || "",
      areaName: secrets.secrets.RAMBLERS_AREA_NAME || ramblersInfoFromDb.areaName || "",
      groupCode: secrets.secrets.RAMBLERS_GROUP_CODE || ramblersInfoFromDb.groupCode || "",
      groupName: secrets.secrets.RAMBLERS_GROUP_NAME || ramblersInfoFromDb.groupName || ""
    },
    siteHref: ramblersInfoFromDb.siteHref || ""
  };
}

export async function environmentDetailsRequest(req: Request, res: Response): Promise<void> {
  try {
    const {environmentName} = req.params;
    debugLog("Environment details request received for:", environmentName);
    const details = await environmentDetails(environmentName);
    debugLog("Returning environment details for:", environmentName);
    res.json(details);
  } catch (error) {
    if (error instanceof EnvironmentNotFoundError) {
      res.status(404).json({error: error.message});
    } else {
      errorDebugLog("Error fetching environment details:", error.message);
      res.status(500).json({error: error.message});
    }
  }
}
