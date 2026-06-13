import {
  BOOKING_EMAIL_BLOCK_KEYS,
  BookingEmailType,
  DEFAULT_BOOKING_EMAIL_BLOCKS
} from "../../../../projects/ngx-ramblers/src/app/models/booking-config.model";
import { Booking, BookingAttendee } from "../../../../projects/ngx-ramblers/src/app/models/booking.model";
import {
  BookingMergeFields,
  NotificationConfig,
  TemplateOverrideState,
  TemplateOverrideType
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { dateTimeFromIso } from "../../shared/dates";
import { renderMarkdownPreservingTokens } from "../common/messages";
import { UIDateFormat } from "../../../../projects/ngx-ramblers/src/app/models/date-format.model";

export { BOOKING_EMAIL_BLOCK_KEYS, DEFAULT_BOOKING_EMAIL_BLOCKS };

function attendeeFirstName(attendee: BookingAttendee): string {
  return attendee?.displayName?.split(" ")?.[0] || attendee?.displayName || "there";
}

function attendeeListHtml(attendees: BookingAttendee[]): string {
  if (!attendees?.length) {
    return "";
  }
  const items = attendees
    .map(attendee => attendee.email ? `<li>${attendee.displayName} (${attendee.email})</li>` : `<li>${attendee.displayName}</li>`)
    .join("");
  return `<ul>${items}</ul>`;
}

function formatEventDateTime(startDateTime: string): string {
  if (!startDateTime) {
    return "Date to be confirmed";
  }
  return dateTimeFromIso(startDateTime).toFormat(UIDateFormat.DISPLAY_DATE_AT_TIME);
}

export function buildBookingMergeFields(event: any, bookingRecord: Booking, eventLink: string): BookingMergeFields {
  return {
    ATTENDEE_NAME: attendeeFirstName(bookingRecord.attendees?.[0]),
    EVENT_TITLE: event?.groupEvent?.title || "Event",
    EVENT_DATE: formatEventDateTime(event?.groupEvent?.start_date_time),
    EVENT_LINK: eventLink || "",
    ATTENDEE_LIST: attendeeListHtml(bookingRecord.attendees),
    PLACES_COUNT: String(bookingRecord.attendees?.length || 0)
  };
}

export function resolveBookingBody(emailType: BookingEmailType, event: any, notifConfig: NotificationConfig | null): string {
  const perEventOverride: string = event?.fields?.bookingEmailOverrides?.[emailType]?.trim();
  if (perEventOverride) {
    return renderMarkdownPreservingTokens(perEventOverride);
  }
  const siteOverride = notifConfig?.templateOverrides?.[BOOKING_EMAIL_BLOCK_KEYS[emailType]];
  if (siteOverride?.state === TemplateOverrideState.CUSTOM
    && siteOverride?.type === TemplateOverrideType.CONTENT
    && siteOverride.content?.trim()) {
    return renderMarkdownPreservingTokens(siteOverride.content);
  }
  return renderMarkdownPreservingTokens(DEFAULT_BOOKING_EMAIL_BLOCKS[emailType]);
}

export function subjectForType(emailType: BookingEmailType, eventTitle: string): string {
  if (emailType === BookingEmailType.CONFIRMATION) {
    return `Booking Confirmed — ${eventTitle}`;
  } else if (emailType === BookingEmailType.CANCELLATION) {
    return `Booking Cancelled — ${eventTitle}`;
  } else if (emailType === BookingEmailType.WAITLISTED) {
    return `Booking Waitlisted — ${eventTitle}`;
  } else if (emailType === BookingEmailType.RESTORED) {
    return `Booking Restored — ${eventTitle}`;
  } else {
    return `Event Reminder — ${eventTitle}`;
  }
}
