import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { ApiResponse } from "./api-response.model";

export interface Venue {
  venuePublish?: boolean;
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
  icon: IconDefinition;
}

export interface VenueWithUsageStats extends Venue {
  usageCount: number;
  lastUsed?: string;
  ngSelectLabel?: string;
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

