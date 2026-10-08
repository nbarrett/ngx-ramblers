import { Request, Response } from "express";
import debug from "debug";
import { isNumber } from "es-toolkit/compat";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import { GridReferenceLookupResponse } from "../../../projects/ngx-ramblers/src/app/models/address-model";
import { DrivingDistanceResponse } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { envConfig } from "../env-config/env-config";
import * as config from "../mongo/controllers/config";
import * as systemConfig from "../config/system-config";
import { postcodeLookupFromPostcodesIo } from "../addresses/postcode-lookup";
import { placeLookupResponse } from "../addresses/place-name-lookup";

const debugLog = debug(envConfig.logNamespace("google-maps"));
debugLog.enabled = false;

const METRES_PER_MILE = 1609.344;
const DISTANCE_MATRIX_URL = "https://maps.googleapis.com/maps/api/distancematrix/json";

interface DistanceMatrixElement {
  status?: string;
  distance?: {text?: string; value?: number};
}

interface DistanceMatrixResponse {
  status?: string;
  error_message?: string;
  rows?: {elements?: DistanceMatrixElement[]}[];
}

export function milesFromMetres(metres: number): number {
  return Math.round((metres / METRES_PER_MILE) * 10) / 10;
}

export function drivingMilesFromMatrix(body: DistanceMatrixResponse): DrivingDistanceResponse {
  const element = body?.rows?.[0]?.elements?.[0];
  const metres = element?.distance?.value;
  if (body?.status === "OK" && element?.status === "OK" && isNumber(metres)) {
    return {miles: milesFromMetres(metres), metres};
  } else {
    return {
      miles: null,
      metres: null,
      error: element?.status || body?.error_message || body?.status || "No driving route"
    };
  }
}

export async function googleMapsConfig(req: Request, res: Response): Promise<void> {
  try {
    const system = await config.queryKeyProjected(ConfigKey.SYSTEM, config.SYSTEM_GEOMETRY_EXCLUSION);
    const googleMaps = system?.value?.googleMaps;
    if (googleMaps?.apiKey) {
      debugLog("Using Google Maps config from database");
      res.send(googleMaps);
    } else {
      debugLog("No Google Maps API key configured in database");
      res.send({apiKey: null});
    }
  } catch (error) {
    debugLog("Error fetching Google Maps config:", error);
    res.send({apiKey: null});
  }
}

function queryNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function drivingDistance(req: Request, res: Response): Promise<void> {
  const from = (req.query.from || "").toString().trim();
  const to = (req.query.to || "").toString().trim();
  if (!from || !to) {
    res.status(400).json({miles: null, metres: null, error: "From and To are both needed"} as DrivingDistanceResponse);
  } else {
    try {
      const system = await systemConfig.systemConfig();
      const apiKey = system?.googleMaps?.apiKey;
      const googleMiles = apiKey
        ? await requestDrivingDistance(from, to, apiKey).then(drivingMilesFromMatrix).catch(() => ({miles: null, metres: null} as DrivingDistanceResponse))
        : {miles: null, metres: null};
      if (isNumber(googleMiles.miles)) {
        res.json({...googleMiles, from, to});
      } else {
        const osrm = await osrmDrivingDistance(
          from,
          to,
          queryNumber(req.query.fromLat),
          queryNumber(req.query.fromLng),
          queryNumber(req.query.toLat),
          queryNumber(req.query.toLng)
        );
        res.json({...osrm, from, to});
      }
    } catch (error) {
      debugLog("drivingDistance error:", error);
      res.status(502).json({miles: null, metres: null, from, to, error: "Could not calculate driving distance"} as DrivingDistanceResponse);
    }
  }
}

async function travelPointLatLng(query: string, latitude: number | null, longitude: number | null): Promise<{lat: number; lng: number} | null> {
  if (isNumber(latitude) && isNumber(longitude)) {
    return {lat: latitude, lng: longitude};
  } else {
    const postcodePlace = await postcodeLookupFromPostcodesIo(query);
    const postcodeLookup = postcodePlace?.response as GridReferenceLookupResponse;
    if (postcodeLookup?.latlng) {
      return postcodeLookup.latlng;
    } else {
      const place = await placeLookupResponse(query);
      return place?.latlng || null;
    }
  }
}

async function osrmDrivingDistance(
  from: string,
  to: string,
  fromLat: number | null,
  fromLng: number | null,
  toLat: number | null,
  toLng: number | null
): Promise<DrivingDistanceResponse> {
  const fromLookup = await travelPointLatLng(from, fromLat, fromLng);
  const toLookup = await travelPointLatLng(to, toLat, toLng);
  if (!fromLookup || !toLookup) {
    return {miles: null, metres: null, error: "Could not locate From or To"};
  } else {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLookup.lng},${fromLookup.lat};${toLookup.lng},${toLookup.lat}?overview=false`;
    const response = await fetch(url);
    const body = await response.json() as {routes?: {distance?: number}[]};
    const metres = body?.routes?.[0]?.distance;
    if (isNumber(metres)) {
      return {miles: milesFromMetres(metres), metres};
    } else {
      return {miles: null, metres: null, error: "No driving route"};
    }
  }
}

export async function requestDrivingDistance(from: string, to: string, apiKey: string): Promise<DistanceMatrixResponse> {
  const params = new URLSearchParams({
    origins: from,
    destinations: to,
    mode: "driving",
    units: "imperial",
    region: "uk",
    key: apiKey
  });
  debugLog("drivingDistance request:", from, "->", to);
  const response = await fetch(`${DISTANCE_MATRIX_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Distance Matrix HTTP ${response.status}`);
  } else {
    return response.json() as Promise<DistanceMatrixResponse>;
  }
}
