import { LatLngLiteral } from "leaflet";
import {
  GridReferenceLookupApiResponse,
  GridReferenceLookupResponse,
  NominatimLookupOptions,
  NominatimLookupResult,
  NominatimPlaceResult
} from "../../../projects/ngx-ramblers/src/app/models/address-model";
import * as messageHandlers from "../shared/message-handlers";
import url from "url";
import querystring from "querystring";
import { isArray } from "es-toolkit/compat";
import { gridReferenceLookupFromLatLng } from "./reverse-geocode";

export const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org";
const nominatimUrl = url.parse(NOMINATIM_ENDPOINT, false);

const NOMINATIM_REQUEST_SPACING_MILLISECONDS = 1100;

const nominatimThrottle: { chain: Promise<void> } = { chain: Promise.resolve() };

function throttledNominatimRequest<T>(lookup: () => Promise<T>): Promise<T> {
  const result = nominatimThrottle.chain.then(lookup);
  nominatimThrottle.chain = result
    .catch(() => undefined)
    .then(() => new Promise<void>(resolve => setTimeout(resolve, NOMINATIM_REQUEST_SPACING_MILLISECONDS)));
  return result;
}

function toNominatimPlace(response: any): NominatimPlaceResult[] {
  return isArray(response) ? response : [];
}

function placeTypeScore(place: NominatimPlaceResult): number {
  if (place.address?.city) return 3;
  if (place.address?.town) return 2;
  if (place.address?.village) return 1;
  return 0;
}

export function selectNominatimPlace(places: NominatimPlaceResult[], preferredCounty?: string): NominatimPlaceResult | undefined {
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

    const placeTypeDiff = placeTypeScore(b) - placeTypeScore(a);
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

export function extractGridReference(response: GridReferenceLookupApiResponse): GridReferenceLookupResponse | undefined {
  const payload = response?.response;
  if (isArray(payload)) {
    return payload[0];
  }
  return payload as GridReferenceLookupResponse;
}

export async function nominatimGridReferenceLookup(options: NominatimLookupOptions): Promise<NominatimLookupResult> {
  const {query, preferredCounty, userAgent, logPrefix, debugLog} = options;
  const nominatimResponse = await throttledNominatimRequest(() => messageHandlers.httpRequest({
    apiRequest: {
      hostname: nominatimUrl.hostname,
      protocol: nominatimUrl.protocol,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "User-Agent": userAgent
      },
      method: "get",
      path: `/search?format=jsonv2&limit=5&countrycodes=gb&q=${querystring.escape(query)}`
    },
    mapper: toNominatimPlace,
    successStatusCodes: [200, 404],
    res: undefined,
    req: undefined,
    debug: debugLog
  })) as { apiStatusCode: number; response: NominatimPlaceResult[] };
  debugLog(`${logPrefix}: Nominatim returned ${nominatimResponse.response?.length || 0} results for "${query}"${preferredCounty ? ` (preferring ${preferredCounty})` : ""}`);
  const place = selectNominatimPlace(nominatimResponse.response, preferredCounty);
  if (!place) {
    debugLog(`${logPrefix}: no suitable place found for "${query}"`);
    return {apiStatusCode: nominatimResponse.apiStatusCode || 404};
  }
  debugLog(`${logPrefix}: selected "${place.display_name}" at lat=${place.lat}, lng=${place.lon}`);
  const latlng = toLatLng(place);
  const gridReferenceResponse = await gridReferenceLookupFromLatLng(latlng);
  const gridReference = extractGridReference(gridReferenceResponse);
  return {
    apiStatusCode: gridReferenceResponse?.apiStatusCode || 200,
    response: {
      gridReference6: gridReference?.gridReference6,
      gridReference8: gridReference?.gridReference8,
      gridReference10: gridReference?.gridReference10,
      distance: gridReference?.distance,
      postcode: gridReference?.postcode || place.address?.postcode,
      latlng,
      description: place.display_name
    }
  };
}
