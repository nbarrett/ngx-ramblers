import { ApiResponse } from "./api-response.model";
import { LatLngLiteral } from "leaflet";

export interface PostcodeLookupResult {
  distance: number;
  postcode: string;
  quality: number;
  eastings: number;
  northings: number;
  country: string;
  nhs_ha: string;
  longitude: number;
  latitude: number;
  european_electoral_region: string;
  primary_care_trust: string;
  region: string;
  lsoa: string;
  msoa: string;
  incode: string;
  outcode: string;
  parliamentary_constituency: string;
  admin_district: string;
  parish: string;
  admin_county: string;
  admin_ward: string;
  ced: string;
  ccg: string;
  nuts: string;
  pfa: string;
  codes: {
    admin_district: string;
    admin_county: string;
    admin_ward: string;
    parish: string;
    parliamentary_constituency: string;
    ccg: string;
    ccg_id: string;
    ced: string;
    nuts: string;
    lsoa: string;
    msoa: string;
    lau2: string;
  };
}

export interface PostcodeLookupServiceResponse {
  status: number,
  error?: string;
  result: PostcodeLookupResult | PostcodeLookupResult[];
}

export interface PostcodeLookupResponse {
  distance: number;
  postcode: string;
  eastings: number;
  northings: number;
  longitude: number;
  latitude: number;
  description: string;
  status?: number;
  error?: string;
}

export interface GridReferenceLookupResponse {
  description: string;
  latlng?: LatLngLiteral;
  distance?: number;
  postcode?: string;
  gridReference6?: string;
  gridReference8?: string;
  gridReference10?: string;
  error?: string;
}

export interface GridReferenceLookupApiResponse extends ApiResponse {
  request: any;
  response?: GridReferenceLookupResponse | GridReferenceLookupResponse[];
}

export enum GeocodeMatchType {
  COORDINATES = "coordinates",
  POSTCODE = "postcode",
  GRID_REFERENCE = "grid-reference",
  PLACE_NAME = "place-name",
  TITLE_EXTRACTION = "title-extraction",
  START_LOCATION = "start-location"
}

export enum GeocodeSourceField {
  TITLE = "title",
  DESCRIPTION = "description"
}

export interface GeocodeMatchData {
  matchType: GeocodeMatchType;
  sourceField: GeocodeSourceField;
  sourceText: string;
}

export interface NominatimPlaceResult {
  display_name: string;
  lat: string;
  lon: string;
  importance?: number;
  address?: {
    postcode?: string;
    country_code?: string;
    county?: string;
    state?: string;
    region?: string;
    city?: string;
    town?: string;
    village?: string;
  };
}
