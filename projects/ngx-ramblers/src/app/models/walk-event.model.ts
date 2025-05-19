import { EventType } from "./walk.model";

export interface WalkEvent {
  data: object;
  eventType: EventType;
  date: number;
  memberId: string;
  notes?: string;
  description?: string;
  reason?: string;
}

export const AUDITED_FIELDS: string[] = [
  "fields.attachment",
  "fields.attendees",
  "fields.contactDetails",
  "fields.imageConfig",
  "fields.links",
  "fields.meetup",
  "fields.milesPerHour",
  "fields.publishing",
  "fields.riskAssessment",
  "fields.venue",
  "groupEvent.accessibility",
  "groupEvent.additional_details",
  "groupEvent.area_code",
  "groupEvent.ascent_feet",
  "groupEvent.ascent_metres",
  "groupEvent.cancellation_reason",
  "groupEvent.date_created",
  "groupEvent.date_updated",
  "groupEvent.description",
  "groupEvent.difficulty",
  "groupEvent.distance_km",
  "groupEvent.distance_miles",
  "groupEvent.duration",
  "groupEvent.end_date_time",
  "groupEvent.end_location",
  "groupEvent.event_organiser",
  "groupEvent.external_url",
  "groupEvent.facilities",
  "groupEvent.group_code",
  "groupEvent.group_name",
  "groupEvent.item_type",
  "groupEvent.linked_event",
  "groupEvent.location",
  "groupEvent.media",
  "groupEvent.meeting_date_time",
  "groupEvent.meeting_location",
  "groupEvent.shape",
  "groupEvent.start_date_time",
  "groupEvent.start_location",
  "groupEvent.status",
  "groupEvent.title",
  "groupEvent.transport",
  "groupEvent.url",
  "groupEvent.walk_leader",
];

