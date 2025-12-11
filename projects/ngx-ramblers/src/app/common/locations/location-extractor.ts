import { ExtractedLocation } from "../../models/map.model";

const commonWords = [
  "March", "April", "June", "July", "August", "September", "October", "November", "December",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "Lord", "Lady", "Sir", "Dame", "The", "This", "That", "These", "Those"
];

const validGridPrefixes = [
  "SV", "SW", "SX", "SY", "SZ", "SQ", "SR", "SS", "ST", "SU", "TQ", "TR",
  "SM", "SN", "SO", "SP", "TL", "TM", "SF", "SG", "SH", "SJ", "SK", "TF", "TG",
  "SA", "SB", "SC", "SD", "SE", "TA", "TB", "NV", "NW", "NX", "NY", "NZ", "OV",
  "NQ", "NR", "NS", "NT", "NU", "OQ", "OR", "NL", "NM", "NN", "NO", "NP", "OL",
  "NF", "NG", "NH", "NJ", "NK", "OF", "OG", "NA", "NB", "NC", "ND", "NE", "OA",
  "HW", "HX", "HY", "HZ", "HT", "HU"
];

function isCommonWord(word: string): boolean {
  return commonWords.some(common => word.toLowerCase() === common.toLowerCase());
}

function isValidGridPrefix(prefix: string): boolean {
  return validGridPrefixes.includes(prefix.toUpperCase());
}

export function extractLocations(text: string): ExtractedLocation[] {
  const locations: ExtractedLocation[] = [];

  const gridRefInTextRegex = /grid\s+ref(?:erence)?:[\s]+([A-Z]{2}\s?\d{3,5}\s?\d{3,5})/gi;
  const gridRefInTextMatches = Array.from(text.matchAll(gridRefInTextRegex));
  gridRefInTextMatches.forEach(match => {
    const value = match[1].replace(/\s/g, "");
    const prefix = value.substring(0, 2);
    if (isValidGridPrefix(prefix)) {
      locations.push({
        type: "gridReference",
        value,
        context: "explicitly mentioned grid reference"
      });
    }
  });

  const postcodeRegex = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/gi;
  const postcodeMatches = Array.from(text.matchAll(postcodeRegex));
  postcodeMatches.forEach(match => {
    locations.push({
      type: "postcode",
      value: match[1].replace(/\s/g, ""),
      context: "found in text"
    });
  });

  const gridRefRegex = /\b([A-Z]{2}\s?\d{3,5}\s?\d{3,5})\b/gi;
  const gridRefMatches = Array.from(text.matchAll(gridRefRegex));
  gridRefMatches.forEach(match => {
    const value = match[1].replace(/\s/g, "");
    const prefix = value.substring(0, 2);
    const alreadyAdded = locations.some(l => l.type === "gridReference" && l.value === value);
    if (!alreadyAdded && isValidGridPrefix(prefix)) {
      locations.push({
        type: "gridReference",
        value,
        context: "explicitly mentioned grid reference"
      });
    }
  });

  const fromToRegex = /(?:walk|route|path|trail|hike|way)\s+from\s+(.+?)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/gi;
  const fromToMatches = Array.from(text.matchAll(fromToRegex));
  fromToMatches.forEach(match => {
    let fromPlace = match[1].trim();
    let toPlace = match[2].trim();

    fromPlace = fromPlace.replace(/,\s*a\s+few\s+miles.*$/, "").trim();
    toPlace = toPlace.replace(/\s+(offers|and|with|for|at|in|on|by|near|to|from|of|the|a|an).+$/, "").trim();

    if (fromPlace && fromPlace.length > 2 && fromPlace.length < 150) {
      locations.push({
        type: "placeName",
        value: fromPlace,
        context: "start location"
      });
    }

    if (toPlace && toPlace.length > 2 && toPlace.length < 100) {
      locations.push({
        type: "placeName",
        value: toPlace,
        context: "end location"
      });
    }
  });

  const startLocationRegex = /start(?:ing|s)?\s+(?:point|location|from|alternatively)?(?:\s+at)?(?:\s*[:\/\s-]+|\s+)?([^.\n)]+)/gi;
  const startMatches = Array.from(text.matchAll(startLocationRegex));
  startMatches.forEach(match => {
    let place = match[1].trim();
    place = place.replace(/^at\s+/i, "").trim();
    place = place.replace(/\s+or\s+[^.\n)]+$/i, "").trim();
    place = place.replace(/\s+and\s+finishes.+$/i, "").trim();
    place = place.replace(/\s+to\s+.+$/i, "").trim();
    place = place.replace(/\s+via\s+.+$/i, "").trim();
    place = place.replace(/\s+through\s+.+$/i, "").trim();
    if (place && place.length > 2 && place.length < 100) {
      locations.push({
        type: "placeName",
        value: place,
        context: "start location"
      });
    }
  });

  const endLocationRegex = /(?:end(?:ing|s)?|finish(?:es)?)\s+(?:point|location|at|on)?(?:\s+the)?(?:\s+bank\s+of)?(?:\s+at)?(?:\s*[:\/\s-]+|\s+)?([^.\n)]+)/gi;
  const endMatches = Array.from(text.matchAll(endLocationRegex));
  endMatches.forEach(match => {
    let place = match[1].trim();
    place = place.replace(/^the\s+/i, "").trim();
    if (place && place.length > 2) {
      locations.push({
        type: "placeName",
        value: place,
        context: "end location"
      });
    }
  });

  const parkingRegex = /park(?:ing)?[ :\/\s-]+([^.\n)]+)/gi;
  const parkingMatches = Array.from(text.matchAll(parkingRegex));
  parkingMatches.forEach(match => {
    const place = match[1].trim();
    if (place && place.length > 2) {
      locations.push({
        type: "placeName",
        value: place,
        context: "parking"
      });
    }
  });

  const ofPlaceRegex = /of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
  const ofPlaceMatches = Array.from(text.matchAll(ofPlaceRegex));
  ofPlaceMatches.forEach(match => {
    const place = match[1].trim();
    if (place && place.length > 3 && !isCommonWord(place)) {
      const alreadyAdded = locations.some(l =>
        l.type === "placeName" && l.value.includes(place)
      );
      if (!alreadyAdded) {
        locations.push({
          type: "placeName",
          value: place,
          context: "mentioned location"
        });
      }
    }
  });
  return locations;
}

export function bestLocation(locations: ExtractedLocation[]): ExtractedLocation | null {
  if (locations.length === 0) {
    return null;
  }

  const postcodes = locations.filter(l => l.type === "postcode");
  if (postcodes.length > 0) {
    return postcodes[0];
  }

  const gridRefs = locations.filter(l => l.type === "gridReference");
  if (gridRefs.length > 0) {
    return gridRefs[0];
  }

  const startLocations = locations.filter(l => l.context === "start location");
  if (startLocations.length > 0) {
    const richestStart = startLocations.reduce((best, current) => {
      const bestScore = scoreLocation(best);
      const currentScore = scoreLocation(current);
      return currentScore > bestScore ? current : best;
    }, startLocations[0]);
    return richestStart;
  }

  return locations[0];
}

function scoreLocation(location: ExtractedLocation): number {
  let score = 0;

  score += location.value.length;

  if (/Station|Railway|Train|Bus|Car Park/i.test(location.value)) {
    score += 50;
  }

  if (/\s+and\s+|\s+or\s+/i.test(location.value)) {
    score += 30;
  }

  const wordCount = location.value.split(/\s+/).length;
  score += wordCount * 5;

  return score;
}
