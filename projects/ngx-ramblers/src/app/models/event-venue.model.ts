import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { ApiResponse } from "./api-response.model";

export enum VenueTypeValue {
  CAR_PARK = "car park",
  CAFE = "cafe",
  RESTAURANT = "restaurant",
  HALL = "hall",
  CHURCH = "church",
  PUB = "pub",
  STATION = "station",
  OTHER = "other"
}

export const VENUE_TYPE_TERMS: Record<VenueTypeValue, string[]> = {
  [VenueTypeValue.CAR_PARK]: ["car park", "car-park", "carpark", "parking", "layby", "lay-by"],
  [VenueTypeValue.CAFE]: ["cafe", "café", "coffee", "tea room", "tearoom"],
  [VenueTypeValue.RESTAURANT]: ["restaurant", "bistro", "diner", "eatery", "kitchen"],
  [VenueTypeValue.PUB]: ["pub", "inn", "tavern", "arms", "head", "bell", "crown", "swan", "bull", "lion", "rose", "anchor", "oak", "fox", "bear", "eagle", "plough", "brewery", "ale", "beer", "robin", "horse", "hare", "stag", "hart", "dog", "cock", "hen", "pheasant", "falcon", "hawk", "raven", "magpie", "pig", "boar", "lamb", "sheep", "goat", "badger", "otter", "deer", "buck", "elephant", "parrot", "dolphin", "hook", "hatchet", "chequers", "windmill", "vineyard", "angel", "duke", "halfway house", "three chimneys", "bedford"],
  [VenueTypeValue.HALL]: ["village hall", "community hall", "town hall", "memorial hall", "parish hall", "church hall", "hall", "centre", "center", "community"],
  [VenueTypeValue.CHURCH]: ["church", "chapel", "abbey", "cathedral", "priory", "minster"],
  [VenueTypeValue.STATION]: ["station", "railway", "rail", "train", "metro", "underground", "tube"],
  [VenueTypeValue.OTHER]: []
};

const WORD_BOUNDARY_TERMS = new Set(["church", "chapel", "abbey", "cathedral", "priory", "minster", "hall", "inn", "pub", "oak", "head", "bell", "crown", "swan", "bull", "lion", "rose", "anchor", "fox", "bear", "eagle", "robin", "horse", "hare", "stag", "hart", "dog", "cock", "hen", "pheasant", "falcon", "hawk", "raven", "magpie", "pig", "boar", "lamb", "sheep", "goat", "badger", "otter", "deer", "buck", "elephant", "parrot", "dolphin", "hook", "hatchet", "chequers", "windmill", "vineyard", "angel", "duke", "bedford", "ale", "beer"]);

export function inferVenueTypeFromName(name: string): VenueTypeValue {
  if (!name) {
    return VenueTypeValue.OTHER;
  }
  const nameLower = name.toLowerCase();
  for (const [venueType, terms] of Object.entries(VENUE_TYPE_TERMS)) {
    if (terms.length > 0 && terms.some(term => {
      if (WORD_BOUNDARY_TERMS.has(term)) {
        const regex = new RegExp(`\\b${term}\\b`, "i");
        return regex.test(nameLower);
      }
      return nameLower.includes(term);
    })) {
      return venueType as VenueTypeValue;
    }
  }
  return VenueTypeValue.OTHER;
}

export interface Venue {
  storedVenueId?: string;
  venuePublish?: boolean;
  isMeetingPlace?: boolean;
  type?: string;
  name?: string;
  address1?: string;
  address2?: string;
  postcode?: string;
  lat?: number;
  lon?: number;
  url?: string;
}

export interface VenueType {
  type: string;
  displayName: string;
  icon: IconDefinition;
}

export interface VenueWithUsageStats extends Venue {
  usageCount: number;
  lastUsed?: string;
  ngSelectLabel?: string;
}

export interface VenueWithDistance extends VenueWithUsageStats {
  distance?: number;
}

export interface VenueParseResult {
  venue: Partial<Venue>;
  confidence: number;
  warnings: string[];
}

export interface VenueApiResponse extends ApiResponse {
  request: any;
  response?: VenueWithUsageStats[];
}

export interface StoredVenue {
  id?: string;
  name: string;
  address1?: string;
  address2?: string;
  postcode?: string;
  type?: string;
  url?: string;
  lat?: number;
  lon?: number;
  usageCount?: number;
  lastUsed?: number;
  createdAt?: number;
  createdBy?: string;
  updatedAt?: number;
  updatedBy?: string;
}

export interface StoredVenueApiResponse extends ApiResponse {
  request: any;
  response?: StoredVenue | StoredVenue[];
}

