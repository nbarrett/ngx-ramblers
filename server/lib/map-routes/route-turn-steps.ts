import { Request, Response } from "express";
import debug from "debug";
import { DOMParser } from "@xmldom/xmldom";
import { envConfig } from "../env-config/env-config";
import { objectBufferForKey } from "../aws/aws-controllers";
import proj4 from "proj4";
import { isArray, isString } from "es-toolkit/compat";
import { LocatedPlace, RouteFollowPoint, RouteTurnStep, RouteTurnStepsRequest, RouteTurnStepsResponse, RouteWayNamesSource, ValhallaTraceAttributes } from "../../../projects/ngx-ramblers/src/app/models/route-follow.model";
import { attachNarrative, namesFromValhallaTrace, placeNameCandidates, routeTurnSteps, stepIndicesForPlace } from "../../../projects/ngx-ramblers/src/app/functions/route-turns";
import { EPSG_27700_PROJ4 } from "../../../projects/ngx-ramblers/src/app/common/maps/map-projection.constants";
import * as systemConfig from "../config/system-config";
import { NOMINATIM_ENDPOINT } from "../addresses/nominatim-lookup";

const debugLog = debug(envConfig.logNamespace("route-turn-steps"));
debugLog.enabled = true;
const DEFAULT_VALHALLA_BASE_URL = "https://valhalla1.openstreetmap.de";
const VALHALLA_TIMEOUT_MS = 15000;
const OS_NAMES_ENDPOINT = "https://api.os.uk/search/names/v1/find";
const PLACE_LOOKUP_TIMEOUT_MS = 8000;
const MAX_PLACE_LOOKUPS = 30;
const NOMINATIM_SPACING_MS = 1100;
const BOUNDS_PADDING_DEGREES = 0.015;
const USER_AGENT = "ngx-ramblers route turn steps";
const bngToWgs84 = proj4(`${EPSG_27700_PROJ4} +type=crs`, "EPSG:4326");
const wgs84ToBng = proj4("EPSG:4326", `${EPSG_27700_PROJ4} +type=crs`);

export function valhallaBaseUrl(): string {
  return (process.env.VALHALLA_BASE_URL || DEFAULT_VALHALLA_BASE_URL).replace(/\/$/, "");
}

export const MAX_TURN_POINTS = 20000;

export function thinnedTrack(points: RouteFollowPoint[], maxPoints = MAX_TURN_POINTS): RouteFollowPoint[] {
  const stride = Math.ceil(points.length / maxPoints);
  return stride <= 1 ? points : points.filter((point, index) => index % stride === 0 || index === points.length - 1);
}

export function trackPointsFromGpx(gpx: string): RouteFollowPoint[] {
  const document = new DOMParser().parseFromString(gpx, "text/xml");
  const elements = document.getElementsByTagName("trkpt");
  return Array.from({length: elements.length}, (_, index) => elements.item(index))
    .map(element => ({latitude: parseFloat(element?.getAttribute("lat") || ""), longitude: parseFloat(element?.getAttribute("lon") || "")}))
    .filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
}

function gpxKeyFor(request: RouteTurnStepsRequest): string {
  const rootFolder = request.gpxFile?.rootFolder;
  const awsFileName = request.gpxFile?.awsFileName || "";
  return rootFolder && !awsFileName.startsWith(`${rootFolder}/`) ? `${rootFolder}/${awsFileName}` : awsFileName;
}

export async function valhallaTraceAttributes(points: RouteFollowPoint[]): Promise<ValhallaTraceAttributes | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VALHALLA_TIMEOUT_MS);
  try {
    const response = await fetch(`${valhallaBaseUrl()}/trace_attributes`, {
      method: "POST",
      signal: controller.signal,
      headers: {"Content-Type": "application/json", "User-Agent": "ngx-ramblers route turn steps"},
      body: JSON.stringify({
        shape: points.map(point => ({lat: point.latitude, lon: point.longitude})),
        costing: "pedestrian",
        shape_match: "map_snap",
        trace_options: {search_radius: 40, gps_accuracy: 20, breakage_distance: 400, interpolation_distance: 15},
        filters: {attributes: ["edge.names", "edge.use", "matched.edge_index", "matched.type"], action: "include"}
      })
    });
    if (!response.ok) {
      debugLog("valhalla trace_attributes returned", response.status, await response.text());
      return null;
    } else {
      return await response.json() as ValhallaTraceAttributes;
    }
  } catch (error) {
    debugLog("valhalla trace_attributes failed:", error?.message || error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function routeBounds(points: RouteFollowPoint[]): {south: number; north: number; west: number; east: number} {
  const latitudes = points.map(point => point.latitude);
  const longitudes = points.map(point => point.longitude);
  return {
    south: Math.min(...latitudes) - BOUNDS_PADDING_DEGREES,
    north: Math.max(...latitudes) + BOUNDS_PADDING_DEGREES,
    west: Math.min(...longitudes) - BOUNDS_PADDING_DEGREES,
    east: Math.max(...longitudes) + BOUNDS_PADDING_DEGREES
  };
}

async function fetchJson(url: string): Promise<{status: number; body: any}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLACE_LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, {signal: controller.signal, headers: {"User-Agent": USER_AGENT, Accept: "application/json"}});
    const body = response.ok ? await response.json() : null;
    return {status: response.status, body};
  } catch (error) {
    debugLog("place lookup failed for", url.replace(/key=[^&]+/, "key=…"), error?.message || error);
    return {status: 0, body: null};
  } finally {
    clearTimeout(timer);
  }
}

