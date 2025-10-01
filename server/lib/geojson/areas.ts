import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import fs from "fs-extra";
import * as turf from "@turf/turf";
import proj4 from "proj4";
import path from "path";
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3 } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { systemConfig } from "../config/system-config";
import {
  EventPopulation,
  Organisation,
  SystemConfig
} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { WalkListView } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { dateTimeNow } from "../shared/dates";
import { DateFormat, RamblersGroupsApiResponse } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { isArray, isNumber, isString } from "es-toolkit/compat";
import { fetchRamblersGroupsFromApi } from "../ramblers/list-groups";

interface AreaMappings {
  [areaName: string]: string | string[];
}

const debugLog = debug(envConfig.logNamespace("areas"));
debugLog.enabled = true;

const s3 = new S3({
  region: envConfig.aws.region,
  credentials: {
    accessKeyId: envConfig.aws.accessKeyId,
    secretAccessKey: envConfig.aws.secretAccessKey
  }
});

let cachedGeoJson: GeoJSON.FeatureCollection<GeoJSON.Polygon> | null = null;
let geoJsonLoadPromise: Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon>> | null = null;
let cachedGeoJsonKey: string | null = null;
let cachedBundledGeoJson: GeoJSON.FeatureCollection<GeoJSON.Polygon> | null = null;
let cachedS3GeoJson: GeoJSON.FeatureCollection<GeoJSON.Polygon> | null = null;
let districtFeatureIndex: Map<string, GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>> | null = null;
const ramblersGroupsCache = new Map<string, RamblersGroupsApiResponse[] | null>();
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

async function loadBundledGeoJson(): Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon>> {
  if (cachedBundledGeoJson) {
    return cachedBundledGeoJson;
  }

  const geojsonPath = path.join(__dirname, "areas.geojson");
  const exists = await fs.pathExists(geojsonPath);
  if (!exists) {
    throw new Error("Bundled area GeoJSON not found");
  }

  cachedBundledGeoJson = await fs.readJson(geojsonPath) as GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  districtFeatureIndex = null;
  return cachedBundledGeoJson;
}

async function loadGeoJson(): Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon>> {
  if (cachedGeoJson) {
    return cachedGeoJson;
  }

  if (!geoJsonLoadPromise) {
    geoJsonLoadPromise = (async () => {
      const key = await resolveAreaMapKey();
      if (key) {
        debugLog(`Loading area GeoJSON from S3 key ${key}`);
        const command = new GetObjectCommand({
          Bucket: envConfig.aws.bucket,
          Key: key
        });
        const response = await s3.send(command);
        if (!response.Body) {
          throw new Error("Area map S3 object has no body");
        }
        const json = await bodyToString(response.Body);
        const parsed = JSON.parse(json) as GeoJSON.FeatureCollection<GeoJSON.Polygon>;
        cachedS3GeoJson = parsed;
        return parsed;
      }

      const geojsonPath = path.join(__dirname, "areas.geojson");
      debugLog("Loading area GeoJSON from local file", geojsonPath);
      return fs.readJson(geojsonPath) as Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon>>;
    })();
  }

  try {
    cachedGeoJson = await geoJsonLoadPromise;
    return cachedGeoJson;
  } finally {
    geoJsonLoadPromise = null;
  }
}

async function loadS3GeoJson(): Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon>> {
  if (cachedS3GeoJson && cachedGeoJsonKey) {
    return cachedS3GeoJson;
  }

  const key = await resolveAreaMapKey();
  if (!key) {
    throw new Error("Area map data not yet uploaded to S3");
  }

  const command = new GetObjectCommand({
    Bucket: envConfig.aws.bucket,
    Key: key
  });
  const response = await s3.send(command);
  if (!response.Body) {
    throw new Error("Area map S3 object has no body");
  }
  const json = await bodyToString(response.Body);
  cachedS3GeoJson = JSON.parse(json) as GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  return cachedS3GeoJson;
}

