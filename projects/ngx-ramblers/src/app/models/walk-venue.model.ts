import { IconDefinition } from "@fortawesome/fontawesome-common-types";

export interface WalkVenue {
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

