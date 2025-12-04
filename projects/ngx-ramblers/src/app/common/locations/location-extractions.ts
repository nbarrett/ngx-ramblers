import { ExtractedLocation } from "../../models/map.model";


export function extractLocations(text: string): ExtractedLocation[] {
  const locations: ExtractedLocation[] = [];

  const gridRefInTextRegex = /grid\s+ref(?:erence)?[:\s]+([A-Z]{2}\s?\d{3,5}\s?\d{3,5})/gi;
  const gridRefInTextMatches = Array.from(text.matchAll(gridRefInTextRegex));
  gridRefInTextMatches.forEach(match => {
    locations.push({
      type: "gridReference",
      value: match[1].replace(/\s/g, ""),
      context: "explicitly mentioned grid reference"
    });
  });

  const postcodeRegex = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/gi;
  const postcodeMatches = Array.from(text.matchAll(postcodeRegex));
  postcodeMatches.forEach(match => {
    const matchIndex = match.index ?? 0;
    locations.push({
      type: "postcode",
      value: match[1].replace(/\s/g, ""),
      context: this.contextFor(text, matchIndex)
    });
  });

  const gridRefRegex = /\b([A-Z]{2}\s?\d{3,5}\s?\d{3,5})\b/gi;
  const gridRefMatches = Array.from(text.matchAll(gridRefRegex));
  gridRefMatches.forEach(match => {
    const value = match[1].replace(/\s/g, "");
    const alreadyAdded = locations.some(l => l.type === "gridReference" && l.value === value);
    if (!alreadyAdded) {
      const matchIndex = match.index ?? 0;
      locations.push({
        type: "gridReference",
        value,
        context: this.contextFor(text, matchIndex)
      });
    }
  });

  const fromToRegex = /(?:walk|route|path|trail|hike)\s+from\s+(.+?)\s+to\s+([^,.\n]+?)(?=\s+was|\s+is|\s+were|\.|\n|,\s+a\s+|,\s+opened)/gi;
  const fromToMatches = Array.from(text.matchAll(fromToRegex));
  fromToMatches.forEach(match => {
    let fromPlace = match[1].trim();
    const toPlace = match[2].trim();

    fromPlace = fromPlace.replace(/,\s*a\s+few\s+miles.*$/, "").trim();

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

  const startLocationRegex = /start(?:ing)?\s+(?:point|location|from|at)[:\/\s-]+([^.\n)]+)/gi;
  const startMatches = Array.from(text.matchAll(startLocationRegex));
  startMatches.forEach(match => {
    const place = match[1].trim();
    if (place && place.length > 2) {
      locations.push({
        type: "placeName",
        value: place,
        context: "start location"
      });
    }
  });

  const endLocationRegex = /end(?:ing|s)?\s+(?:point|location|at)[:\/\s-]+([^.\n)]+)/gi;
  const endMatches = Array.from(text.matchAll(endLocationRegex));
  endMatches.forEach(match => {
    const place = match[1].trim();
    if (place && place.length > 2) {
      locations.push({
        type: "placeName",
        value: place,
        context: "end location"
      });
    }
  });

  const parkingRegex = /park(?:ing)?[:\/\s-]+([^.\n)]+)/gi;
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
    if (place && place.length > 3 && !this.isCommonWord(place)) {
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

  this.logger.info("Extracted", locations.length, "locations from text");
  return locations;
}

function isCommonWord(word: string): boolean {
  const commonWords = [
    "March", "April", "June", "July", "August", "September", "October", "November", "December",
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "Lord", "Lady", "Sir", "Dame", "The", "This", "That", "These", "Those"
  ];
  return commonWords.some(common => word.toLowerCase() === common.toLowerCase());
}

function contextFor(text: string, index: number): string {
  const contextStart = Math.max(0, index - 30);
  const contextEnd = Math.min(text.length, index + 80);
  return "..." + text.substring(contextStart, contextEnd).trim() + "...";
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
    return startLocations[0];
  }

  return locations[0];
}