async function bodyToString(body: any): Promise<string> {
  if (typeof body?.transformToString === "function") {
    return body.transformToString();
  }

  if (typeof body?.getReader === "function") {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks).toString("utf-8");
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return body.text();
  }

  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    (body as Readable)
      .on("data", chunk => chunks.push(chunk))
      .on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
      .on("error", reject);
  });
}

const createBritishNationalGridToWgs84Transformer = () => proj4(
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894 +units=m +no_defs",
  "+proj=longlat +datum=WGS84 +no_defs"
);

const bngToWgs84 = createBritishNationalGridToWgs84Transformer();

function isNestedCoordinateArray(coordinates: any): boolean {
  return isArray(coordinates[0]);
}

function isMultiPolygonOrPolygonWithHoles(coordinates: any): boolean {
  return isArray(coordinates[0][0]);
}

function transformSingleCoordinate(coord: [number, number]): [number, number] {
  const [easting, northing] = coord;
  const [lng, lat] = bngToWgs84.forward([easting, northing]);
  return [lng, lat];
}

function transformPolygonRing(coordinates: [number, number][]): [number, number][] {
  return coordinates.map(transformSingleCoordinate);
}

function transformCoordinates(coordinates: any): any {
  if (isNestedCoordinateArray(coordinates)) {
    if (isMultiPolygonOrPolygonWithHoles(coordinates)) {
      return coordinates.map((ring: any) => transformCoordinates(ring));
    } else {
      return transformPolygonRing(coordinates);
    }
  }
  return coordinates;
}

