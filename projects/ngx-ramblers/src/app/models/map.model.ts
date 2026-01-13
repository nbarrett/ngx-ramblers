import { MapRoute } from "./content-text.model";
import { GeocodeMatchType } from "./address-model";
import { values } from "es-toolkit/compat";

export enum MapProvider {
  OSM = "osm",
  OS = "os"
}

export enum OSMapStyleKey {
  LEISURE_27700 = "LEISURE_27700",
  LEISURE_3857 = "LEISURE_3857",
  OUTDOOR_27700 = "OUTDOOR_27700",
  OUTDOOR_3857 = "OUTDOOR_3857",
  LIGHT_27700 = "LIGHT_27700",
  LIGHT_3857 = "LIGHT_3857",
  ROAD_27700 = "ROAD_27700",
  ROAD_3857 = "ROAD_3857",
}

export type MapStyleInfo = {
  key: string;
  name: string;
  description: string;
  is27700: boolean;
  is3857: boolean;
};

function createOsStyleInfo(key: string, name: string, description: string): MapStyleInfo {
  const is27700 = key.endsWith("_27700");
  const is3857 = key.endsWith("_3857");
  return {key, name, description, is27700, is3857};
}

export const OSMapStyle: Record<OSMapStyleKey, MapStyleInfo> = {
  [OSMapStyleKey.LEISURE_27700]: createOsStyleInfo(
    "Leisure_27700",
    "OS Explorer (1:25,000)",
    "Colorful style based on OS Explorer maps, ideal for parks and leisure activities in the UK."
  ),
  [OSMapStyleKey.LEISURE_3857]: createOsStyleInfo(
    "Leisure_3857",
    "Leisure Explorer (Web Mercator)",
    "Same colorful leisure style, optimized for web and global viewing."
  ),
  [OSMapStyleKey.OUTDOOR_27700]: createOsStyleInfo(
    "Outdoor_27700",
    "OS Outdoor",
    "Traditional outdoor map with paths and contours, perfect for hiking in the UK."
  ),
  [OSMapStyleKey.OUTDOOR_3857]: createOsStyleInfo(
    "Outdoor_3857",
    "Outdoor Trails (Web Mercator)",
    "Outdoor-focused map with trail details, ready for web applications."
  ),
  [OSMapStyleKey.LIGHT_27700]: createOsStyleInfo(
    "Light_27700",
    "OS Light",
    "Subtle, clean base map highlighting key features."
  ),
  [OSMapStyleKey.LIGHT_3857]: createOsStyleInfo(
    "Light_3857",
    "Minimal Light (Web Mercator)",
    "Light and simple style for versatile web mapping."
  ),
  [OSMapStyleKey.ROAD_27700]: createOsStyleInfo(
    "Road_27700",
    "OS Road (1:250,000)",
    "Road-focused map for navigation and driving in the UK."
  ),
  [OSMapStyleKey.ROAD_3857]: createOsStyleInfo(
    "Road_3857",
    "Road Navigator (Web Mercator)",
    "Clear road emphasis, suitable for online route planning."
  )
} as const;

export const OS_STYLE_BY_KEY: Record<string, MapStyleInfo> = values(OSMapStyle).reduce((acc, style) => {
  acc[style.key] = style;
  return acc;
}, {} as Record<string, MapStyleInfo>);

export function osStyleForKey(key?: string | null): MapStyleInfo | undefined {
  return key ? OS_STYLE_BY_KEY[key] : undefined;
}

export const OS_MAP_STYLE_LIST: MapStyleInfo[] = values(OSMapStyle).filter(s => s.is27700);
export const DEFAULT_OS_STYLE = OSMapStyle[OSMapStyleKey.LEISURE_27700].key;
export const OUTDOOR_OS_STYLE = OSMapStyle[OSMapStyleKey.OUTDOOR_27700].key;

export type ExtractedLocationType = GeocodeMatchType.POSTCODE | GeocodeMatchType.GRID_REFERENCE | GeocodeMatchType.PLACE_NAME;

export interface ExtractedLocation {
  type: ExtractedLocationType;
  value: string;
  context?: string;
}

export interface TrackWithBounds {
  track: any;
  bounds: any;
}

export interface RouteGpxData {
  tracks: any[];
  tracksWithBounds: TrackWithBounds[];
  waypoints: any[];
  totalFeatures: number;
}

export interface MapRouteViewModel extends MapRoute {
  gpxFileUrl?: string;
}

export interface GeocodeResult {
  label: string;
  lat: number;
  lng: number;
  district?: string;
  county?: string;
  type?: string;
}

export const MAP_VIEW_SELECT: Record<string, number> = {
    groupEvent: 1,
    fields: 1,
    "events.eventType": 1,
    "events.date": 1,
    "events.reason": 1,
    "events.memberId": 1
};
