import { ExtractedLocation } from "../../models/map.model";
import { GeocodeMatchType } from "../../models/address-model";


export function extractLocations(text: string): ExtractedLocation[] {
  const locations: ExtractedLocation[] = [];

  const gridRefInTextRegex = /grid\s+ref(?:erence)?[:\s]+([A-Z]{2}\s?\d{3,5}\s?\d{3,5})/gi;
  const gridRefInTextMatches = Array.from(text.matchAll(gridRefInTextRegex));
  gridRefInTextMatches.forEach(match => {
    locations.push({
      type: GeocodeMatchType.GRID_REFERENCE,
      value: match[1].replace(/\s/g, ""),
      context: "explicitly mentioned grid reference"
    });
  });

  const postcodeRegex = /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/gi;
  const postcodeMatches = Array.from(text.matchAll(postcodeRegex));
  postcodeMatches.forEach(match => {
    const matchIndex = match.index ?? 0;
    locations.push({
      type: GeocodeMatchType.POSTCODE,
      value: match[1].replace(/\s/g, ""),
      context: contextFor(text, matchIndex)
    });
  });

  const gridRefRegex = /\b([A-Z]{2}\s?\d{3,5}\s?\d{3,5})\b/gi;
  const gridRefMatches = Array.from(text.matchAll(gridRefRegex));
  gridRefMatches.forEach(match => {
    const value = match[1].replace(/\s/g, "");
    const alreadyAdded = locations.some(l => l.type === GeocodeMatchType.GRID_REFERENCE && l.value === value);
    if (!alreadyAdded) {
      const matchIndex = match.index ?? 0;
      locations.push({
        type: GeocodeMatchType.GRID_REFERENCE,
        value,
        context: contextFor(text, matchIndex)
      });
    }
  });

  const fromToRegex = /(?:walk|route|path|trail|hike)\s+from\s+(.+?)\s+to\s+([^,.\n]+?)(?=\s+was|\s+is|\s+were|\.|\n|,\s+a\s+|,\s+opened|,\s+offers)/gi;
  const fromToMatches = Array.from(text.matchAll(fromToRegex));

  const simpleFromToRegex = /from\s+([A-Z][a-zA-Z\s]+?)\s+to\s+([A-Z][a-zA-Z\s]+?)(?=[,.\n]|and)/gi;
  const simpleFromToMatches = Array.from(text.matchAll(simpleFromToRegex));
  simpleFromToMatches.forEach(match => {
    let fromPlace = match[1].trim();
    const toPlace = match[2].trim();

    fromPlace = fromPlace.replace(/,\s+a\s+few\s+miles.*$/, "").trim();

    if (fromPlace && fromPlace.length > 2 && fromPlace.length < 150) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: fromPlace,
        context: "start location"
      });
    }

    if (toPlace && toPlace.length > 2 && toPlace.length < 100) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: toPlace,
        context: "end location"
      });
    }
  });
  fromToMatches.forEach(match => {
    let fromPlace = match[1].trim();
    const toPlace = match[2].trim();

    fromPlace = fromPlace.replace(/,\s*a\s+few\s+miles.*$/, "").trim();

    if (fromPlace && fromPlace.length > 2 && fromPlace.length < 150) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: fromPlace,
        context: "start location"
      });
    }

    if (toPlace && toPlace.length > 2 && toPlace.length < 100) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: toPlace,
        context: "end location"
      });
    }
  });

  const startLocationRegex = /start(?:ing)?\s+(?:point|location|from|at)?[:\/\s-]+([^.\n)]+)/gi;
  const startMatches = Array.from(text.matchAll(startLocationRegex));

  const startsAtRegex = /starts?\s+(?:alternatively\s+)?at\s+([^,\n]+?)(?:\s+or\s+([^,\n]+?))?/gi;
  const startsAtMatches = Array.from(text.matchAll(startsAtRegex));
  const meetAtRegex = /meet\s+at\s+([^.\n)]+)/gi;
  const meetAtMatches = Array.from(text.matchAll(meetAtRegex));
  startsAtMatches.forEach(match => {
    const place1 = match[1]?.trim();
    const place2 = match[2]?.trim();

    if (place1 && place1.length > 2) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: place1,
        context: "start location"
      });
    }

    if (place2 && place2.length > 2) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: place2,
        context: "start location"
      });
    }
  });

  const alternativeStartsRegex = /starts?\s+alternatively\s+at\s+([^,\n]+?)\s+or\s+([^,\n]+?)/gi;
  const alternativeStartsMatches = Array.from(text.matchAll(alternativeStartsRegex));
  alternativeStartsMatches.forEach(match => {
    const place1 = match[1]?.trim();
    const place2 = match[2]?.trim();

    if (place1 && place1.length > 2) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: place1,
        context: "start location"
      });
    }

    if (place2 && place2.length > 2) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: place2,
        context: "start location"
      });
    }
  });
  startMatches.forEach(match => {
    let place = match[1].trim();
    place = place.replace(/^(?:at|in|on)\s+/i, "");
    if (place && place.length > 2) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: place,
        context: "start location"
      });
    }
  });
  meetAtMatches.forEach(match => {
    let place = match[1].trim();
    place = place.replace(/^(?:at|in|on)\s+/i, "");
    place = place.replace(/\s*\(.*$/, "").trim();
    if (place && place.length > 2) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: place,
        context: "start location"
      });
    }
  });

  const endLocationRegex = /end(?:ing|s)?\s+(?:point|location|at)[:\/\s-]+([^.\n)]+)/gi;
  const endMatches = Array.from(text.matchAll(endLocationRegex));

  const finishesAtRegex = /finishes?\s+(?:on|at)\s+(?:the\s+)?([a-zA-Z\s]+?)(?=(?:\s+just\s+north\s+of\b)|[,.\n]|$)(?:\s+just\s+north\s+of\s+(?:the\s+)?([a-zA-Z\s]+?)(?=[,.\n]|$))?/gi;
  const finishesAtMatches = Array.from(text.matchAll(finishesAtRegex));

  const generalFinishesRegex = /finishes?\s+([^.\n]+?)(?=(?:\s+just\s+north\s+of\b)|[.\n]|$)(?:\s+just\s+north\s+of\s+([^.\n]+?)(?=[.\n]|$))?/gi;
  const generalFinishesMatches = Array.from(text.matchAll(generalFinishesRegex));
  generalFinishesMatches.forEach(match => {
    const place1 = match[1]?.trim();
    const place2 = match[2]?.trim();

    if (place1 && place1.length > 2) {
      let endLocation = place1;
      if (place1.includes("bank of the ")) {
        endLocation = place1.replace(/bank of the\s+/, "");
      }
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: endLocation,
        context: "end location"
      });
    }

    if (place2 && place2.length > 2) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: place2,
        context: "mentioned location"
      });
    }
  });
  finishesAtMatches.forEach(match => {
    const place1 = match[1]?.trim();
    const place2 = match[2]?.trim();

    if (place1 && place1.length > 2) {
      let endLocation = place1;
      if (place1.includes("bank of the ")) {
        endLocation = place1.replace(/bank of the\s+/, "");
      }
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: endLocation,
        context: "end location"
      });
    }

    if (place2 && place2.length > 2) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
        value: place2,
        context: "mentioned location"
      });
    }
  });
  endMatches.forEach(match => {
    const place = match[1].trim();
    if (place && place.length > 2) {
      locations.push({
        type: GeocodeMatchType.PLACE_NAME,
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
        type: GeocodeMatchType.PLACE_NAME,
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
      const alreadyAdded = locations.some(l => l.type === GeocodeMatchType.PLACE_NAME && l.value.includes(place));
      if (!alreadyAdded) {
        locations.push({
          type: GeocodeMatchType.PLACE_NAME,
          value: place,
          context: "mentioned location"
        });
      }
    }
  });
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

  const postcodes = locations.filter(l => l.type === GeocodeMatchType.POSTCODE);
  if (postcodes.length > 0) {
    return postcodes[0];
  }

  const gridRefs = locations.filter(l => l.type === GeocodeMatchType.GRID_REFERENCE);
  if (gridRefs.length > 0) {
    return gridRefs[0];
  }

  const startLocations = locations.filter(l => l.context === "start location");
  if (startLocations.length > 0) {
    startLocations.sort((a, b) => {
      if (a.value.includes("Station") && !b.value.includes("Station")) return -1;
      if (!a.value.includes("Station") && b.value.includes("Station")) return 1;
      return b.value.length - a.value.length;
    });
    return startLocations[0];
  }

  const endLocations = locations.filter(l => l.context === "end location");
  if (endLocations.length > 0) {
    return endLocations[0];
  }

  return locations[0];
}
