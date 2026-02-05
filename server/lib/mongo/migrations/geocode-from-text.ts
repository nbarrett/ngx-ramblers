import {
  GeocodeMatchData,
  GeocodeMatchType,
  GeocodeSourceField,
  GridReferenceLookupApiResponse,
  GridReferenceLookupResponse,
  NominatimPlaceResult
} from "../../../../projects/ngx-ramblers/src/app/models/address-model";
import { EventType, GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { WalkEvent } from "../../../../projects/ngx-ramblers/src/app/models/walk-event.model";
import { gridReferenceLookupFromLatLng } from "../../addresses/reverse-geocode";
import { bestLocation, extractLocations } from "../../../../projects/ngx-ramblers/src/app/common/locations/location-extractor";
import * as messageHandlers from "../../shared/message-handlers";
import { walkEventDataFrom } from "./migration-walk-event";
import { isArray, isNumber } from "es-toolkit/compat";
import url from "url";
import querystring from "querystring";
import { dateTimeNowAsValue } from "../../shared/dates";
import { systemConfig } from "../../config/system-config";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";

export type TextGeocodeResult = {
  lookup: GridReferenceLookupResponse | null;
  matchType: GeocodeMatchData["matchType"] | null;
  sourceText: string;
  sourceField: GeocodeMatchData["sourceField"];
};

export type TextGeocodeUpdate = {
  update: Record<string, any>;
  event: WalkEvent;
};

export type GridReferenceAuditResult = {
  gridReference10: string | null;
  gridReference8: string | null;
  gridReference6: string | null;
  validGridReference: string | null;
  invalidFields: string[];
  updateSet: Record<string, any>;
  unsetPayload: Record<string, string>;
};

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org";
const nominatimUrl = url.parse(NOMINATIM_ENDPOINT, false);

function toNominatimPlace(response: any): NominatimPlaceResult[] {
  let places: NominatimPlaceResult[] = [];
  if (isArray(response)) {
    places = response;
  } else {
    places = [];
  }
  return places;
}

function placeTypeScore(place: NominatimPlaceResult): number {
  let score = 0;
  if (place.address?.city) {
    score = 3;
  } else if (place.address?.town) {
    score = 2;
  } else if (place.address?.village) {
    score = 1;
  } else {
    score = 0;
  }
  return score;
}

function selectNominatimPlace(places: NominatimPlaceResult[], preferredCounty?: string): NominatimPlaceResult | undefined {
  let selected: NominatimPlaceResult | undefined;
  if (places.length === 0) {
    selected = undefined;
  } else if (places.length === 1) {
    selected = places[0];
  } else {
    const ukPlaces = places.filter(place =>
      place.address?.country_code === "gb" ||
      place.display_name.includes("UK") ||
      place.display_name.includes("United Kingdom")
    );

    const placesToSearch = ukPlaces.length > 0 ? ukPlaces : places;

    selected = placesToSearch.slice().sort((a, b) => {
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
  return selected;
}

function extractGridReference(response: GridReferenceLookupApiResponse): GridReferenceLookupResponse | undefined {
  const payload = response?.response;
  let gridReference: GridReferenceLookupResponse | undefined;
  if (isArray(payload)) {
    gridReference = payload[0];
  } else {
    gridReference = payload as GridReferenceLookupResponse;
  }
  return gridReference;
}

async function lookupPlaceName(query: string, preferredCounty: string | null, debugLog: any): Promise<GridReferenceLookupResponse | null> {
  let result: GridReferenceLookupResponse | null = null;
  if (!query || query.length < 3) {
    result = null;
  } else {
    debugLog(`lookupPlaceName: searching for "${query}"${preferredCounty ? ` (preferring ${preferredCounty})` : ""}`);

    try {
      const nominatimResponse = await messageHandlers.httpRequest({
        apiRequest: {
          hostname: nominatimUrl.hostname,
          protocol: nominatimUrl.protocol,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "ngx-ramblers-migration/1.0"
          },
          method: "get",
          path: `/search?format=jsonv2&limit=5&countrycodes=gb&q=${querystring.escape(query)}`
        },
        mapper: toNominatimPlace,
        successStatusCodes: [200, 404],
        res: undefined,
        req: undefined,
        debug: debugLog
      }) as { apiStatusCode: number; response: NominatimPlaceResult[] };

      debugLog(`lookupPlaceName: Nominatim returned ${nominatimResponse.response?.length || 0} results for "${query}"`);

      const place = selectNominatimPlace(nominatimResponse.response, preferredCounty);
      if (!place) {
        debugLog(`lookupPlaceName: no suitable place found for "${query}"`);
        result = null;
      } else {
        debugLog(`lookupPlaceName: selected "${place.display_name}" at lat=${place.lat}, lng=${place.lon}`);

        const latlng = { lat: parseFloat(place.lat), lng: parseFloat(place.lon) };
        const gridReferenceResponse = await gridReferenceLookupFromLatLng(latlng);
        const gridReference = extractGridReference(gridReferenceResponse);

        result = {
          gridReference6: gridReference?.gridReference6,
          gridReference8: gridReference?.gridReference8,
          gridReference10: gridReference?.gridReference10,
          distance: gridReference?.distance,
          postcode: gridReference?.postcode || place.address?.postcode,
          latlng,
          description: place.display_name
        };
      }
    } catch (error) {
      debugLog(`lookupPlaceName error for "${query}":`, error);
      result = null;
    }
  }
  return result;
}

function cleanPlaceName(value: string): string {
  return value
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s*-\s*(moderate|leisurely|strenuous|easy|introductory|booking\s+required).*$/i, "")
    .replace(/\s*(circular|walk|hike|route|trail|crawl)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPlaceNamesFromTitle(title: string): string[] {
  const places: string[] = [];

  const cleaned = cleanPlaceName(title);

  const patterns = [
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:to|and|&)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*[,\-:]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      if (match[1]) places.push(match[1].trim());
      if (match[2]) places.push(match[2].trim());
      break;
    }
  }

  return places.filter(p => p.length > 2 && !/^(The|A|An|From|To|And|Or|Via|With|For|At|In|On|By|Near)$/i.test(p));
}

export async function geocodeFromText(params: {
  title: string;
  description: string;
  preferredCounty: string | null;
  debugLog: any;
}): Promise<TextGeocodeResult> {
  const { title, description, preferredCounty, debugLog } = params;

  const titleLocations = extractLocations(title);
  const titlePlaces = extractPlaceNamesFromTitle(title);
  debugLog(`Extracted ${titleLocations.length} locations from title, ${titlePlaces.length} place names`);

  const descriptionLocations = extractLocations(description);
  debugLog(`Extracted ${descriptionLocations.length} locations from description`);

  const allLocations = [...titleLocations, ...descriptionLocations];
  const best = bestLocation(allLocations);

  let lookup: GridReferenceLookupResponse | null = null;
  let matchType: GeocodeMatchData["matchType"] | null = null;
  let sourceText = "";
  let sourceField: GeocodeMatchData["sourceField"] = GeocodeSourceField.TITLE;

  if (best?.type === GeocodeMatchType.POSTCODE) {
    debugLog(`Found postcode in text: ${best.value}`);
    lookup = await lookupPlaceName(best.value, preferredCounty, debugLog);
    if (lookup?.postcode) {
      matchType = GeocodeMatchType.POSTCODE;
      sourceText = best.value;
      sourceField = titleLocations.includes(best) ? GeocodeSourceField.TITLE : GeocodeSourceField.DESCRIPTION;
    }
  } else if (best?.type === GeocodeMatchType.GRID_REFERENCE && !best.value.startsWith("SV")) {
    debugLog(`Found valid grid reference in text: ${best.value}`);
    lookup = await lookupPlaceName(best.value, preferredCounty, debugLog);
    if (lookup?.postcode) {
      matchType = GeocodeMatchType.GRID_REFERENCE;
      sourceText = best.value;
      sourceField = titleLocations.includes(best) ? GeocodeSourceField.TITLE : GeocodeSourceField.DESCRIPTION;
    }
  } else if (titlePlaces.length >= 2) {
    const combinedSearch = `${titlePlaces[0]}, ${titlePlaces[1]}`;
    debugLog(`Trying combined place names from title: "${combinedSearch}"`);
    lookup = await lookupPlaceName(combinedSearch, preferredCounty, debugLog);
    if (lookup?.postcode) {
      debugLog(`Successfully resolved "${combinedSearch}" to postcode ${lookup.postcode}`);
      matchType = GeocodeMatchType.TITLE_EXTRACTION;
      sourceText = combinedSearch;
      sourceField = GeocodeSourceField.TITLE;
    }
  }

  if (!lookup?.postcode && best?.type === GeocodeMatchType.PLACE_NAME) {
    debugLog(`Trying place name from extraction: "${best.value}"`);
    lookup = await lookupPlaceName(best.value, preferredCounty, debugLog);
    if (lookup?.postcode) {
      matchType = GeocodeMatchType.PLACE_NAME;
      sourceText = best.value;
      sourceField = titleLocations.includes(best) ? GeocodeSourceField.TITLE : GeocodeSourceField.DESCRIPTION;
    }
  }

  if (!lookup?.postcode && titlePlaces.length > 0) {
    for (const place of titlePlaces) {
      debugLog(`Trying place name from title: "${place}"`);
      lookup = await lookupPlaceName(place, preferredCounty, debugLog);
      if (lookup?.postcode) {
        debugLog(`Successfully resolved "${place}" to postcode ${lookup.postcode}`);
        matchType = GeocodeMatchType.TITLE_EXTRACTION;
        sourceText = place;
        sourceField = GeocodeSourceField.TITLE;
        break;
      }
    }
  }

  if (!lookup?.postcode) {
    const startLocations = allLocations.filter(l => l.context === "start location");
    for (const loc of startLocations) {
      if (loc.type === GeocodeMatchType.PLACE_NAME) {
        const cleanedPlace = cleanPlaceName(loc.value);
        debugLog(`Trying start location: "${cleanedPlace}"`);
        lookup = await lookupPlaceName(cleanedPlace, preferredCounty, debugLog);
        if (lookup?.postcode) {
          debugLog(`Successfully resolved start location "${cleanedPlace}" to postcode ${lookup.postcode}`);
          matchType = GeocodeMatchType.START_LOCATION;
          sourceText = cleanedPlace;
          sourceField = titleLocations.some(l => l.value === loc.value)
            ? GeocodeSourceField.TITLE
            : GeocodeSourceField.DESCRIPTION;
          break;
        }
      }
    }
  }

  return {
    lookup: lookup?.postcode ? lookup : null,
    matchType,
    sourceText,
    sourceField
  };
}

export async function preferredCountyFromSystemConfig(debugLog: any): Promise<string | null> {
  let preferredCounty: string | null = null;
  try {
    const config: SystemConfig = await systemConfig();
    const preferred = config?.area?.shortName || config?.area?.longName || null;
    if (!preferred) {
      preferredCounty = null;
    } else {
      const trimmed = preferred.trim();
      if (trimmed.length === 0) {
        preferredCounty = null;
      } else {
        const normalized = trimmed.replace(/\s+area$/i, "").trim();
        preferredCounty = normalized.length > 0 ? normalized : null;
      }
    }
  } catch (error) {
    if (debugLog) {
      debugLog("Unable to determine preferred county from system config:", error);
    }
    preferredCounty = null;
  }
  return preferredCounty;
}

export async function preferredAreaCenterFromSystemConfig(debugLog: any): Promise<[number, number] | null> {
  let center: [number, number] | null = null;
  try {
    const config: SystemConfig = await systemConfig();
    const areaCenter = config?.area?.center;
    if (isArray(areaCenter) && areaCenter.length === 2 && isNumber(areaCenter[0]) && isNumber(areaCenter[1])) {
      center = [areaCenter[0], areaCenter[1]];
    } else {
      center = null;
    }
  } catch (error) {
    if (debugLog) {
      debugLog("Unable to determine preferred area center from system config:", error);
    }
    center = null;
  }
  return center;
}

export function textGeocodeUpdate(params: {
  doc: any;
  lookup: GridReferenceLookupResponse;
  matchType: GeocodeMatchData["matchType"];
  sourceText: string;
  sourceField: GeocodeMatchData["sourceField"];
  gridReference: GridReferenceAuditResult;
}): TextGeocodeUpdate {
  const { doc, lookup, matchType, sourceText, sourceField, gridReference } = params;
  const lat = doc?.groupEvent?.start_location?.latitude;
  const lng = doc?.groupEvent?.start_location?.longitude;

  const update: any = {
    $set: {
      [GroupEventField.START_LOCATION_POSTCODE]: lookup.postcode
    }
  };

  if (lookup.latlng?.lat && (!lat || lat === 0)) {
    update.$set[GroupEventField.START_LOCATION_LATITUDE] = lookup.latlng.lat;
  }
  if (lookup.latlng?.lng && (!lng || lng === 0)) {
    update.$set[GroupEventField.START_LOCATION_LONGITUDE] = lookup.latlng.lng;
  }

  const hasInvalidGridRef = gridReference.invalidFields.length > 0;
  if (hasInvalidGridRef || !gridReference.gridReference6) {
    if (lookup.gridReference6) {
      update.$set[GroupEventField.START_LOCATION_GRID_REFERENCE_6] = lookup.gridReference6;
    }
    if (lookup.gridReference8) {
      update.$set[GroupEventField.START_LOCATION_GRID_REFERENCE_8] = lookup.gridReference8;
    }
    if (lookup.gridReference10) {
      update.$set[GroupEventField.START_LOCATION_GRID_REFERENCE_10] = lookup.gridReference10;
    }
  }

  if (!doc.groupEvent?.start_location?.description && lookup.description) {
    update.$set[GroupEventField.START_LOCATION_DESCRIPTION] = lookup.description;
  }

  const geocodeEvent: WalkEvent = {
    eventType: EventType.LOCATION_GEOCODED,
    date: dateTimeNowAsValue(),
    memberId: "migration",
    description: `Location geocoded from ${sourceField} using ${matchType}`,
    notes: `Resolved "${sourceText}" to postcode ${lookup.postcode}${lookup.description ? ` (${lookup.description})` : ""}.`,
    data: walkEventDataFrom(doc, {...update.$set, ...gridReference.updateSet})
  };

  return { update, event: geocodeEvent };
}
