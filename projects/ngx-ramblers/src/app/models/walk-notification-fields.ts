import {
  WalkNotificationFieldDescriptor,
  WalkNotificationValueFormat as Format
} from "./walk-notification-field.model";
import { EventField, GroupEventField } from "./walk.model";

export const WALK_NOTIFICATION_FIELDS: Record<string, WalkNotificationFieldDescriptor> = {
  [EventField.ATTACHMENT]: {label: "Attachment", notify: true, intro: false, format: Format.FILE},
  [EventField.ATTENDEES]: {label: "Attendance", notify: true, intro: false, format: Format.ATTENDEES},
  [EventField.BOOKINGS_ENABLED]: {label: "Bookings enabled", notify: true, intro: true, format: Format.BOOLEAN},
  [EventField.GPX_FILE]: {label: "Route file", notify: true, intro: false, format: Format.FILE},
  [EventField.CONTACT_DETAILS]: {label: "Leader contact details", notify: true, intro: true, format: Format.CONTACT_DETAILS},
  [EventField.IMAGE_CONFIG]: {label: "Image source", notify: true, intro: false, format: Format.IMAGE_CONFIG},
  [EventField.LINKS]: {label: "Related links", notify: true, intro: false, format: Format.LINKS},
  [EventField.MAX_CAPACITY]: {label: "Maximum capacity", notify: true, intro: true, format: Format.TEXT},
  [EventField.MEETUP]: {label: "Meetup settings", notify: true, intro: false, format: Format.MEETUP},
  [EventField.MILES_PER_HOUR]: {label: "Expected walking speed", notify: true, intro: true, format: Format.SPEED},
  [EventField.PUBLISHING]: {label: "Publishing", notify: true, intro: false, format: Format.PUBLISHING},
  [EventField.RISK_ASSESSMENT]: {label: "Risk assessment", notify: true, intro: false, format: Format.RISK_ASSESSMENT},
  [EventField.ROUTE_WAYPOINTS]: {label: "Route directions", notify: true, intro: false, format: Format.ROUTE_WAYPOINTS},
  [EventField.VENUE]: {label: "Venue", notify: true, intro: true, format: Format.VENUE},
  [GroupEventField.ACCESSIBILITY]: {label: "Accessibility", notify: true, intro: false, format: Format.METADATA},
  [GroupEventField.ADDITIONAL_DETAILS]: {label: "Additional details", notify: true, intro: true, format: Format.MARKDOWN},
  [GroupEventField.AREA_CODE]: {label: "Area code", notify: true, intro: false, format: Format.TEXT},
  [GroupEventField.ASCENT_FEET]: {label: "Ascent in feet", notify: true, intro: false, format: Format.TEXT},
  [GroupEventField.ASCENT_METRES]: {label: "Ascent in metres", notify: true, intro: false, format: Format.TEXT},
  [GroupEventField.CANCELLATION_REASON]: {label: "Cancellation reason", notify: true, intro: true, format: Format.TEXT},
  [GroupEventField.DATE_CREATED]: {label: "Date created", notify: false, intro: false, format: Format.DATE_TIME},
  [GroupEventField.DATE_UPDATED]: {label: "Date updated", notify: false, intro: false, format: Format.DATE_TIME},
  [GroupEventField.DESCRIPTION]: {label: "Walk description", notify: true, intro: true, format: Format.MARKDOWN},
  [GroupEventField.DIFFICULTY]: {label: "Grade", notify: true, intro: true, format: Format.METADATA},
  [GroupEventField.DISTANCE_KM]: {label: "Distance in kilometres", notify: true, intro: false, format: Format.TEXT},
  [GroupEventField.DISTANCE_MILES]: {label: "Distance in miles", notify: true, intro: true, format: Format.TEXT},
  [GroupEventField.DURATION]: {label: "Duration", notify: true, intro: true, format: Format.TEXT},
  [GroupEventField.END_DATE_TIME]: {label: "End date & time", notify: true, intro: true, format: Format.DATE_TIME},
  [GroupEventField.END_LOCATION]: {label: "End location", notify: true, intro: true, format: Format.LOCATION},
  [GroupEventField.EVENT_ORGANISER]: {label: "Event organiser", notify: true, intro: false, format: Format.CONTACT},
  [GroupEventField.EXTERNAL_URL]: {label: "External link", notify: true, intro: false, format: Format.TEXT},
  [GroupEventField.FACILITIES]: {label: "Facilities", notify: true, intro: false, format: Format.METADATA},
  [GroupEventField.GROUP_CODE]: {label: "Group code", notify: false, intro: false, format: Format.TEXT},
  [GroupEventField.GROUP_NAME]: {label: "Group name", notify: true, intro: false, format: Format.TEXT},
  [GroupEventField.ITEM_TYPE]: {label: "Event type", notify: true, intro: false, format: Format.TEXT},
  [GroupEventField.LINKED_EVENT]: {label: "Linked event", notify: true, intro: false, format: Format.TEXT},
  [GroupEventField.LOCATION]: {label: "Location", notify: true, intro: true, format: Format.LOCATION},
  [GroupEventField.MEDIA]: {label: "Walk images", notify: true, intro: false, format: Format.MEDIA},
  [GroupEventField.MEETING_DATE_TIME]: {label: "Meeting date & time", notify: true, intro: true, format: Format.DATE_TIME},
  [GroupEventField.MEETING_LOCATION]: {label: "Meeting location", notify: true, intro: true, format: Format.LOCATION},
  [GroupEventField.SHAPE]: {label: "Route type", notify: true, intro: true, format: Format.TEXT},
  [GroupEventField.START_DATE]: {label: "Start date & time", notify: true, intro: true, format: Format.DATE_TIME},
  [GroupEventField.START_LOCATION]: {label: "Starting location", notify: true, intro: true, format: Format.LOCATION},
  [GroupEventField.STATUS]: {label: "Status", notify: true, intro: true, format: Format.TEXT},
  [GroupEventField.TITLE]: {label: "Title", notify: true, intro: true, format: Format.TEXT},
  [GroupEventField.TRANSPORT]: {label: "Transport", notify: true, intro: false, format: Format.METADATA},
  [GroupEventField.URL]: {label: "Ramblers link", notify: false, intro: false, format: Format.TEXT},
  [GroupEventField.WALK_LEADER]: {label: "Walk leader", notify: true, intro: true, format: Format.CONTACT}
};

export const WALK_LOCATION_NOTIFICATION_FIELDS: string[] = [
  GroupEventField.END_LOCATION,
  GroupEventField.LOCATION,
  GroupEventField.MEETING_LOCATION,
  GroupEventField.START_LOCATION
];
