import { RamblersEventType } from "./ramblers-walks-manager";

export enum BookingEmailType {
  CONFIRMATION = "confirmation",
  CANCELLATION = "cancellation",
  WAITLISTED = "waitlisted",
  RESTORED = "restored",
  REMINDER = "reminder"
}

export type BookingEmailTemplates = Record<BookingEmailType, string>;

export const BOOKING_EMAIL_BLOCK_KEYS: Record<BookingEmailType, string> = {
  [BookingEmailType.CONFIRMATION]: "BOOKING_CONFIRMATION",
  [BookingEmailType.CANCELLATION]: "BOOKING_CANCELLATION",
  [BookingEmailType.WAITLISTED]: "BOOKING_WAITLISTED",
  [BookingEmailType.RESTORED]: "BOOKING_RESTORED",
  [BookingEmailType.REMINDER]: "BOOKING_REMINDER"
};

export const DEFAULT_BOOKING_EMAIL_BLOCKS: Record<BookingEmailType, string> = {
  [BookingEmailType.CONFIRMATION]: `Hi {{params.bookingMergeFields.ATTENDEE_NAME}},

Your booking has been confirmed for **{{params.bookingMergeFields.EVENT_TITLE}}**.

**Date:** {{params.bookingMergeFields.EVENT_DATE}}

**Places booked:** {{params.bookingMergeFields.PLACES_COUNT}}

**Attendees:**

{{params.bookingMergeFields.ATTENDEE_LIST}}

If you need to cancel your booking, you can do so from the [event page]({{params.bookingMergeFields.EVENT_LINK}}) using the email address you booked with.`,

  [BookingEmailType.CANCELLATION]: `Hi {{params.bookingMergeFields.ATTENDEE_NAME}},

Your booking for **{{params.bookingMergeFields.EVENT_TITLE}}** has been cancelled.

**Date:** {{params.bookingMergeFields.EVENT_DATE}}

**Places released:** {{params.bookingMergeFields.PLACES_COUNT}}

**Attendees removed:**

{{params.bookingMergeFields.ATTENDEE_LIST}}

If this was done in error, you can rebook from the [event page]({{params.bookingMergeFields.EVENT_LINK}}).`,

  [BookingEmailType.WAITLISTED]: `Hi {{params.bookingMergeFields.ATTENDEE_NAME}},

Your booking for **{{params.bookingMergeFields.EVENT_TITLE}}** has been moved to the waiting list.

**Date:** {{params.bookingMergeFields.EVENT_DATE}}

**Places affected:** {{params.bookingMergeFields.PLACES_COUNT}}

**Attendees:**

{{params.bookingMergeFields.ATTENDEE_LIST}}

This happened because a member has booked during the member priority period and the event was full. If a place becomes available, your booking will be automatically restored and you will be notified by email.

We apologise for any inconvenience. You can still view the event details on the [event page]({{params.bookingMergeFields.EVENT_LINK}}).`,

  [BookingEmailType.RESTORED]: `Hi {{params.bookingMergeFields.ATTENDEE_NAME}},

Great news! Your booking for **{{params.bookingMergeFields.EVENT_TITLE}}** has been restored.

**Date:** {{params.bookingMergeFields.EVENT_DATE}}

**Places restored:** {{params.bookingMergeFields.PLACES_COUNT}}

**Attendees:**

{{params.bookingMergeFields.ATTENDEE_LIST}}

A place became available and your booking has been automatically confirmed. No further action is needed. Event details are on the [event page]({{params.bookingMergeFields.EVENT_LINK}}).`,

  [BookingEmailType.REMINDER]: `Hi {{params.bookingMergeFields.ATTENDEE_NAME}},

This is a reminder that **{{params.bookingMergeFields.EVENT_TITLE}}** is coming up soon.

**Date:** {{params.bookingMergeFields.EVENT_DATE}}

**Places booked:** {{params.bookingMergeFields.PLACES_COUNT}}

**Attendees:**

{{params.bookingMergeFields.ATTENDEE_LIST}}

View full event details on the [event page]({{params.bookingMergeFields.EVENT_LINK}}).`
};

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
