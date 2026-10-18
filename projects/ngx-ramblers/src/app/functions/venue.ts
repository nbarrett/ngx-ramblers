import { PlaceNameChoice } from "../models/event-venue.model";
import { withoutTrailingPostcode } from "./locate";

export function resultPlaceName(venue: { name?: string; address1?: string }): string {
  const name = withoutTrailingPostcode(venue.name);
  const address = withoutTrailingPostcode(venue.address1);
  if (address && !name.toLowerCase().includes(address.toLowerCase())) {
    return `${name}, ${address}`;
  } else {
    return name;
  }
}

export function placeNamesMatch(left: string, right: string): boolean {
  return left.replace(/\s+/g, " ").trim().toLowerCase() === right.replace(/\s+/g, " ").trim().toLowerCase();
}

export function placeNameChoiceFor(typed: string, venue: { name?: string; address1?: string }): PlaceNameChoice | null {
  const fromResult = resultPlaceName(venue);
  if (typed && fromResult && !placeNamesMatch(typed, fromResult)) {
    return {typed, fromResult};
  } else {
    return null;
  }
}
