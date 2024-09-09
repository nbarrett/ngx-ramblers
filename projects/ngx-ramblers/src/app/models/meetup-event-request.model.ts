export interface MeetupEventRequest {
  title: string;
  venueId: number;
  dateTime: number;
  announce: boolean;
  venue_visibility: string;
  publish_status: string;
  description: string;
  duration: number;
  guestLimit: number;
}
