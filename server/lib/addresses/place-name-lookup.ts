import { LatLngLiteral } from "leaflet";
import { gridReference10From, gridReference6From, gridReference8From, parseGridReference } from "./grid-reference";
import { GridReferenceLookupApiResponse, GridReferenceLookupResponse } from "../../../projects/ngx-ramblers/src/app/models/address-model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { ApiRequest } from "../../../projects/ngx-ramblers/src/app/models/api-request.model";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import * as messageHandlers from "../shared/message-handlers";
import url from "url";
import querystring from "querystring";
import { ENDPOINT } from "./shared";
import { gridReferenceLookupFromLatLng } from "./reverse-geocode";
import proj4 from "proj4";
import { isNumber, isString } from "es-toolkit/compat";

interface PlacesLookupResult {
  name_1?: string;
  name_2?: string;
  county_unitary?: string;
  district_borough?: string;
  region?: string;
  country?: string;
  postcode?: string;
  outcode?: string;
  longitude?: number | string;
  latitude?: number | string;
  eastings?: number | string;
  northings?: number | string;
  easting?: number | string;
  northing?: number | string;
}

interface PlacesServiceResponse {
  status: number;
  error?: string;
  result?: PlacesLookupResult[];
}

const debugLog: debug.Debugger = debug(envConfig.logNamespace("place-name-lookup"));
debugLog.enabled = true;
const baseUrl = url.parse(ENDPOINT, false);
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org";
const nominatimUrl = url.parse(NOMINATIM_ENDPOINT, false);

const bngToWgs84 = proj4(
  "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.060,0.1502,0.2470,0.8421,-20.4894 +units=m +no_defs",
  "+proj=longlat +datum=WGS84 +no_defs"
);

function toDescription(place: PlacesLookupResult): string {
  return [
    place.name_1 || place.name_2,
    place.county_unitary || place.district_borough,
    place.region,
    place.country
  ].filter(Boolean).join(", ");
}

