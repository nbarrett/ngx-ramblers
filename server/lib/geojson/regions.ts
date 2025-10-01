import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { queryKey } from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";

const debugLog = debug(envConfig.logNamespace("regions"));
debugLog.enabled = true;

interface RamblersGroupConfig {
  name: string;
  url: string;
  groupCode: string;
  onsDistricts: string | string[];
  color?: string;
  nonGeographic?: boolean;
}

interface RegionConfig {
  name: string;
  center: [number, number];
  zoom: number;
  groups: RamblersGroupConfig[];
}

export async function regions(req: Request, res: Response) {
  try {
    const { regionName } = req.query;

    if (!regionName || typeof regionName !== "string") {
      debugLog("Missing or invalid regionName query parameter");
      return res.status(400).json({ "error": "regionName query parameter is required" });
    }

    const configDoc = await queryKey(ConfigKey.SYSTEM);
    const systemConfig = configDoc?.value;

    if (!systemConfig?.area) {
      debugLog(`No system configuration found`);
      return res.status(404).json({ "error": "System configuration not found" });
    }

    if (systemConfig.area.shortName !== regionName) {
      debugLog(`Region ${regionName} does not match configured area ${systemConfig.area.shortName}`);
      return res.status(404).json({ "error": `No configuration found for region: ${regionName}` });
    }

    const areaGroups = systemConfig.area.groups || [];

    const regionConfig: RegionConfig = {
      name: systemConfig.area.longName || regionName,
      center: [51.25, 0.75],
      zoom: 10,
      groups: areaGroups.map(group => ({
        name: group.name,
        url: group.url || "",
        groupCode: group.groupCode,
        onsDistricts: group.onsDistricts,
        color: group.color,
        nonGeographic: group.nonGeographic || false
      }))
    };

    debugLog(`Successfully retrieved configuration for region: ${regionName}`);
    res.status(200).json(regionConfig);
  } catch (error) {
    debugLog(`Caught error in regions endpoint: ${error.message}`);
    res.status(500).json({ "error": "Internal server error" });
  }
}
