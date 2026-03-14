import debug from "debug";
import * as cron from "node-cron";
import { envConfig } from "../env-config/env-config";
import { loadBookingConfig } from "../config/booking-config";
import { booking } from "../mongo/models/booking";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import * as transforms from "../mongo/controllers/transforms";
import { BookingStatus } from "../../../projects/ngx-ramblers/src/app/models/booking.model";
import { dateTimeNow, dateTimeNowAsValue } from "../shared/dates";
import { sendBookingReminderEmail } from "../brevo/transactional-mail/send-booking-email";

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

async function sendPendingReminders() {
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

  await Promise.all(upcomingEvents.map(async (eventDoc) => {
    const event = transforms.toObjectWithId(eventDoc);
    const activeBookings = await booking.find({
      eventIds: event.id,
      status: BookingStatus.ACTIVE,
      reminderSentAt: {$exists: false}
    });

    if (activeBookings.length === 0) {
      debugLog("No unsent reminders for event:", event.groupEvent?.title);
      return;
    }

    debugLog("Sending", activeBookings.length, "reminders for event:", event.groupEvent?.title);
    const eventLink = event.groupEvent?.url || "";

    await Promise.all(activeBookings.map(async (bookingDoc) => {
      try {
        const bookingRecord = transforms.toObjectWithId(bookingDoc);
        await sendBookingReminderEmail(bookingRecord, event, eventLink);
        await booking.findByIdAndUpdate(bookingDoc._id, {reminderSentAt: dateTimeNowAsValue()});
        debugLog("Reminder sent for booking:", bookingDoc._id);
      } catch (error) {
        debugLog("Failed to send reminder for booking:", bookingDoc._id, error);
      }
    }));
  }));
}

export function stopBookingReminders() {
  if (scheduledTask) {
    scheduledTask.stop();
    debugLog("Booking reminder cron job stopped");
    scheduledTask = null;
  }
}
