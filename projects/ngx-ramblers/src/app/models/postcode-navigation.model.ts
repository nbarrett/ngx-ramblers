import { LatLngLiteral } from "leaflet";
import { LocationDetails } from "./ramblers-walks-manager";

export const POSTCODE_WARNING_DISTANCE_METRES = 200;
export const POSTCODE_ROUTE_CHECK_MINIMUM_METRES = 50;
export const POSTCODE_DETOUR_MINIMUM_METRES = 1000;
export const POSTCODE_DETOUR_RATIO = 3;

export enum PostcodeNavigationStatus {
  CLOSE = "close",
  DETOUR = "detour",
  INVALID = "invalid",
  MISSING = "missing",
  SEPARATED = "separated",
  UNAVAILABLE = "unavailable"
}

export enum PostcodeRoadCheckStatus {
  CHECKING = "checking",
  FOUND = "found",
  NOT_CHECKED = "not-checked",
  UNAVAILABLE = "unavailable"
}

export interface PostcodeNavigationCheck {
  status: PostcodeNavigationStatus;
  location: LocationDetails;
  postcode: string | null;
  postcodePoint: LatLngLiteral | null;
  separationMetres: number | null;
  drivingMetres: number | null;
  roadStatus: PostcodeRoadCheckStatus;
}

export interface PostcodeMapPreview {
  latitude: number;
  longitude: number;
  postcode: string;
}
