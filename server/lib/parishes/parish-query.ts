import axios from "axios";
import debug from "debug";
import { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { dateTimeNowAsValue } from "../shared/dates";
import { ParishCacheEntry } from "../../../projects/ngx-ramblers/src/app/models/parish-map.model";

const debugLog = debug(envConfig.logNamespace("parish-query"));
debugLog.enabled = true;

const ONS_PARISH_URL = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Parishes_and_Non_Civil_Parished_Areas_December_2024_Boundaries_EW_BGC/FeatureServer/0/query";
const MAX_RECORDS_PER_REQUEST = 2000;
const MAX_BBOX_DEGREES = 3;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const cache = new Map<string, ParishCacheEntry>();

function cacheKeyFor(west: number, south: number, east: number, north: number): string {
  return `${west.toFixed(3)},${south.toFixed(3)},${east.toFixed(3)},${north.toFixed(3)}`;
}

function pruneExpiredCache() {
  const now = dateTimeNowAsValue();
  [...cache.entries()]
    .filter(([, entry]) => now - entry.timestamp > CACHE_TTL_MS)
    .forEach(([key]) => cache.delete(key));
}

async function fetchPage(west: number, south: number, east: number, north: number, offset: number): Promise<{ features: GeoJSON.Feature[]; hasMore: boolean }> {
  const response = await axios.get(ONS_PARISH_URL, {
    params: {
      where: "1=1",
      geometry: `${west},${south},${east},${north}`,
      geometryType: "esriGeometryEnvelope",
      inSR: 4326,
      spatialRel: "esriSpatialRelIntersects",
      outFields: "PARNCP24CD,PARNCP24NM",
      f: "geojson",
      outSR: 4326,
      resultRecordCount: MAX_RECORDS_PER_REQUEST,
      resultOffset: offset
    },
    timeout: 60000
  });

  const data = response.data;
  return {
    features: data.features || [],
    hasMore: data.exceededTransferLimit === true
  };
}

async function fetchAllPages(west: number, south: number, east: number, north: number, accumulated: GeoJSON.Feature[] = [], offset = 0): Promise<GeoJSON.Feature[]> {
  const page = await fetchPage(west, south, east, north, offset);
  const allFeatures = [...accumulated, ...page.features];
  debugLog(`Fetched ${allFeatures.length} parishes so far (offset: ${offset}, hasMore: ${page.hasMore})`);

  if (page.hasMore) {
    return fetchAllPages(west, south, east, north, allFeatures, offset + MAX_RECORDS_PER_REQUEST);
  }
  return allFeatures;
}

export async function queryParishes(req: Request, res: Response) {
  try {
    const west = parseFloat(req.query.west as string);
    const south = parseFloat(req.query.south as string);
    const east = parseFloat(req.query.east as string);
    const north = parseFloat(req.query.north as string);

    if ([west, south, east, north].some(isNaN)) {
      return res.status(400).json({error: "Missing or invalid bounding box parameters (west, south, east, north)"});
    }

    const latSpan = Math.abs(north - south);
    const lngSpan = Math.abs(east - west);
    if (latSpan > MAX_BBOX_DEGREES || lngSpan > MAX_BBOX_DEGREES) {
      return res.status(400).json({
        error: `Bounding box too large (${latSpan.toFixed(1)}° x ${lngSpan.toFixed(1)}°). Maximum is ${MAX_BBOX_DEGREES}° in each dimension. Please zoom in.`
      });
    }

    const noCache = req.query.noCache === "true";
    if (noCache) {
      cache.clear();
      debugLog("Cache cleared by request");
    }

    pruneExpiredCache();
    const key = cacheKeyFor(west, south, east, north);
    const cached = cache.get(key);
    const now = dateTimeNowAsValue();

    if (!noCache && cached && now - cached.timestamp < CACHE_TTL_MS) {
      debugLog(`Cache hit for ${key}: ${cached.data.features.length} parishes`);
      return res.json(cached.data);
    }

    const startTime = dateTimeNowAsValue();
    debugLog(`Querying ONS parish API for bounds: ${west},${south},${east},${north}`);
    const features = await fetchAllPages(west, south, east, north);
    const result: GeoJSON.FeatureCollection = {type: "FeatureCollection", features};
    const elapsed = dateTimeNowAsValue() - startTime;
    debugLog(`Fetched ${features.length} parishes from ONS in ${elapsed}ms`);

    cache.set(key, {data: result, timestamp: now});
    res.json(result);
  } catch (error) {
    debugLog(`Error querying parishes: ${error.message}`);
    res.status(500).json({error: "Failed to fetch parish boundaries from ONS"});
  }
}