function numberFrom(value: string | number): number | null {
  if (isNumber(value) && Number.isFinite(value)) {
    return value;
  }
  if (isString(value)) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapPlaceToGridReference(place: PlacesLookupResult): GridReferenceLookupResponse {
  let gridReference6: string = null;
  let gridReference8: string = null;
  let gridReference10: string = null;
  const easting = numberFrom(place.easting ?? place.eastings);
  const northing = numberFrom(place.northing ?? place.northings);
  if (Number.isFinite(easting) && Number.isFinite(northing)) {
    try {
      gridReference6 = gridReference6From(easting, northing);
      gridReference8 = gridReference8From(easting, northing);
      gridReference10 = gridReference10From(easting, northing);
    } catch (error) {
      debugLog("mapPlaceToGridReference grid reference error", error);
    }
  }
  const latitude = numberFrom(place.latitude);
  const longitude = numberFrom(place.longitude);
  return {
    gridReference6,
    gridReference8,
    gridReference10,
    latlng: Number.isFinite(latitude) && Number.isFinite(longitude) ? {lat: latitude, lng: longitude} : undefined,
    postcode: place.postcode || place.outcode,
    description: toDescription(place)
  };
}

function placesMapper(response: PlacesServiceResponse): PlacesLookupResult[] {
  if (response?.error) {
    debugLog("placesMapper received error response:", response.error);
    return [];
  }
  return response?.result || [];
}

function selectPlace(places: PlacesLookupResult[]): PlacesLookupResult {
  return places?.[0];
}

interface NominatimPlaceResult {
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

function toNominatimPlace(response: any): NominatimPlaceResult[] {
  return Array.isArray(response) ? response : [];
}

function getPlaceTypeScore(place: NominatimPlaceResult): number {
  if (place.address?.city) return 3;
  if (place.address?.town) return 2;
  if (place.address?.village) return 1;
  return 0;
}

function selectNominatimPlace(places: NominatimPlaceResult[], preferredCounty?: string): NominatimPlaceResult | undefined {
  if (places.length === 0) {
    return undefined;
  }
  if (places.length === 1) {
    return places[0];
  }
  const ukPlaces = places.filter(place =>
    place.address?.country_code === "gb" ||
    place.display_name.includes("UK") ||
    place.display_name.includes("United Kingdom")
  );

  const placesToSearch = ukPlaces.length > 0 ? ukPlaces : places;

  return placesToSearch.slice().sort((a, b) => {
    if (preferredCounty) {
      const aMatchesCounty = a.address?.county?.toLowerCase().includes(preferredCounty.toLowerCase()) ||
                             a.display_name.toLowerCase().includes(preferredCounty.toLowerCase());
      const bMatchesCounty = b.address?.county?.toLowerCase().includes(preferredCounty.toLowerCase()) ||
                             b.display_name.toLowerCase().includes(preferredCounty.toLowerCase());
      if (aMatchesCounty && !bMatchesCounty) return -1;
      if (!aMatchesCounty && bMatchesCounty) return 1;
    }

    const placeTypeDiff = getPlaceTypeScore(b) - getPlaceTypeScore(a);
    if (placeTypeDiff !== 0) return placeTypeDiff;

    const importanceDiff = (b.importance || 0) - (a.importance || 0);
    if (Math.abs(importanceDiff) > 0.01) return importanceDiff;

    const aAdmin = [a.address?.county, a.address?.state, a.address?.region].filter(Boolean).length;
    const bAdmin = [b.address?.county, b.address?.state, b.address?.region].filter(Boolean).length;
    return bAdmin - aAdmin;
  })[0];
}

function toLatLng(place: NominatimPlaceResult): LatLngLiteral {
  return {
    lat: parseFloat(place.lat),
    lng: parseFloat(place.lon)
  };
}

function extractGridReference(response: GridReferenceLookupApiResponse): GridReferenceLookupResponse | undefined {
  const payload = response?.response;
  if (Array.isArray(payload)) {
    return payload[0];
  }
  return payload as GridReferenceLookupResponse;
}

async function lookupGridReference(query: string): Promise<{status: number; response?: GridReferenceLookupResponse}> {
  const parsed = parseGridReference(query);
  if (!parsed) {
    return {status: 400};
  }

  const {eastings, northings} = parsed;
  debugLog(`lookupGridReference: parsed ${query} to eastings=${eastings}, northings=${northings}`);

  const [lng, lat] = bngToWgs84.forward([eastings, northings]);
  debugLog(`lookupGridReference: converted to WGS84 lat=${lat}, lng=${lng}`);

  const gridReferenceResponse = await gridReferenceLookupFromLatLng({lat, lng}, undefined, undefined, debugLog);
  const gridReference = extractGridReference(gridReferenceResponse);

  if (!gridReference) {
    return {status: gridReferenceResponse?.apiStatusCode || 404};
  }

  return {
    status: gridReferenceResponse?.apiStatusCode || 200,
    response: {
      ...gridReference,
      gridReference6: gridReference6From(eastings, northings),
      gridReference8: gridReference8From(eastings, northings),
      gridReference10: gridReference10From(eastings, northings),
      latlng: {lat, lng},
      description: gridReference.description || query
    }
  };
}

async function lookupUsingPostcodes(query: string): Promise<{status: number; response?: GridReferenceLookupResponse}> {
  const placesResponse = await messageHandlers.httpRequest({
    apiRequest: {
      hostname: baseUrl.hostname,
      protocol: baseUrl.protocol,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      method: "get",
      path: `/places?q=${querystring.escape(query)}&limit=10`
    },
    mapper: placesMapper,
    successStatusCodes: [200, 404],
    res: undefined,
    req: undefined,
    debug: debugLog
  }) as {apiStatusCode: number; response: PlacesLookupResult[]};
  const place = selectPlace(placesResponse.response);
  if (!place) {
    return {status: placesResponse.apiStatusCode};
  }
  return {
    status: placesResponse.apiStatusCode,
    response: mapPlaceToGridReference(place)
  };
}

async function lookupUsingNominatim(query: string, preferredCounty?: string): Promise<{status: number; response?: GridReferenceLookupResponse}> {
  const nominatimResponse = await messageHandlers.httpRequest({
    apiRequest: {
      hostname: nominatimUrl.hostname,
      protocol: nominatimUrl.protocol,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": "ngx-ramblers-place-lookup/1.0"
      },
      method: "get",
      path: `/search?format=jsonv2&limit=5&countrycodes=gb&q=${querystring.escape(query)}`
    },
    mapper: toNominatimPlace,
    successStatusCodes: [200, 404],
    res: undefined,
    req: undefined,
    debug: debugLog
  }) as {apiStatusCode: number; response: NominatimPlaceResult[]};
  debugLog(`lookupUsingNominatim: found ${nominatimResponse.response?.length || 0} results${preferredCounty ? `, preferring county: ${preferredCounty}` : ""}`);
  const place = selectNominatimPlace(nominatimResponse.response, preferredCounty);
  if (!place) {
    return {status: nominatimResponse.apiStatusCode || 404};
  }
  debugLog(`lookupUsingNominatim: selected place: ${place.display_name}`);
  const latlng = toLatLng(place);
  const gridReferenceResponse = await gridReferenceLookupFromLatLng(latlng);
  const gridReference = extractGridReference(gridReferenceResponse);
  const merged: GridReferenceLookupResponse = {
    gridReference6: gridReference?.gridReference6,
    gridReference8: gridReference?.gridReference8,
    gridReference10: gridReference?.gridReference10,
    distance: gridReference?.distance,
    postcode: gridReference?.postcode || place.address?.postcode,
    latlng,
    description: place.display_name
  };
  return {
    status: gridReferenceResponse?.apiStatusCode || 200,
    response: merged
  };
}

export async function placeNameLookup(req, res) {
  const query = (req.query.query || "").toString().trim();
  const preferredCounty = (req.query.preferredCounty || "").toString().trim();
  const apiRequest: ApiRequest = {
    parameters: {query, preferredCounty},
    url: req.url,
    body: {}
  };
  if (!query) {
    res.status(400);
    return res.json({
      request: apiRequest,
      action: ApiAction.QUERY,
      response: {error: "Query is required"}
    });
  }
  debugLog(`placeNameLookup: query="${query}"${preferredCounty ? `, preferredCounty="${preferredCounty}"` : ""}`);
  try {
    const gridRefResult = await lookupGridReference(query);
    let status = gridRefResult.status;
    let responseBody = gridRefResult.response;
    let errorMessage;

    if (!responseBody) {
      const postcodesResult = await lookupUsingPostcodes(query);
      status = postcodesResult.status;
      responseBody = postcodesResult.response;
      if (!responseBody) {
        const fallbackResult = await lookupUsingNominatim(query, preferredCounty || undefined);
        status = fallbackResult.status;
        responseBody = fallbackResult.response;
        if (!responseBody) {
          errorMessage = fallbackResult.response?.error;
        }
      }
    }
    if (!responseBody) {
      return res.json({
        request: apiRequest,
        action: ApiAction.QUERY,
        response: {error: errorMessage || `No places found for "${query}"`}
      });
    }
    const response: GridReferenceLookupApiResponse = {
      apiStatusCode: status,
      request: apiRequest,
      action: ApiAction.QUERY,
      response: responseBody
    };
    return res.json(response);
  } catch (error: any) {
    debugLog("placeNameLookup error", error);
    res.status(500);
    return res.json({
      request: apiRequest,
      action: ApiAction.QUERY,
      response: {error: error?.message || "Place lookup failed"}
    });
  }
}
