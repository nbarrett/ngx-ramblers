import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { queryKey } from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { isArray, isString } from "es-toolkit/compat";

const debugLog = debug(envConfig.logNamespace("regions"));
debugLog.enabled = false;

interface RamblersGroupConfig {
  name: string;
  url: string;
  externalUrl?: string;
  groupCode: string;
  onsDistricts: string | string[];
  color?: string;
  nonGeographic?: boolean;
}

interface SharedDistrictInfo {
  groups: { name: string; color: string }[];
}

interface RegionConfig {
  name: string;
  center: [number, number];
  zoom: number;
  groups: RamblersGroupConfig[];
  sharedDistricts?: Record<string, SharedDistrictInfo>;
  sharedDistrictStyle?: string;
  mainAreaGroupCodes?: string[];
}

export async function regions(req: Request, res: Response) {
  try {
    const { regionName } = req.query;

    if (!isString(regionName) || !regionName) {
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

    const districtToGroups: Record<string, { name: string; color: string }[]> = {};
    areaGroups.forEach(group => {
      if (group.nonGeographic) return;
      const districts = isArray(group.onsDistricts)
        ? group.onsDistricts
        : (group.onsDistricts ? [group.onsDistricts] : []);
      districts.forEach(district => {
        if (!districtToGroups[district]) {
          districtToGroups[district] = [];
        }
        districtToGroups[district].push({
          name: group.name,
          color: group.color || "hsl(0, 0%, 50%)"
        });
      });
    });

    const sharedDistricts: Record<string, SharedDistrictInfo> = {};
    Object.entries(districtToGroups).forEach(([district, groups]) => {
      if (groups.length > 1) {
        sharedDistricts[district] = { groups };
      }
    });

    const selectedGroupCodes = systemConfig.group?.groupCode
      ? systemConfig.group.groupCode.split(",").map(code => code.trim()).filter(Boolean)
      : [];

    const defaultCenter: [number, number] = [52.5, -1.5];
    const regionConfig: RegionConfig = {
      name: systemConfig.area.longName || regionName,
      center: systemConfig.area.center || defaultCenter,
      zoom: systemConfig.area.zoom || 8,
      groups: areaGroups.map(group => ({
        name: group.name,
        url: group.url || "",
        externalUrl: group.externalUrl,
        groupCode: group.groupCode,
        onsDistricts: group.onsDistricts,
        color: group.color,
        nonGeographic: group.nonGeographic || false
      })),
      sharedDistricts: Object.keys(sharedDistricts).length > 0 ? sharedDistricts : undefined,
      sharedDistrictStyle: systemConfig.area.sharedDistrictStyle,
      mainAreaGroupCodes: selectedGroupCodes
    };

    debugLog(`Successfully retrieved configuration for region: ${regionName}`);
    res.status(200).json(regionConfig);
  } catch (error) {
    debugLog(`Caught error in regions endpoint: ${error.message}`);
    res.status(500).json({ "error": "Internal server error" });
  }
}