async function osNamesLookup(name: string, bounds: {south: number; north: number; west: number; east: number}, apiKey: string): Promise<{status: number; place: LocatedPlace | null}> {
  const [minX, minY] = wgs84ToBng.forward([bounds.west, bounds.south]);
  const [maxX, maxY] = wgs84ToBng.forward([bounds.east, bounds.north]);
  const boundsParameter = [minX, minY, maxX, maxY].map(value => Math.round(value)).join(",");
  const result = await fetchJson(`${OS_NAMES_ENDPOINT}?query=${encodeURIComponent(name)}&maxresults=1&bounds=${boundsParameter}&key=${encodeURIComponent(apiKey)}`);
  const entry = result.body?.results?.[0]?.GAZETTEER_ENTRY;
  if (entry?.GEOMETRY_X !== undefined && entry?.GEOMETRY_Y !== undefined) {
    const [longitude, latitude] = bngToWgs84.forward([Number(entry.GEOMETRY_X), Number(entry.GEOMETRY_Y)]);
    return {status: result.status, place: {name, latitude, longitude}};
  } else {
    return {status: result.status, place: null};
  }
}

async function nominatimLookup(name: string, bounds: {south: number; north: number; west: number; east: number}): Promise<LocatedPlace | null> {
  const viewbox = `${bounds.west},${bounds.north},${bounds.east},${bounds.south}`;
  const result = await fetchJson(`${NOMINATIM_ENDPOINT}/search?format=jsonv2&limit=1&countrycodes=gb&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(name)}`);
  const first = isArray(result.body) ? result.body[0] : null;
  return first?.lat && first?.lon ? {name, latitude: Number(first.lat), longitude: Number(first.lon)} : null;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export async function locatePlaces(names: string[], points: RouteFollowPoint[]): Promise<LocatedPlace[]> {
  const bounds = routeBounds(points);
  const config = await systemConfig.systemConfig();
  const apiKey = config?.externalSystems?.osMaps?.apiKey;
  const candidates = names.slice(0, MAX_PLACE_LOOKUPS);
  const state = {osAvailable: !!apiKey, located: [] as LocatedPlace[]};
  await candidates.reduce(async (previous, name) => {
    await previous;
    const osResult = state.osAvailable ? await osNamesLookup(name, bounds, apiKey) : {status: 0, place: null};
    state.osAvailable = state.osAvailable && (osResult.status === 200 || osResult.status === 0);
    if (osResult.place) {
      state.located.push(osResult.place);
    } else if (!state.osAvailable) {
      await delay(NOMINATIM_SPACING_MS);
      const place = await nominatimLookup(name, bounds);
      if (place) {
        state.located.push(place);
      }
    }
  }, Promise.resolve());
  debugLog("located", state.located.length, "of", candidates.length, "place names using", state.osAvailable ? "OS Names" : "Nominatim");
  return state.located;
}

export async function notesForSteps(directions: string[], steps: RouteTurnStep[], points: RouteFollowPoint[]): Promise<{notes: string[]; placesLocated: number; placesTried: number; places: LocatedPlace[]}> {
  const names = directions.flatMap(placeNameCandidates).filter((name, index, all) => all.indexOf(name) === index);
  const located = (names.length > 0 ? await locatePlaces(names, points) : [])
    .map(place => ({...place, stepIndices: stepIndicesForPlace(points, steps, place)}));
  const locate = (sentence: string): number[] => {
    const mentioned = placeNameCandidates(sentence).map(name => name.toLowerCase());
    return located
      .filter(candidate => mentioned.includes(candidate.name.toLowerCase()))
      .flatMap(candidate => candidate.stepIndices || []);
  };
  return {notes: attachNarrative(directions, steps, locate), placesLocated: located.length, placesTried: Math.min(names.length, MAX_PLACE_LOOKUPS), places: located};
}

export async function routeTurnStepsHandler(req: Request, res: Response): Promise<void> {
  const request = req.body as RouteTurnStepsRequest;
  const key = gpxKeyFor(request);
  if (!key) {
    res.status(400).json({message: "A GPX file is required"});
  } else {
    try {
      const gpx = (await objectBufferForKey(key)).toString("utf8");
      const points = thinnedTrack(trackPointsFromGpx(gpx));
      if (points.length < 2) {
        res.status(400).json({message: "The GPX file has no track to follow"});
      } else {
        const trace = await valhallaTraceAttributes(points);
        const wayNames = namesFromValhallaTrace(trace, points.length);
        const steps = routeTurnSteps(points, wayNames);
        const directions = isArray(request.directions) ? request.directions.filter(direction => isString(direction)) : [];
        const narrative = directions.length > 0 ? await notesForSteps(directions, steps, points) : null;
        const response: RouteTurnStepsResponse = {
          steps,
          pointCount: points.length,
          namedPointCount: wayNames.filter(way => !!way).length,
          namesSource: trace ? RouteWayNamesSource.VALHALLA : RouteWayNamesSource.NONE,
          ...(narrative ? {notes: narrative.notes, placesLocated: narrative.placesLocated, placesTried: narrative.placesTried, places: narrative.places} : {})
        };
        debugLog("turn steps for", key, "points:", points.length, "named:", response.namedPointCount, "steps:", response.steps.length);
        res.json(response);
      }
    } catch (error) {
      debugLog("routeTurnStepsHandler failed for", key, error);
      res.status(500).json({message: error?.message || "Could not work out the turns for this route"});
    }
  }
}
