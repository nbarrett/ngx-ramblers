import { EventField, EventType, GroupEventField } from "./walk.model";

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
  EventField.ATTACHMENT,
  EventField.ATTENDEES,
  EventField.GPX_FILE,
  EventField.CONTACT_DETAILS,
  EventField.IMAGE_CONFIG,
  EventField.LINKS,
  EventField.MEETUP,
  EventField.MILES_PER_HOUR,
  EventField.PUBLISHING,
  EventField.RISK_ASSESSMENT,
  EventField.VENUE,
  GroupEventField.ACCESSIBILITY,
  GroupEventField.ADDITIONAL_DETAILS,
  GroupEventField.AREA_CODE,
  GroupEventField.ASCENT_FEET,
  GroupEventField.ASCENT_METRES,
  GroupEventField.CANCELLATION_REASON,
  GroupEventField.DATE_CREATED,
  GroupEventField.DATE_UPDATED,
  GroupEventField.DESCRIPTION,
  GroupEventField.DIFFICULTY,
  GroupEventField.DISTANCE_KM,
  GroupEventField.DISTANCE_MILES,
  GroupEventField.DURATION,
  GroupEventField.END_DATE_TIME,
  GroupEventField.END_LOCATION,
  GroupEventField.EVENT_ORGANISER,
  GroupEventField.EXTERNAL_URL,
  GroupEventField.FACILITIES,
  GroupEventField.GROUP_CODE,
  GroupEventField.GROUP_NAME,
  GroupEventField.ITEM_TYPE,
  GroupEventField.LINKED_EVENT,
  GroupEventField.LOCATION,
  GroupEventField.MEDIA,
  GroupEventField.MEETING_DATE_TIME,
  GroupEventField.MEETING_LOCATION,
  GroupEventField.SHAPE,
  GroupEventField.START_DATE,
  GroupEventField.START_LOCATION,
  GroupEventField.STATUS,
  GroupEventField.TITLE,
  GroupEventField.TRANSPORT,
  GroupEventField.URL,
  GroupEventField.WALK_LEADER,
];
