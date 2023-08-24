export interface MeetupEventRequest {
  venue_id: number;
  time: number;
  announce: boolean;
  venue_visibility: string;
  publish_status: string;
  name: string;
  description: string;
  duration: number;
  guest_limit: number;
}
