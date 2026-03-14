import { RamblersEventType } from "./ramblers-walks-manager";

export enum BookingEmailType {
  CONFIRMATION = "confirmation",
  CANCELLATION = "cancellation",
  WAITLISTED = "waitlisted",
  RESTORED = "restored",
  REMINDER = "reminder"
}

export type BookingEmailTemplates = Record<BookingEmailType, string>;

export interface BookingConfig {
  enabled: boolean;
  enabledForEventTypes?: RamblersEventType[];
  defaultMaxCapacity: number;
  defaultMaxGroupSize: number;
  defaultMemberPriorityDays: number;
  emailTemplates?: BookingEmailTemplates;
  reminderDaysBefore?: number;
}

export enum BookingPlaceholder {
  EVENT_TITLE = "EVENT_TITLE",
  EVENT_DATE = "EVENT_DATE",
  EVENT_LINK = "EVENT_LINK",
  ATTENDEE_NAME = "ATTENDEE_NAME",
  ATTENDEE_LIST = "ATTENDEE_LIST",
  PLACES_COUNT = "PLACES_COUNT"
}

export const BOOKING_EVENT_TYPES: RamblersEventType[] = [
  RamblersEventType.GROUP_WALK,
  RamblersEventType.GROUP_EVENT,
  RamblersEventType.WELLBEING_WALK
];

export function enabledBookingEventTypes(booking?: BookingConfig): RamblersEventType[] {
  return booking?.enabledForEventTypes?.length > 0 ? booking.enabledForEventTypes : BOOKING_EVENT_TYPES;
}

export function bookingEnabledForEventType(booking: BookingConfig, eventType: RamblersEventType): boolean {
  return !!booking?.enabled && enabledBookingEventTypes(booking).includes(eventType || RamblersEventType.GROUP_WALK);
}
