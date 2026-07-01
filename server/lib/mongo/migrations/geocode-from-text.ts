import {
  GeocodeMatchData,
  GeocodeMatchType,
  GeocodeSourceField,
  GridReferenceLookupResponse
} from "../../../../projects/ngx-ramblers/src/app/models/address-model";
import { EventType, GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";
import { WalkEvent } from "../../../../projects/ngx-ramblers/src/app/models/walk-event.model";
import { nominatimGridReferenceLookup } from "../../addresses/nominatim-lookup";
import { bestLocation, extractLocations } from "../../../../projects/ngx-ramblers/src/app/common/locations/location-extractor";
import { walkEventDataFrom } from "./migration-walk-event";
import { isArray, isNumber } from "es-toolkit/compat";
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

async function lookupPlaceName(query: string, preferredCounty: string | null, debugLog: any): Promise<GridReferenceLookupResponse | null> {
  if (!query || query.length < 3) {
    return null;
  }
  debugLog(`lookupPlaceName: searching for "${query}"${preferredCounty ? ` (preferring ${preferredCounty})` : ""}`);
  try {
    const result = await nominatimGridReferenceLookup({
      query,
      preferredCounty: preferredCounty || undefined,
      userAgent: "ngx-ramblers-migration/1.0",
      logPrefix: "lookupPlaceName",
      debugLog
    });
    return result.response || null;
  } catch (error) {
    debugLog(`lookupPlaceName error for "${query}":`, error);
    return null;
  }
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
