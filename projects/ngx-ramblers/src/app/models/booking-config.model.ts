import { RamblersEventType } from "./ramblers-walks-manager";

export enum BookingEmailType {
  CONFIRMATION = "confirmation",
  CANCELLATION = "cancellation",
  WAITLISTED = "waitlisted",
  RESTORED = "restored",
  REMINDER = "reminder"
}

export type BookingEmailTemplates = Record<BookingEmailType, string>;

export enum BookingScope {
  ALL_EVENTS = "all-events",
  PER_EVENT = "per-event"
}

export interface BookingConfig {
  enabled: boolean;
  scope?: BookingScope;
  enabledForEventTypes?: RamblersEventType[];
  defaultMaxCapacity: number;
  defaultMaxGroupSize: number;
  defaultMemberPriorityDays: number;
  emailTemplates?: BookingEmailTemplates;
  reminderDaysBefore?: number;
  templatesIncludeSalutation?: boolean;
}

export function templatesIncludeSalutation(config: BookingConfig | null | undefined): boolean {
  return config?.templatesIncludeSalutation !== false;
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

export function bookingScope(config?: BookingConfig | null): BookingScope {
  return config?.scope === BookingScope.PER_EVENT ? BookingScope.PER_EVENT : BookingScope.ALL_EVENTS;
}

export function effectiveMaxCapacityForEvent(
  config: BookingConfig | null | undefined,
  event: { fields?: { maxCapacity?: number } } | null | undefined
): number {
  return event?.fields?.maxCapacity || config?.defaultMaxCapacity || 0;
}

export function eventOptedInToBookings(
  config: BookingConfig | null | undefined,
  event: { fields?: { bookingsEnabled?: boolean } } | null | undefined
): boolean {
  if (bookingScope(config) === BookingScope.ALL_EVENTS) {
    return true;
  }
  return !!event?.fields?.bookingsEnabled;
}

export function bookingEnabledForEvent(
  config: BookingConfig | null | undefined,
  event: { fields?: { maxCapacity?: number; bookingsEnabled?: boolean }; groupEvent?: { item_type?: RamblersEventType } } | null | undefined
): boolean {
  return bookingEnabledForEventType(config, event?.groupEvent?.item_type)
    && eventOptedInToBookings(config, event)
    && effectiveMaxCapacityForEvent(config, event) > 0;
}
