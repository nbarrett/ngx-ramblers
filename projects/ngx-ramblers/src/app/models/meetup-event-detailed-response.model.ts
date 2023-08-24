import { MeetupVenueResponse } from "./meetup-venue-response.model";

export interface MeetupEventDetailedResponse {
  "created": number;
  "duration": number;
  "id": string;
  "name": string;
  "guest_limit": number;
  "date_in_series_pattern": boolean;
  "status": string;
  "time": number;
  "local_date": string;
  "local_time": string;
  "updated": number;
  "utc_offset": number;
  "waitlist_count": number;
  "yes_rsvp_count": number;
  "venue": MeetupVenueResponse;
  "group": {
    "created": number;
    "name": string;
    "id": number;
    "join_mode": string;
    "lat": number;
    "lon": number;
    "urlname": string;
    "who": string;
    "localized_location": string;
    "state": string;
    "country": string;
    "region": string;
    "timezone": string;
  };
  "link": string;
  "description": string;
  "visibility": string;
  "member_pay_fee": boolean;
}
