import debug from "debug";
import * as cron from "node-cron";
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

const debugLog = debug(envConfig.logNamespace("cron:booking-reminder"));
debugLog.enabled = true;

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

export async function scheduleBookingReminders() {
  const cronExpression = "0 8 * * *";

  scheduledTask = cron.schedule(cronExpression, async () => {
    debugLog("Starting scheduled booking reminder check");
    try {
      await sendPendingReminders();
    } catch (error) {
      debugLog("Scheduled reminder check failed:", error);
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

export async function sendReminderEmailsForEvent(eventId: string, includePreviouslySent: boolean = false, suppliedEvent: any = null): Promise<BookingReminderDispatch> {
  const event = suppliedEvent || await extendedGroupEvent.findById(eventId).lean().then(doc => doc ? transforms.toObjectWithId(doc) : null);

  if (!event) {
    throw new Error("Event not found");
  }

  const activeBookings = await booking.find({
    eventIds: event.id,
    status: BookingStatus.ACTIVE
  });

  const unsentBookings = includePreviouslySent
    ? activeBookings
    : activeBookings.filter(bookingDoc => !bookingDoc.reminderSentAt);

  if (unsentBookings.length === 0) {
    debugLog("No reminder candidates for event:", event.groupEvent?.title);
    return {
      eventId: event.id,
      eventTitle: event.groupEvent?.title || "Event",
      sentCount: 0,
      alreadySentCount: activeBookings.length,
      skippedCount: 0
    };
  }

  debugLog("Sending", unsentBookings.length, "reminders for event:", event.groupEvent?.title);
  const eventLink = event.groupEvent?.url || "";
  const reminderResults = await Promise.all(unsentBookings.map(async bookingDoc => {
    try {
      const bookingRecord = transforms.toObjectWithId(bookingDoc);
      await sendBookingReminderEmail(bookingRecord, event, eventLink);
      await booking.findByIdAndUpdate(bookingDoc._id, {reminderSentAt: dateTimeNowAsValue()});
      debugLog("Reminder sent for booking:", bookingDoc._id);
      return {sent: 1, skipped: 0};
    } catch (error) {
      debugLog("Failed to send reminder for booking:", bookingDoc._id, error);
      return {sent: 0, skipped: 1};
    }
  }));

  const sentCount = reminderResults.reduce((sum, result) => sum + result.sent, 0);
  const skippedCount = reminderResults.reduce((sum, result) => sum + result.skipped, 0);

  return {
    eventId: event.id,
    eventTitle: event.groupEvent?.title || "Event",
    sentCount,
    alreadySentCount: activeBookings.length - unsentBookings.length,
    skippedCount
  };
}

export async function sendEmailsByTypeForEvent(eventId: string, emailType: BookingEmailType): Promise<BookingReminderDispatch> {
  if (emailType === BookingEmailType.REMINDER) {
    return sendReminderEmailsForEvent(eventId, true);
  }

  const event = await extendedGroupEvent.findById(eventId).lean().then(doc => doc ? transforms.toObjectWithId(doc) : null);
  if (!event) {
    throw new Error("Event not found");
  }

  const relevantStatuses: BookingStatus[] = emailType === BookingEmailType.WAITLISTED
    ? [BookingStatus.WAITLISTED]
    : emailType === BookingEmailType.CANCELLATION
      ? [BookingStatus.CANCELLED]
      : [BookingStatus.ACTIVE];

  const candidateBookings = await booking.find({
    eventIds: event.id,
    status: {$in: relevantStatuses}
  });

  if (candidateBookings.length === 0) {
    return {
      eventId: event.id,
      eventTitle: event.groupEvent?.title || "Event",
      sentCount: 0,
      alreadySentCount: 0,
      skippedCount: 0
    };
  }

  const eventLink = event.groupEvent?.url || "";
  const sendResults = await Promise.all(candidateBookings.map(async bookingDoc => {
    try {
      const bookingRecord: Booking = transforms.toObjectWithId(bookingDoc);
      switch (emailType) {
        case BookingEmailType.CONFIRMATION:
          await sendBookingConfirmationEmail(bookingRecord, event, eventLink);
          break;
        case BookingEmailType.CANCELLATION:
          await sendBookingCancellationEmail(bookingRecord, event, eventLink);
          break;
        case BookingEmailType.WAITLISTED:
          await sendBookingWaitlistedEmail(bookingRecord, event, eventLink);
          break;
        case BookingEmailType.RESTORED:
          await sendBookingRestoredEmail(bookingRecord, event, eventLink);
          break;
        default:
          return {sent: 0, skipped: 1};
      }
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
    alreadySentCount: 0,
    skippedCount
  };
}

export function stopBookingReminders() {
  if (scheduledTask) {
    scheduledTask.stop();
    debugLog("Booking reminder cron job stopped");
    scheduledTask = null;
  }
}
