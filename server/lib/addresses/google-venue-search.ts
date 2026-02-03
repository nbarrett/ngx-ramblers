import debug from "debug";
import { envConfig } from "../env-config/env-config";
import https from "https";
import * as systemConfig from "../config/system-config";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("google-venue-search"));
debugLog.enabled = true;

interface GooglePlaceNew {
  id: string;
  displayName?: {
    text: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  types?: string[];
  primaryType?: string;
  addressComponents?: {
    longText: string;
    shortText: string;
    types: string[];
  }[];
  websiteUri?: string;
}

interface GooglePlacesNewResponse {
  places?: GooglePlaceNew[];
  error?: {
    code: number;
    message: string;
    status: string;
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
  source: "google";
  displayName: string;
  url: string | null;
}

function inferVenueType(name: string, types: string[], primaryType?: string): string {
  const nameLower = (name || "").toLowerCase();
  const typeSet = new Set(types || []);
  const primary = (primaryType || "").toLowerCase();

  if (primary === "bar" || primary === "pub" || typeSet.has("bar") || typeSet.has("pub") ||
      nameLower.includes("pub") || nameLower.includes("inn") ||
      nameLower.includes("tavern") || nameLower.includes("arms") || nameLower.includes("hotel")) {
    return "pub";
  }
  if (primary === "cafe" || typeSet.has("cafe") || nameLower.includes("cafe") ||
      nameLower.includes("café") || nameLower.includes("coffee")) {
    return "cafe";
  }
  if (primary === "restaurant" || typeSet.has("restaurant") || nameLower.includes("restaurant") ||
      nameLower.includes("bistro") || nameLower.includes("kitchen")) {
    return "restaurant";
  }
  if (nameLower.includes("hall") || nameLower.includes("centre") || nameLower.includes("center")) {
    return "hall";
  }
  if (typeSet.has("church") || nameLower.includes("church") || nameLower.includes("chapel")) {
    return "church";
  }
  if (typeSet.has("train_station") || typeSet.has("transit_station") ||
      nameLower.includes("station") || nameLower.includes("railway")) {
    return "station";
  }
  if (typeSet.has("parking") || nameLower.includes("car park") || nameLower.includes("parking")) {
    return "car park";
  }
  if (typeSet.has("tourist_attraction") || typeSet.has("museum") || typeSet.has("point_of_interest")) {
    return "point of interest";
  }
  return "other";
}

function extractPostcode(addressComponents?: GooglePlaceNew["addressComponents"]): string | null {
  if (!addressComponents) return null;
  const postcodeComponent = addressComponents.find(c => c.types.includes("postal_code"));
  return postcodeComponent?.longText || null;
}

function parseAddress(formattedAddress: string, addressComponents?: GooglePlaceNew["addressComponents"]): {
  address1: string | null;
  address2: string | null;
  postcode: string | null;
} {
  const postcode = extractPostcode(addressComponents);

  if (!formattedAddress) {
    return { address1: null, address2: null, postcode };
  }

  const parts = formattedAddress.split(",").map(p => p.trim());
  const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

  const filteredParts: string[] = [];
  for (const part of parts) {
    if (!postcodeRegex.test(part) && part !== "UK" && part !== "United Kingdom") {
      filteredParts.push(part);
    }
  }

  return {
    address1: filteredParts[0] || null,
    address2: filteredParts.slice(1, 3).join(", ") || null,
    postcode: postcode || (parts.find(p => postcodeRegex.test(p))?.toUpperCase() || null)
  };
}

function parseGoogleResult(place: GooglePlaceNew): VenueSearchResult | null {
  const name = place.displayName?.text;
  if (!name || !place.location) {
    return null;
  }

  const { address1, address2, postcode } = parseAddress(
    place.shortFormattedAddress || place.formattedAddress || "",
    place.addressComponents
  );

  return {
    name,
    address1,
    address2,
    postcode,
    lat: place.location.latitude,
    lon: place.location.longitude,
    type: inferVenueType(name, place.types || [], place.primaryType),
    source: "google",
    displayName: place.formattedAddress || "",
    url: place.websiteUri || null
  };
}

async function callGooglePlacesApi(requestBody: object, apiKey: string): Promise<GooglePlacesNewResponse> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(requestBody);

    const options = {
      hostname: "places.googleapis.com",
      port: 443,
      path: "/v1/places:searchText",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location,places.types,places.primaryType,places.addressComponents,places.websiteUri",
        "Content-Length": Buffer.byteLength(postData),
        "Referer": "http://localhost:5001/"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

export async function googleVenueSearch(req, res) {
  const query = (req.query.q || req.query.query || "").toString().trim();
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const limit = Math.min(parseInt(req.query.limit) || 10, 20);
  const config = await systemConfig.systemConfig();
  const apiKey = config?.googleMaps?.apiKey;

  if (!query || query.length < 2) {
    return res.status(400).json({
      error: "Query must be at least 2 characters"
    });
  }

  if (!apiKey) {
    debugLog("googleVenueSearch: No Google Maps API key configured");
    return res.status(500).json({
      error: "Google Maps API key not configured"
    });
  }

  const hasLocation = Number.isFinite(lat) && Number.isFinite(lon);

  debugLog(`googleVenueSearch: query="${query}", lat=${lat}, lon=${lon}, hasLocation=${hasLocation}, limit=${limit}`);

  try {
    const requestBody: any = {
      textQuery: query,
      languageCode: "en",
      regionCode: "GB",
      maxResultCount: limit
    };

    if (hasLocation) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: lat,
            longitude: lon
          },
          radius: 40000.0
        }
      };
    }

    debugLog(`googleVenueSearch: request body:`, JSON.stringify(requestBody));

    const placesResponse = await callGooglePlacesApi(requestBody, apiKey);

    if (placesResponse.error) {
      debugLog(`googleVenueSearch: Google API error: ${placesResponse.error.status} - ${placesResponse.error.message}`);
      return res.status(500).json({
        error: placesResponse.error.message || `Google Places API error: ${placesResponse.error.status}`
      });
    }

    const venues = (placesResponse.places || [])
      .map(parseGoogleResult)
      .filter((v): v is VenueSearchResult => v !== null);

    debugLog(`googleVenueSearch: returning ${venues.length} parsed venues`);

    return res.json({
      query,
      results: venues
    });
  } catch (error: unknown) {
    debugLog("googleVenueSearch error:", error);
    const message = error instanceof Error ? error.message : "Venue search failed";
    return res.status(500).json({
      error: message
    });
  }
}
