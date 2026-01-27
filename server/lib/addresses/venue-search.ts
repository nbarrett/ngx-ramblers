import debug from "debug";
import { envConfig } from "../env-config/env-config";
import * as messageHandlers from "../shared/message-handlers";
import url from "url";
import querystring from "querystring";
import { isNumber, isString, isEmpty } from "es-toolkit/compat";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("venue-search"));
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org";
const nominatimUrl = url.parse(NOMINATIM_ENDPOINT, false);

interface NominatimSearchResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  class: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name: string;
  display_name: string;
  address?: {
    amenity?: string;
    house_number?: string;
    road?: string;
    village?: string;
    town?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

export interface VenueSearchResult {
  name: string;
  address1: string | null;
  address2: string | null;
  postcode: string | null;
  lat: number;
  lon: number;
  type: string;
  source: "nominatim";
  displayName: string;
}

function inferVenueType(name: string, osmType: string): string {
  const nameLower = (name || "").toLowerCase();
  const typeLower = (osmType || "").toLowerCase();

  if (typeLower === "pub" || nameLower.includes("pub") || nameLower.includes("inn") ||
      nameLower.includes("tavern") || nameLower.includes("arms") || nameLower.includes("hotel")) {
    return "pub";
  }
  if (typeLower === "cafe" || nameLower.includes("cafe") || nameLower.includes("café") ||
      nameLower.includes("coffee")) {
    return "cafe";
  }
  if (typeLower === "restaurant" || nameLower.includes("restaurant") ||
      nameLower.includes("bistro") || nameLower.includes("kitchen")) {
    return "restaurant";
  }
  if (nameLower.includes("hall") || nameLower.includes("centre") || nameLower.includes("center")) {
    return "hall";
  }
  if (nameLower.includes("church") || nameLower.includes("chapel")) {
    return "church";
  }
  if (nameLower.includes("station") || nameLower.includes("railway")) {
    return "station";
  }
  if (nameLower.includes("car park") || nameLower.includes("parking")) {
    return "car park";
  }
  return "other";
}

function parseNominatimResult(result: NominatimSearchResult): VenueSearchResult | null {
  if (!result.name || !result.lat || !result.lon) {
    return null;
  }

  const address = result.address || {};
  const roadParts = [address.house_number, address.road].filter(Boolean);
  const address1 = roadParts.length > 0 ? roadParts.join(" ") : null;
  const address2 = address.village || address.town || address.city || null;

  return {
    name: result.name,
    address1,
    address2,
    postcode: address.postcode || null,
    lat: parseFloat(result.lat),
    lon: parseFloat(result.lon),
    type: inferVenueType(result.name, result.type),
    source: "nominatim",
    displayName: result.display_name
  };
}

function toNominatimResults(response: unknown): NominatimSearchResult[] {
  return Array.isArray(response) ? response : [];
}

export async function venueSearch(req, res) {
  const query = (req.query.q || req.query.query || "").toString().trim();
  const lat = parseFloat(req.query.lat) || null;
  const lon = parseFloat(req.query.lon) || null;
  const limit = Math.min(parseInt(req.query.limit) || 10, 20);

  if (!query || query.length < 2) {
    return res.status(400).json({
      error: "Query must be at least 2 characters"
    });
  }

  const queryLower = query.toLowerCase();
  const hasPubKeyword = ["pub", "inn", "tavern", "bar", "hotel", "arms", "cafe", "restaurant", "hall"].some(k => queryLower.includes(k));
  const searchQuery = hasPubKeyword ? query : `${query} pub`;

  debugLog(`venueSearch: query="${query}", searchQuery="${searchQuery}", lat=${lat}, lon=${lon}, limit=${limit}`);

  try {
    const hasLocation = isNumber(lat) && isNumber(lon) && Number.isFinite(lat) && Number.isFinite(lon);

    const performSearch = async (bounded: boolean): Promise<NominatimSearchResult[]> => {
      const searchParams = new URLSearchParams({
        format: "jsonv2",
        addressdetails: "1",
        limit: limit.toString(),
        countrycodes: "gb",
        q: query
      });

      if (hasLocation) {
        const viewboxDelta = 0.25;
        searchParams.set("viewbox", `${lon - viewboxDelta},${lat + viewboxDelta},${lon + viewboxDelta},${lat - viewboxDelta}`);
        searchParams.set("bounded", bounded ? "1" : "0");
      }

      const searchPath = `/search?${searchParams.toString()}`;
      debugLog(`venueSearch: Nominatim path: ${searchPath}`);

      const nominatimResponse = await messageHandlers.httpRequest({
        apiRequest: {
          hostname: nominatimUrl.hostname,
          protocol: nominatimUrl.protocol,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "ngx-ramblers-venue-search/1.0"
          },
          method: "get",
          path: searchPath
        },
        mapper: toNominatimResults,
        successStatusCodes: [200],
        res: undefined,
        req: undefined,
        debug: debugLog
      }) as { apiStatusCode: number; response: NominatimSearchResult[] };

      return nominatimResponse.response || [];
    };

    let results = hasLocation ? await performSearch(true) : await performSearch(false);
    debugLog(`venueSearch: bounded search returned ${results.length} results`);

    if (results.length === 0 && hasLocation) {
      debugLog(`venueSearch: no local results, trying unbounded search`);
      results = await performSearch(false);
      debugLog(`venueSearch: unbounded search returned ${results.length} results`);
    }

    const venues = results
      .map(parseNominatimResult)
      .filter((v): v is VenueSearchResult => v !== null);

    debugLog(`venueSearch: returning ${venues.length} parsed venues`);

    return res.json({
      query,
      results: venues
    });
  } catch (error: unknown) {
    debugLog("venueSearch error:", error);
    const message = error instanceof Error ? error.message : "Venue search failed";
    return res.status(500).json({
      error: message
    });
  }
}
