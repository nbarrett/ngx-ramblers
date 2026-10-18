import { EPSG_27700_LEISURE_NATIVE_ZOOM } from "../common/maps/map-projection.constants";

export const LOCATE_PAGE_PATH = "locate";
export const LOCATE_DEFAULT_BASE_PATH = "walks";
export const LOCATE_PAGE_TITLE = "Locate a place";
export const UK_POSTCODE_PATTERN = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
export const LOCATE_POINT_ZOOM = EPSG_27700_LEISURE_NATIVE_ZOOM;
export const LOCATE_OVERVIEW_ZOOM = 6;
export const LOCATE_SIDEBAR_WIDTH_MIN = 352;
export const LOCATE_MAP_HEIGHT_DEFAULT = 520;
export const LOCATE_MAP_HEIGHT_MIN = 240;
export const LOCATE_MAP_HEIGHT_MAX = 1200;
export const LOCATE_OVERVIEW_CENTRE: [number, number] = [52.8, -1.8];
export const OS_MAPS_EXPLORE_URL = "https://explore.osmaps.com/";

export interface LocatePoint {
  latitude: number;
  longitude: number;
  eastings: number;
  northings: number;
  gridReference6: string;
  gridReference8: string;
  gridReference10: string;
}

export interface LocateLinkParams {
  gridRef?: string;
  postcode?: string;
  lat?: number;
  lon?: number;
  zoom?: number;
  provider?: string;
}

export const GOOGLE_MAPS_PROVIDER_LABEL = "Google Maps";

export interface LocateSuggestion {
  label: string;
  queryParams: Record<string, string>;
}

export enum DirectionsApp {
  GOOGLE_MAPS = "Google Maps",
  APPLE_MAPS = "Apple Maps",
  WAZE = "Waze"
}

export interface DirectionsLink {
  app: DirectionsApp;
  url: string;
}

export interface LocationSuggestion {
  label: string;
  description?: string;
  lat: number;
  lng: number;
  postcode?: string;
  gridReference6?: string;
  gridReference8?: string;
  gridReference10?: string;
}

export interface LocateCoordinateInputs {
  gridReference: string;
  latitude: string;
  longitude: string;
  eastings: string;
  northings: string;
}

export interface LocateSavedPoint {
  id: string;
  number: number;
  name: string;
  point: LocatePoint;
  postcode: string;
  description: string;
}

export interface LocatePinSelection {
  id: string | null;
  latitude: number;
  longitude: number;
  settled: boolean;
}

export interface LocatePointNameChange {
  id: string;
  name: string;
}

export enum LocateCoordinateFormat {
  GRID_REFERENCE = "grid-reference",
  LATITUDE_LONGITUDE = "latitude-longitude",
  EASTINGS_NORTHINGS = "eastings-northings"
}

export interface LocatePinPopup {
  title: string;
  note: string;
}
