import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { BookingConfig, BookingEmailType } from "../../../../projects/ngx-ramblers/src/app/models/booking-config.model";
import { Booking, BookingAttendee } from "../../../../projects/ngx-ramblers/src/app/models/booking.model";
import { renderMarkdownToHtml } from "../../shared/markdown-renderer";
import { dateTimeFromIso } from "../../shared/dates";

const debugLog = debug(envConfig.logNamespace("booking-template-resolver"));
debugLog.enabled = false;

export const DEFAULT_BOOKING_EMAIL_TEMPLATES: Record<BookingEmailType, string> = {
  confirmation: `Hi {{ATTENDEE_NAME}},

Your booking has been confirmed for **{{EVENT_TITLE}}**.

**Date:** {{EVENT_DATE}}

**Places booked:** {{PLACES_COUNT}}

**Attendees:**

{{ATTENDEE_LIST}}

If you need to cancel your booking, you can do so from the [event page]({{EVENT_LINK}}) using the email address you booked with.`,

  cancellation: `Hi {{ATTENDEE_NAME}},

Your booking for **{{EVENT_TITLE}}** has been cancelled.

**Date:** {{EVENT_DATE}}

**Places released:** {{PLACES_COUNT}}

**Attendees removed:**

{{ATTENDEE_LIST}}

If this was done in error, you can rebook from the [event page]({{EVENT_LINK}}).`,

  waitlisted: `Hi {{ATTENDEE_NAME}},

Your booking for **{{EVENT_TITLE}}** has been moved to the waiting list.

**Date:** {{EVENT_DATE}}

**Places affected:** {{PLACES_COUNT}}

**Attendees:**

{{ATTENDEE_LIST}}

This happened because a member has booked during the member priority period and the event was full. If a place becomes available, your booking will be automatically restored and you will be notified by email.

We apologise for any inconvenience. You can still view the event details on the [event page]({{EVENT_LINK}}).`,

  restored: `Hi {{ATTENDEE_NAME}},

Great news! Your booking for **{{EVENT_TITLE}}** has been restored.

**Date:** {{EVENT_DATE}}

**Places restored:** {{PLACES_COUNT}}

**Attendees:**

{{ATTENDEE_LIST}}

A place became available and your booking has been automatically confirmed. No further action is needed. Event details are on the [event page]({{EVENT_LINK}}).`,

  reminder: `Hi {{ATTENDEE_NAME}},

This is a reminder that **{{EVENT_TITLE}}** is coming up soon.

**Date:** {{EVENT_DATE}}

**Places booked:** {{PLACES_COUNT}}

**Attendees:**

{{ATTENDEE_LIST}}

View full event details on the [event page]({{EVENT_LINK}}).`
};

function attendeeFirstName(attendee: BookingAttendee): string {
  return attendee?.displayName?.split(" ")?.[0] || attendee?.displayName || "there";
}

function attendeeListMarkdown(attendees: BookingAttendee[]): string {
  if (!attendees?.length) {
    return "";
  }
  return attendees.map(attendee => attendee.email ? `- ${attendee.displayName} (${attendee.email})` : `- ${attendee.displayName}`).join("\n");
}

function formatEventDateTime(startDateTime: string): string {
  if (!startDateTime) {
    return "Date to be confirmed";
  }
  const dt = dateTimeFromIso(startDateTime);
  return dt.toFormat("EEEE, d MMMM yyyy 'at' h:mm a");
}

function replacePlaceholders(template: string, placeholders: Record<string, string>): string {
  return template.replace(/\{\{(\w+)}}/g, (match, key) => placeholders[key] ?? match);
}

export function resolveBookingTemplate(
  emailType: BookingEmailType,
  event: any,
  bookingRecord: Booking,
  eventLink: string,
  bookingConfig: BookingConfig | null
): string {
  const overrides = event?.fields?.bookingEmailOverrides;
  const overrideTemplate = overrides?.[emailType] || null;

  const configTemplate = bookingConfig?.emailTemplates?.[emailType];
  const markdownTemplate = overrideTemplate || configTemplate || DEFAULT_BOOKING_EMAIL_TEMPLATES[emailType];

  const placeholders: Record<string, string> = {
    EVENT_TITLE: event?.groupEvent?.title || "Event",
    EVENT_DATE: formatEventDateTime(event?.groupEvent?.start_date_time),
    EVENT_LINK: eventLink || "",
    ATTENDEE_NAME: attendeeFirstName(bookingRecord.attendees?.[0]),
    ATTENDEE_LIST: attendeeListMarkdown(bookingRecord.attendees),
    PLACES_COUNT: String(bookingRecord.attendees?.length || 0)
  };

  const resolved = replacePlaceholders(markdownTemplate, placeholders);
  return renderMarkdownToHtml(resolved);
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
