export enum MeetupVenueVisibility {
  PRIVATE = "private",
  PUBLIC = "public"
}

export interface MeetupVenueRequest {
  address_1?: string;
  address_2?: string;
  city?: string;
  country?: string;
  hours?: string;
  name?: string;
  phone?: string;
  state?: string;
  visibility?: MeetupVenueVisibility;
  web_url?: string;
}