export async function areas(req: Request, res: Response) {
  try {
    const {areaName, regionName = "Kent"} = req.query;
    if (!isString(areaName) || !areaName.trim()) {
      debugLog("Missing or invalid areaName query parameter");
      return res.status(400).json({"error": "areaName query parameter is required"});
    }

    const geojson = await loadGeoJson();

    const createAreaMappings = async (): Promise<AreaMappings> => {
      const areaGroups = await areaGroupsFromConfig();
      const mappings: AreaMappings = {};
      areaGroups.forEach(group => {
        mappings[group.name] = group.onsDistricts;
      });
      return mappings;
    };

    const mappings = await createAreaMappings();

    const findMappingCaseInsensitive = (areaName: string, mappings: AreaMappings): string | string[] | undefined => {
      const normalizedAreaName = areaName.trim();
      const directMatch = mappings[normalizedAreaName];

      if (directMatch) {
        return directMatch;
      }

      const lowerAreaName = normalizedAreaName.toLowerCase();
      const matchedKey = Object.keys(mappings).find(key => key.toLowerCase() === lowerAreaName);
      return matchedKey ? mappings[matchedKey] : undefined;
    };

    const targetNames = findMappingCaseInsensitive(areaName, mappings);

    if (!targetNames) {
      debugLog(`No mapping found for area: ${areaName}`);
      return res.status(404).json({"error": `No mapping found for area: ${areaName}`});
    }

    if (isArray(targetNames) && targetNames.length === 0) {
      debugLog(`Group ${areaName} has no districts allocated - returning empty FeatureCollection`);
      return res.status(200).json({
        type: "FeatureCollection",
        features: []
      });
    }

    debugLog(`Group ${areaName} mapped to districts: ${isArray(targetNames) ? targetNames.join(", ") : targetNames}`);

    const findFeaturesByNames = (featureCollection: GeoJSON.FeatureCollection<GeoJSON.Polygon>, names: string[]): GeoJSON.Feature<GeoJSON.Polygon>[] => {
      return names
        .map(name => {
          const feature = featureCollection.features.find(f => f.properties?.LAD23NM === name);
          debugLog(`Looking for ${name}: ${feature ? "FOUND" : "NOT FOUND"}`);
          return feature;
        })
        .filter(Boolean) as GeoJSON.Feature<GeoJSON.Polygon>[];
    };


    const processMultipleAreas = (names: string[]): GeoJSON.Feature<GeoJSON.Polygon>[] => {
      debugLog(`Looking for multiple areas (no merging): ${names.join(", ")}`);
      const foundFeatures = findFeaturesByNames(geojson, names);

      if (foundFeatures.length === 0) {
        debugLog(`No features found for areas: ${names.join(", ")}`);
        throw new Error(`No features found for areas: ${names.join(", ")}`);
      }

      debugLog(`Found ${foundFeatures.length} separate features for ${areaName}: ${names.join(", ")}`);
      return foundFeatures;
    };

    const processSingleArea = (name: string): GeoJSON.Feature<GeoJSON.Polygon>[] => {
      debugLog(`Looking for single area: ${name}`);
      const feature = geojson.features.find(f => f.properties?.LAD23NM === name);
      if (!feature) {
        debugLog(`No feature found for area: ${name}`);
        throw new Error(`No feature found for area: ${name}`);
      }
      debugLog(`Retrieved single feature for ${areaName}`);
      return [feature];
    };

    const getFeatures = (): GeoJSON.Feature<GeoJSON.Polygon>[] => {
      if (isArray(targetNames)) {
        return processMultipleAreas(targetNames);
      }
      return processSingleArea(targetNames);
    };

    const transformAndSimplifyFeature = (feature: GeoJSON.Feature<GeoJSON.Polygon>): GeoJSON.Feature<GeoJSON.Polygon> => {
      const transformedGeometry = {
        ...feature.geometry,
        coordinates: transformCoordinates(feature.geometry.coordinates)
      };

      const transformedFeature: GeoJSON.Feature<GeoJSON.Polygon> = {
        ...feature,
        geometry: transformedGeometry
      };

      return turf.simplify(transformedFeature, {
        tolerance: 0.0001,
        highQuality: true
      }) as GeoJSON.Feature<GeoJSON.Polygon>;
    };

    const createFeatureCollectionResponse = (features: GeoJSON.Feature<GeoJSON.Polygon>[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> => ({
      "type": "FeatureCollection",
      "features": features
    });

    try {
      const features = getFeatures();
      const transformedAndSimplified = features.map(transformAndSimplifyFeature);
      const response = createFeatureCollectionResponse(transformedAndSimplified);
      debugLog(`Successfully processed areas for ${areaName} with ${transformedAndSimplified.length} features`);
      res.status(200).json(response);
    } catch (error) {
      return res.status(404).json({"error": error.message});
    }
  } catch (error) {
    debugLog(`Caught error in areas endpoint: ${error.message}`);
    res.status(500).json({"error": "Internal server error"});
  }
}

interface AreaGroupConfig {
  groupCode: string;
  name: string;
  url?: string;
  onsDistricts: string | string[];
  color?: string;
  nonGeographic?: boolean;
}

async function areaGroupsFromConfig(): Promise<AreaGroupConfig[]> {
  const config: SystemConfig = await systemConfig();

  if (!config?.area?.groups) {
    return [];
  }

  return config.area.groups;
}

function extractDistrictNamesFromGroups(groups: AreaGroupConfig[]): string[] {
  const geographicGroups = groups.filter(group => group.nonGeographic !== true);

  const allOnsDistricts = geographicGroups.flatMap(group =>
    isArray(group.onsDistricts) ? group.onsDistricts : [group.onsDistricts]
  );

  return [...new Set(allOnsDistricts)].filter(d => d && d.trim().length > 0) as string[];
}

function filterGeoJsonByDistricts(
  geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon>,
  districts: string[]
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const filteredFeatures = geojson.features.filter(feature =>
    districts.includes(feature.properties?.LAD23NM)
  );

  return {
    type: "FeatureCollection",
    features: filteredFeatures
  };
}

function availableDistrictList(geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon>): string[] {
  const districtSet = new Set<string>();
  geojson.features.forEach(feature => {
    const districtName = feature.properties?.LAD24NM || feature.properties?.LAD23NM;
    if (districtName) {
      districtSet.add(districtName);
    }
  });
  return Array.from(districtSet).sort();
}

function transformFeatureToWgs84(feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  return {
    ...feature,
    geometry: {
      ...feature.geometry,
      coordinates: transformCoordinates(feature.geometry.coordinates)
    }
  } as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
}

async function districtFeatures(): Promise<Map<string, GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>>> {
  if (districtFeatureIndex) {
    return districtFeatureIndex;
  }

  const geojson = await loadBundledGeoJson();
  const index = new Map<string, GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>>();

  geojson.features.forEach(feature => {
    const name = feature.properties?.LAD24NM || feature.properties?.LAD23NM;
    if (!name) {
      return;
    }
    index.set(name, transformFeatureToWgs84(feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>));
  });

  districtFeatureIndex = index;
  return districtFeatureIndex;
}

const COMMON_WORDS = new Set(["white", "green", "north", "south", "east", "west", "new", "old", "great", "little"]);

function normaliseGroupName(name: string): string {
  return name
    .replace(/\s*\(.*?\)/g, "")
    .replace(/\s+Group$/i, "")
    .replace(/\s+Walking\s+Group$/i, "")
    .trim();
}

function findDistrictByCoordinate(latitude: number | undefined, longitude: number | undefined, featureIndex: Map<string, GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>>): string | null {
  if (!isNumber(latitude) || !isNumber(longitude)) {
    return null;
  }

  const point = turf.point([longitude, latitude]);

  for (const [name, feature] of featureIndex.entries()) {
    if (turf.booleanPointInPolygon(point, feature as any)) {
      return name;
    }
  }

  return null;
}

function matchDistrictsForGroup(
  groupName: string,
  districts: string[],
  latitude: number | undefined,
  longitude: number | undefined,
  featureIndex: Map<string, GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>>
): string[] {
  const cleanName = normaliseGroupName(groupName);

  if (!cleanName) {
    return [];
  }

  const matches: string[] = [];
  const nameLower = cleanName.toLowerCase();

  const coordinateMatch = findDistrictByCoordinate(latitude, longitude, featureIndex);
  if (coordinateMatch && districts.includes(coordinateMatch)) {
    return [coordinateMatch];
  }

  districts.forEach(district => {
    const districtLower = district.toLowerCase();

    if (districtLower === nameLower) {
      if (!matches.includes(district)) {
        matches.push(district);
      }
      return;
    }

    const nameWords = nameLower
      .split(/\s+|&|and/)
      .map(word => word.trim())
      .filter(word => word.length > 0 && !COMMON_WORDS.has(word));

    const districtWords = districtLower
      .split(/\s+/)
      .map(word => word.trim())
      .filter(word => word.length > 0 && !COMMON_WORDS.has(word));

    const hasExactWordMatch = nameWords.some(nameWord =>
      nameWord.length > 5 && districtWords.some(districtWord =>
        districtWord === nameWord ||
        (districtWord.length > 7 && nameWord.length > 7 && (districtWord.startsWith(nameWord) || nameWord.startsWith(districtWord)))
      )
    );

    if (hasExactWordMatch && !matches.includes(district)) {
      matches.push(district);
    }
  });

  return matches;
}

async function filterGeoJsonForArea(geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon>): Promise<GeoJSON.FeatureCollection<GeoJSON.Polygon>> {
  const areaGroups = await areaGroupsFromConfig();

  if (areaGroups.length === 0) {
    throw new Error("Area groups not found in system config. Please configure your area groups first.");
  }

  const uniqueDistricts = extractDistrictNamesFromGroups(areaGroups);

  const filteredFeatures = geojson.features
    .filter(feature => uniqueDistricts.includes(feature.properties?.LAD23NM));

  debugLog(`Filtered geojson for area: ${filteredFeatures.length} features from ${uniqueDistricts.length} unique districts (${uniqueDistricts.join(", ")})`);

  return {
    type: "FeatureCollection",
    features: filteredFeatures
  };
}

export async function uploadDefaultAreaMap(req: Request, res: Response) {
  try {
    const fullGeoJson = await loadBundledGeoJson();
    const filteredGeoJson = await filterGeoJsonForArea(fullGeoJson);

    const data = Buffer.from(JSON.stringify(filteredGeoJson));
    const timestamp = dateTimeNow().toFormat(DateFormat.FILE_TIMESTAMP);
    const key = `area-map/areas-${timestamp}.geojson`;

    const command = new PutObjectCommand({
      Bucket: envConfig.aws.bucket,
      Key: key,
      Body: data,
      ContentType: "application/geo+json"
    });

    await s3.send(command);
    cachedGeoJson = null;
    cachedGeoJsonKey = key;
    cachedS3GeoJson = null;
    debugLog(`Uploaded filtered area map with ${filteredGeoJson.features.length} features to ${key}`);
    res.status(200).json({ key, featureCount: filteredGeoJson.features.length });
  } catch (error) {
    debugLog(`Failed to upload default area map: ${error.message}`);
    res.status(500).json({ error: "Failed to upload default area map" });
  }
}

export async function areaMapKey(req: Request, res: Response) {
  try {
    const key = await resolveAreaMapKey();
    res.status(200).json({ key });
  } catch (error) {
    debugLog(`Failed to resolve area map key: ${error.message}`);
    res.status(500).json({ error: "Failed to resolve area map key" });
  }
}

export async function areaGroups(req: Request, res: Response) {
  try {
    const areaGroups = await areaGroupsFromConfig();
    res.status(200).json({ groups: areaGroups });
  } catch (error) {
    debugLog(`Failed to get area groups: ${error.message}`);
    res.status(500).json({ error: "Failed to get area groups configuration" });
  }
}

export async function availableDistricts(req: Request, res: Response) {
  try {
    debugLog("Loading active S3 geojson for districts catalogue...");
    const geojson = await loadS3GeoJson();
    debugLog(`Loaded active geojson with ${geojson.features.length} features`);

    const districts = availableDistrictList(geojson);
    debugLog(`Returning ${districts.length} districts: ${districts.slice(0, 10).join(", ")}...`);
    res.status(200).json({districts});
  } catch (error) {
    debugLog(`Failed to get available districts: ${error.message}`);
    debugLog(`Error stack: ${error.stack}`);
    const status = error.message.includes("not yet uploaded") ? 404 : 500;
    res.status(status).json({error: status === 404 ? "Area map data not yet uploaded" : "Failed to get available districts"});
  }
}

async function fetchRamblersGroups(areaCode: string): Promise<RamblersGroupsApiResponse[]> {
  if (!/^[A-Z]{2}$/.test(areaCode)) {
    return [];
  }

  if (ramblersGroupsCache.has(areaCode)) {
    const cached = ramblersGroupsCache.get(areaCode);
    return cached ? [...cached] : [];
  }

  const groups = await fetchRamblersGroupsFromApi([areaCode]);
  ramblersGroupsCache.set(areaCode, groups);
  return groups;
}

export async function previewAreaDistricts(req: Request, res: Response) {
  try {
    const geojson = await loadBundledGeoJson();
    const allDistrictsList = availableDistrictList(geojson);
    const featureIndex = await districtFeatures();
    const areaNameParam = isString(req.query.areaName) ? req.query.areaName.trim() : "";
    const areaCodeParam = isString(req.query.areaCode) ? req.query.areaCode.trim().toUpperCase() : "";

    if (!areaNameParam && !areaCodeParam) {
      return res.status(200).json({
        districts: allDistrictsList,
        featureCount: geojson.features.length
      });
    }

    if (areaCodeParam) {
      try {
        const ramblersGroups = await fetchRamblersGroups(areaCodeParam);

        const districtList = allDistrictsList;

        const inferredDistricts = new Set<string>();
        const groupDistrictMap: Record<string, string[]> = {};
        const allocatedDistricts = new Set<string>();

        ramblersGroups
          .filter(group => group.group_code !== areaCodeParam)
          .forEach(group => {
            const districts = matchDistrictsForGroup(group.name, districtList, group.latitude, group.longitude, featureIndex);
            const availableDistricts = districts.filter(d => !allocatedDistricts.has(d));
            groupDistrictMap[group.group_code] = availableDistricts;
            availableDistricts.forEach(district => {
              inferredDistricts.add(district);
              allocatedDistricts.add(district);
            });
          });

        const inferredList = Array.from(inferredDistricts).sort();
        const inferredFeatures = filterGeoJsonByDistricts(geojson, inferredList);

        return res.status(200).json({
          districts: allDistrictsList,
          featureCount: inferredFeatures.features.length,
          groupDistrictMap
        });
      } catch (error) {
        debugLog(`Failed to fetch Ramblers groups for ${areaCodeParam}: ${error.message}`);
        return res.status(502).json({ error: "Failed to fetch Ramblers groups for preview" });
      }
    }

    const areaNameLower = areaNameParam.toLowerCase();
    const config = await systemConfig();
    let districtsToUse: string[] = [];

    if (config?.area?.shortName && config.area.shortName.toLowerCase() === areaNameLower) {
      districtsToUse = extractDistrictNamesFromGroups(config.area.groups || []);
    }

    if (districtsToUse.length === 0) {
      const candidateCodes = new Set<string>();
      const upper = areaNameParam.toUpperCase();
      if (upper.length >= 2) {
        candidateCodes.add(upper.slice(0, 2));
      }
      if (upper.length >= 1) {
        const first = upper[0];
        for (const letter of ALPHABET) {
          candidateCodes.add(`${first}${letter}`);
        }
      }

      for (const code of candidateCodes) {
        try {
          const ramblersGroups = await fetchRamblersGroups(code);
          if (!ramblersGroups.length) {
            continue;
          }
          const inferredDistricts = new Set<string>();
          ramblersGroups
            .filter(group => group.group_code !== code)
            .forEach(group => {
              matchDistrictsForGroup(group.name, allDistrictsList, group.latitude, group.longitude, featureIndex).forEach(district => inferredDistricts.add(district));
            });

          if (inferredDistricts.size > 0) {
            districtsToUse = Array.from(inferredDistricts).sort();
            const inferredFeatures = filterGeoJsonByDistricts(geojson, districtsToUse);
            return res.status(200).json({
              districts: districtsToUse,
              featureCount: inferredFeatures.features.length,
              areaCode: code
            });
          }
        } catch (error) {
          debugLog(`Candidate area code ${code} lookup failed: ${error.message}`);
        }
      }
    }

    if (districtsToUse.length === 0) {
      districtsToUse = allDistrictsList.filter(d => d.toLowerCase().includes(areaNameLower));
    }

    const filteredFeatures = filterGeoJsonByDistricts(geojson, districtsToUse);

    res.status(200).json({
      districts: districtsToUse,
      featureCount: filteredFeatures.features.length
    });
  } catch (error) {
    debugLog(`Failed to preview area districts: ${error.message}`);
    res.status(500).json({ error: "Failed to preview area districts" });
  }
}

export async function configureAreaGroups(req: Request, res: Response) {
  const { groups } = req.body;

  if (!groups || !isArray(groups)) {
    return res.status(400).json({ error: "Invalid groups data" });
  }

  debugLog(`Received ${groups.length} groups to configure`);

  const processedGroups = groups.map(group => {
    const districts = isString(group.onsDistricts)
      ? group.onsDistricts.split(",").map((d: string) => d.trim()).filter((d: string) => d)
      : group.onsDistricts || [];

    return {
      groupCode: group.groupCode,
      name: group.name,
      url: group.url,
      onsDistricts: districts,
      color: group.color,
      nonGeographic: group.nonGeographic === true
    };
  });

  debugLog(`Processed groups:`, JSON.stringify(processedGroups, null, 2));

  try {
    const config: SystemConfig = await systemConfig();

    if (!config.area) {
      const defaultArea: Organisation = {
        defaultWalkListView: WalkListView.TABLE,
        walkPopulation: EventPopulation.LOCAL,
        socialEventPopulation: EventPopulation.LOCAL,
        walkContactDetailsPublic: false,
        allowSwitchWalkView: false,
        socialDetailsPublic: false,
        pages: [],
        groups: processedGroups
      };
      config.area = defaultArea;
    } else {
      config.area.groups = processedGroups;
    }

    const configController = await import("../mongo/controllers/config");
    const { ConfigKey } = await import("../../../projects/ngx-ramblers/src/app/models/config.model");

    const updateReq = {
      body: {
        key: ConfigKey.SYSTEM,
        value: config
      }
    };

    const typedUpdateReq = updateReq as Request;

    const updateRes = {
      status: (code: number) => ({
        json: (data: any) => {
          if (code === 200) {
            cachedGeoJson = null;
            cachedGeoJsonKey = null;
            debugLog(`Configured ${processedGroups.length} area groups`);
            res.status(200).json({
              message: "Area groups configured successfully",
              count: processedGroups.length
            });
          } else {
            debugLog(`Failed to configure area groups:`, data);
            res.status(500).json({
              message: "Failed to configure area groups",
              error: data
            });
          }
        }
      })
    } as unknown as Response;

    await configController.createOrUpdate(typedUpdateReq, updateRes);
  } catch (error) {
    debugLog(`Failed to configure area groups: ${error.message}`);
    debugLog(`Error stack:`, error.stack);
    res.status(500).json({
      message: "Failed to configure area groups",
      error: error.message
    });
  }
}

export async function deleteAreaMapData(req: Request, res: Response) {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: envConfig.aws.bucket,
      Prefix: "area-map/"
    });
    const listResponse = await s3.send(listCommand);
    const objects = listResponse.Contents || [];

    if (objects.length === 0) {
      return res.status(404).json({ error: "No S3 area map data found to delete" });
    }

    const deletedKeys: string[] = [];
    for (const obj of objects) {
      if (obj.Key) {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: envConfig.aws.bucket,
          Key: obj.Key
        });
        await s3.send(deleteCommand);
        deletedKeys.push(obj.Key);
        debugLog(`Deleted area map from S3: ${obj.Key}`);
      }
    }

    cachedGeoJson = null;
    cachedGeoJsonKey = null;
    cachedS3GeoJson = null;
    res.status(200).json({ message: "Area map data deleted successfully", deletedKeys });
  } catch (error) {
    debugLog(`Failed to delete area map: ${error.message}`);
    res.status(500).json({ error: "Failed to delete area map data" });
  }
}

async function resolveAreaMapKey(): Promise<string | null> {
  if (cachedGeoJsonKey) {
    return cachedGeoJsonKey;
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: envConfig.aws.bucket,
      Prefix: "area-map/"
    });
    const response = await s3.send(command);
    const objects = (response.Contents || [])
      .filter(item => !!item.Key)
      .sort((a, b) => {
        const aTime = a.LastModified ? a.LastModified.getTime() : 0;
        const bTime = b.LastModified ? b.LastModified.getTime() : 0;
        return bTime - aTime;
      });
    const latestKey = objects[0]?.Key || null;
    cachedGeoJsonKey = latestKey;
    return latestKey;
  } catch (error) {
    debugLog(`Failed to list area map objects: ${error.message}`);
    return null;
  }
}
