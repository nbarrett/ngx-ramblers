import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { loadBookingConfig } from "../config/booking-config";
import { booking } from "../mongo/models/booking";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import * as transforms from "../mongo/controllers/transforms";
import { Booking, BookingReminderDispatch, BookingStatus } from "../../../projects/ngx-ramblers/src/app/models/booking.model";
import { BookingEmailType } from "../../../projects/ngx-ramblers/src/app/models/booking-config.model";
import { dateTimeNow, dateTimeNowAsValue } from "../shared/dates";
import {
  sendBookingCancellationEmail,
  sendBookingConfirmationEmail,
  sendBookingReminderEmail,
  sendBookingRestoredEmail,
  sendBookingWaitlistedEmail
} from "../brevo/transactional-mail/send-booking-email";
import { registerScheduledTask, setScheduledTaskEnabled } from "./scheduled-task-registry";

const debugLog = debug(envConfig.logNamespace("cron:booking-reminder"));
debugLog.enabled = true;

export async function scheduleBookingReminders() {
  const cronExpression = "0 8 * * *";
  await registerScheduledTask({
    id: "booking-reminders",
    name: "Booking reminders",
    description: "Sends due booking reminder messages for upcoming events.",
    cronExpression,
    enabled: true,
    run: async () => {
      debugLog("Starting scheduled booking reminder check");
      await sendPendingReminders();
    }
  });
  debugLog(`Booking reminder cron job scheduled: ${cronExpression} (daily at 8am)`);
}

export async function sendPendingReminders() {
  const bookingConfig = await loadBookingConfig();
  const reminderDays = bookingConfig?.reminderDaysBefore;

  if (!reminderDays || reminderDays <= 0) {
    debugLog("reminderDaysBefore not configured or zero - skipping");
    return;
  }

  const now = dateTimeNow();
  const windowStart = now.startOf("day");
  const windowEnd = now.plus({days: reminderDays}).endOf("day");

  debugLog("Looking for events between", windowStart.toISO(), "and", windowEnd.toISO());

  const upcomingEvents = await extendedGroupEvent.find({
    "groupEvent.start_date_time": {
      $gte: windowStart.toISO(),
      $lte: windowEnd.toISO()
    }
  }).lean();

  if (upcomingEvents.length === 0) {
    debugLog("No events found in reminder window");
    return;
  }

  debugLog("Found", upcomingEvents.length, "events in reminder window");

  await Promise.all(upcomingEvents.map(async eventDoc => {
    const event = transforms.toObjectWithId(eventDoc);
    await sendReminderEmailsForEvent(event.id, false, event);
  }));
}

function relevantStatusesForType(emailType: BookingEmailType): BookingStatus[] {
  return emailType === BookingEmailType.WAITLISTED
    ? [BookingStatus.WAITLISTED]
    : emailType === BookingEmailType.CANCELLATION
      ? [BookingStatus.CANCELLED]
      : [BookingStatus.ACTIVE];
}

export function bookingEmailSentAt(bookingDoc: Booking, emailType: BookingEmailType): number | undefined {
  return bookingDoc.emailSends?.[emailType]
    ?? (emailType === BookingEmailType.REMINDER ? bookingDoc.reminderSentAt : undefined);
}

async function recordBookingEmailSent(bookingId: any, emailType: BookingEmailType): Promise<void> {
  const sentAt = dateTimeNowAsValue();
  const update: Record<string, number> = {[`emailSends.${emailType}`]: sentAt};
  if (emailType === BookingEmailType.REMINDER) {
    update.reminderSentAt = sentAt;
  }
  await booking.findByIdAndUpdate(bookingId, {$set: update});
}

async function sendBookingEmail(emailType: BookingEmailType, bookingRecord: Booking, event: any, eventLink: string | null): Promise<void> {
  switch (emailType) {
    case BookingEmailType.CONFIRMATION:
      return sendBookingConfirmationEmail(bookingRecord, event, eventLink);
    case BookingEmailType.CANCELLATION:
      return sendBookingCancellationEmail(bookingRecord, event, eventLink);
    case BookingEmailType.WAITLISTED:
      return sendBookingWaitlistedEmail(bookingRecord, event, eventLink);
    case BookingEmailType.RESTORED:
      return sendBookingRestoredEmail(bookingRecord, event, eventLink);
    case BookingEmailType.REMINDER:
      return sendBookingReminderEmail(bookingRecord, event, eventLink);
    default:
      throw new Error(`Unsupported booking email type: ${emailType}`);
  }
}

export async function sendReminderEmailsForEvent(eventId: string, includePreviouslySent: boolean = false, suppliedEvent: any = null, bookingIds: string[] | null = null): Promise<BookingReminderDispatch> {
  return sendEmailsByTypeForEvent(eventId, BookingEmailType.REMINDER, includePreviouslySent, suppliedEvent, bookingIds);
}

export async function sendEmailsByTypeForEvent(eventId: string, emailType: BookingEmailType, includePreviouslySent: boolean = false, suppliedEvent: any = null, bookingIds: string[] | null = null): Promise<BookingReminderDispatch> {
  const event = suppliedEvent || await extendedGroupEvent.findById(eventId).lean().then(doc => doc ? transforms.toObjectWithId(doc) : null);

  if (!event) {
    throw new Error("Event not found");
  }

  const candidateBookings = await booking.find({
    eventIds: event.id,
    status: {$in: relevantStatusesForType(emailType)}
  });

  const explicitSelection = !!bookingIds?.length;
  const scopedBookings = explicitSelection
    ? candidateBookings.filter(bookingDoc => bookingIds.includes(String(bookingDoc._id)))
    : candidateBookings;

  const previouslySentCount = scopedBookings.filter(bookingDoc => !!bookingEmailSentAt(bookingDoc, emailType)).length;
  const targetBookings = (explicitSelection || includePreviouslySent)
    ? scopedBookings
    : scopedBookings.filter(bookingDoc => !bookingEmailSentAt(bookingDoc, emailType));

  if (targetBookings.length === 0) {
    debugLog("No", emailType, "candidates to send for event:", event.groupEvent?.title);
    return {
      eventId: event.id,
      eventTitle: event.groupEvent?.title || "Event",
      sentCount: 0,
      alreadySentCount: previouslySentCount,
      skippedCount: 0
    };
  }

  debugLog("Sending", targetBookings.length, emailType, "emails for event:", event.groupEvent?.title);
  const eventLink = null;
  const sendResults = await Promise.all(targetBookings.map(async bookingDoc => {
    try {
      const bookingRecord: Booking = transforms.toObjectWithId(bookingDoc);
      await sendBookingEmail(emailType, bookingRecord, event, eventLink);
      await recordBookingEmailSent(bookingDoc._id, emailType);
      debugLog(emailType, "sent for booking:", bookingDoc._id);
      return {sent: 1, skipped: 0};
    } catch (error) {
      debugLog("Failed to send", emailType, "for booking:", bookingDoc._id, error);
      return {sent: 0, skipped: 1};
    }
  }));

  const sentCount = sendResults.reduce((sum, result) => sum + result.sent, 0);
  const skippedCount = sendResults.reduce((sum, result) => sum + result.skipped, 0);

  return {
    eventId: event.id,
    eventTitle: event.groupEvent?.title || "Event",
    sentCount,
    alreadySentCount: (explicitSelection || includePreviouslySent) ? 0 : previouslySentCount,
    skippedCount
  };
}

export function stopBookingReminders() {
  void setScheduledTaskEnabled("booking-reminders", false);
  debugLog("Booking reminder cron job stopped");
}
