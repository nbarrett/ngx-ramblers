import { booking } from "../models/booking";
import * as crudController from "./crud-controller";
import {
  Booking,
  BookingCancelRequest,
  BookingCreateRequest,
  BookingReminderDispatch,
  BookingStatus
} from "../../../../projects/ngx-ramblers/src/app/models/booking.model";
import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { dateTimeFromIso, dateTimeNow, dateTimeNowAsValue } from "../../shared/dates";
import { extendedGroupEvent } from "../models/extended-group-event";
import * as transforms from "./transforms";
import {
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendBookingWaitlistedEmail,
  sendBookingRestoredEmail
} from "../../brevo/transactional-mail/send-booking-email";
import { BookingConfig, BookingEmailType, bookingEnabledForEvent, effectiveMaxCapacityForEvent } from "../../../../projects/ngx-ramblers/src/app/models/booking-config.model";
import { loadBookingConfig } from "../../config/booking-config";
import { sendEmailsByTypeForEvent, sendReminderEmailsForEvent } from "../../cron/booking-reminder-job";
import { buildBookingEmailRequest } from "../../brevo/transactional-mail/send-booking-email";
import { values } from "es-toolkit/compat";

const controller = crudController.create<Booking>(booking);
const debugLog = debug(envConfig.logNamespace("booking"));
debugLog.enabled = true;

function normalisedAttendeeEmails(bookingData: Booking): string[] {
  return (bookingData.attendees || [])
    .map(attendee => attendee.email?.trim()?.toLowerCase())
    .filter((email): email is string => !!email);
}

function bookingAttendeeEmail(attendee: Booking["attendees"][number] | null | undefined): string | null {
  return attendee.email?.trim()?.toLowerCase() || null;
}

function bookingHasPrimaryAttendeeWithEmail(bookingData: Booking): boolean {
  return !!bookingAttendeeEmail(bookingData.attendees?.[0]);
}

function normaliseBookingAttendees(bookingData: Booking): Booking {
  return {
    ...bookingData,
    attendees: (bookingData.attendees || []).map(attendee => ({
      ...attendee,
      email: attendee.email?.trim() || null,
      phone: attendee.phone?.trim() || null,
      displayName: attendee.displayName?.trim() || ""
    })).filter(attendee => attendee.displayName)
  };
}

async function existingDuplicateBookingEmails(eventId: string, bookingData: Booking): Promise<string[]> {
  const attendeeEmails = normalisedAttendeeEmails(bookingData);
  if (attendeeEmails.length === 0) {
    return [];
  }
  const existingBookings = await booking.find({
    eventIds: eventId,
    "attendees.email": {$in: attendeeEmails},
    status: {$in: [BookingStatus.ACTIVE, BookingStatus.WAITLISTED]}
  });
  const duplicateEmails = existingBookings
    .flatMap(existingBooking => existingBooking.attendees.map(attendee => attendee.email?.trim()?.toLowerCase()))
    .filter((email): email is string => !!email)
    .filter(email => attendeeEmails.includes(email));
  return [...new Set(duplicateEmails)];
}

export const all = controller.all;
export const deleteOne = controller.deleteOne;
export const findByConditions = controller.findByConditions;
export const update = controller.update;
export const findById = controller.findById;

export async function create(req: Request, res: Response) {
  try {
    const bookingRequest: BookingCreateRequest = req.body?.booking ? req.body : {booking: req.body, eventLink: null};
    const bookingData: Booking = normaliseBookingAttendees(bookingRequest.booking);
    const eventLink = bookingRequest.eventLink;
    const eventId = bookingData.eventIds?.[0];
    const isAuthenticated = !!(req as any).user;
    bookingData.memberBooking = isAuthenticated;

    if (eventId) {
      const event = await extendedGroupEvent.findById(eventId).lean().then(doc => doc ? transforms.toObjectWithId(doc) : null);
      const bookingConfig = await loadBookingConfig();
      if (!bookingEnabledForEvent(bookingConfig, event)) {
        res.status(400).json({error: "Booking is not enabled for this event."});
        return;
      }
      if (!bookingHasPrimaryAttendeeWithEmail(bookingData)) {
        res.status(400).json({error: "Please enter an email address for the first attendee."});
        return;
      }
      const duplicateEmails = await existingDuplicateBookingEmails(eventId, bookingData);
      if (duplicateEmails.length > 0) {
        res.status(400).json({error: `A booking already exists for ${duplicateEmails.join(", ")} on this event.`});
        return;
      }
      const maxCapacity = effectiveMaxCapacityForEvent(bookingConfig, event);

      if (maxCapacity) {
        const activeBookings = await booking.find({eventIds: eventId, status: BookingStatus.ACTIVE});
        const totalBooked = activeBookings.reduce((sum, b) => sum + b.attendees.length, 0);
        const requestedPlaces = bookingData.attendees?.length || 1;

        if (totalBooked + requestedPlaces > maxCapacity) {
          const priorityWindow = memberPriorityWindow(event, bookingConfig);

          if (isAuthenticated && priorityWindow.active) {
            const displaced = await displaceNonMemberBooking(eventId, requestedPlaces, event, eventLink);
            if (!displaced) {
              res.status(400).json({error: "This event is fully booked and no non-member bookings are available to make room."});
              return;
            }
          } else {
            res.status(400).json({error: `This event is fully booked. All ${maxCapacity} places have been taken.`});
            return;
          }
        }
      }

      const savedBooking = await booking.create(bookingData);
      const result = transforms.toObjectWithId(savedBooking);
      debugLog("booking created:", result.id, "memberBooking:", isAuthenticated);
      res.json({request: bookingData, response: result});

      sendBookingConfirmationEmail(result, event, eventLink).catch(err => debugLog("confirmation email error:", err));
    } else {
      const savedBooking = await booking.create(bookingData);
      const result = transforms.toObjectWithId(savedBooking);
      debugLog("booking created:", result.id);
      res.json({request: bookingData, response: result});
    }
  } catch (error) {
    debugLog("create error:", error);
    res.status(500).json({error: "Failed to create booking"});
  }
}

async function displaceNonMemberBooking(eventId: string, placesNeeded: number, event: any, eventLink: string): Promise<boolean> {
  const nonMemberBookings = await booking.find({
    eventIds: eventId,
    status: BookingStatus.ACTIVE,
    memberBooking: {$ne: true}
  }).sort({createdAt: -1});

  let placesFreed = 0;
  const displacedBookings: any[] = [];

  for (const nonMemberBooking of nonMemberBookings) {
    if (placesFreed >= placesNeeded) {
      break;
    }
    nonMemberBooking.status = BookingStatus.WAITLISTED;
    nonMemberBooking.waitlistedAt = dateTimeNowAsValue();
    nonMemberBooking.waitlistedReason = "Displaced by member priority booking";
    await nonMemberBooking.save();
    placesFreed += nonMemberBooking.attendees.length;
    displacedBookings.push(transforms.toObjectWithId(nonMemberBooking));
    debugLog("displaced non-member booking:", nonMemberBooking._id, "freeing", nonMemberBooking.attendees.length, "places");
  }

  if (placesFreed < placesNeeded) {
    debugLog("could not free enough places - needed:", placesNeeded, "freed:", placesFreed);
    await Promise.all(displacedBookings.map(async (displaced) => {
      await booking.findByIdAndUpdate(displaced.id, {
        status: BookingStatus.ACTIVE,
        $unset: {waitlistedAt: 1, waitlistedReason: 1}
      });
    }));
    return false;
  }

  displacedBookings.forEach(displaced => {
    sendBookingWaitlistedEmail(displaced, event, eventLink).catch(err => debugLog("waitlisted email error:", err));
  });

  return true;
}

export async function capacity(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const bookings = await booking.find({eventIds: eventId, status: BookingStatus.ACTIVE});
    const totalBooked = bookings.reduce((sum, b) => sum + b.attendees.length, 0);
    res.json({request: {eventIds: [eventId]}, response: {eventIds: [eventId], totalBooked}});
  } catch (error) {
    debugLog("capacity error:", error);
    res.status(500).json({error: "Failed to retrieve capacity"});
  }
}

export async function lookup(req: Request, res: Response) {
  try {
    const {eventId, email} = req.body;
    if (!eventId || !email) {
      res.status(400).json({error: "eventId and email are required"});
      return;
    }
    const bookings = await booking.find({
      eventIds: eventId,
      "attendees.email": email.toLowerCase(),
      status: {$in: [BookingStatus.ACTIVE, BookingStatus.WAITLISTED]}
    });
    res.json({request: {eventId, email}, response: bookings.map(item => transforms.toObjectWithId(item))});
  } catch (error) {
    debugLog("lookup error:", error);
    res.status(500).json({error: "Failed to lookup bookings"});
  }
}

export async function cancel(req: Request, res: Response) {
  try {
    const bookingId = req.params.id;
    const cancelRequest: BookingCancelRequest = req.body || {email: null, eventLink: null};
    const email = cancelRequest.email;
    const eventLink = cancelRequest.eventLink;
    if (!bookingId) {
      res.status(400).json({error: "Booking id is required"});
      return;
    }
    if (!email) {
      res.status(400).json({error: "Email is required for verification"});
      return;
    }
    const existingBooking = await booking.findById(bookingId);
    if (!existingBooking) {
      res.status(404).json({error: "Booking not found"});
      return;
    }
    const hasMatchingAttendee = existingBooking.attendees.some(attendee => bookingAttendeeEmail(attendee) === email.toLowerCase());
    if (!hasMatchingAttendee) {
      res.status(403).json({error: "Email does not match any attendee in this booking"});
      return;
    }
    if (existingBooking.status === BookingStatus.CANCELLED) {
      res.status(400).json({error: "Booking is already cancelled"});
      return;
    }
    const wasActive = existingBooking.status === BookingStatus.ACTIVE;
    existingBooking.status = BookingStatus.CANCELLED;
    existingBooking.cancelledAt = dateTimeNowAsValue();
    await existingBooking.save();
    debugLog("booking cancelled:", bookingId);
    res.json({request: {id: bookingId}, response: existingBooking});

    const eventId = existingBooking.eventIds?.[0];
    if (eventId) {
      const event = await extendedGroupEvent.findById(eventId).lean().then(doc => doc ? transforms.toObjectWithId(doc) : null);
      sendBookingCancellationEmail(transforms.toObjectWithId(existingBooking), event, eventLink).catch(err => debugLog("cancellation email error:", err));

      if (wasActive) {
        restoreWaitlistedBookings(eventId, existingBooking.attendees.length, event, eventLink).catch(err => debugLog("restore waitlisted error:", err));
      }
    }
  } catch (error) {
    debugLog("cancel error:", error);
    res.status(500).json({error: "Failed to cancel booking"});
  }
}

async function restoreWaitlistedBookings(eventId: string, placesFreed: number, event: any, eventLink: string): Promise<void> {
  const waitlistedBookings = await booking.find({
    eventIds: eventId,
    status: BookingStatus.WAITLISTED
  }).sort({createdAt: 1});

  let placesRestored = 0;

  for (const waitlistedBooking of waitlistedBookings) {
    if (placesRestored + waitlistedBooking.attendees.length > placesFreed) {
      break;
    }
    waitlistedBooking.status = BookingStatus.ACTIVE;
    waitlistedBooking.restoredAt = dateTimeNowAsValue();
    await waitlistedBooking.save();
    placesRestored += waitlistedBooking.attendees.length;
    debugLog("restored waitlisted booking:", waitlistedBooking._id, "restoring", waitlistedBooking.attendees.length, "places");

    sendBookingRestoredEmail(transforms.toObjectWithId(waitlistedBooking), event, eventLink).catch(err => debugLog("restored email error:", err));
  }
}

export async function eligibility(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const event = await extendedGroupEvent.findById(eventId).lean().then(doc => doc ? transforms.toObjectWithId(doc) : null);
    if (!event) {
      res.status(404).json({error: "Event not found"});
      return;
    }

    const bookingConfig = await loadBookingConfig();
    const activeBookings = await booking.find({eventIds: eventId, status: BookingStatus.ACTIVE});
    const totalBooked = activeBookings.reduce((sum, b) => sum + b.attendees.length, 0);
    const waitlistedBookings = await booking.find({eventIds: eventId, status: BookingStatus.WAITLISTED});
    const totalWaitlisted = waitlistedBookings.reduce((sum, b) => sum + b.attendees.length, 0);
    const maxCapacity = event.fields?.maxCapacity || bookingConfig?.defaultMaxCapacity || 0;
    const priorityWindow = memberPriorityWindow(event, bookingConfig);

    res.json({
      response: {
        memberPriorityActive: priorityWindow.active,
        publicBookingOpensAt: priorityWindow.publicOpensAtMillis,
        memberPriorityDays: priorityWindow.days,
        totalWaitlisted,
        capacity: {
          eventIds: [eventId],
          totalBooked,
          maxCapacity,
          fullyBooked: totalBooked >= maxCapacity,
          remainingPlaces: Math.max(0, maxCapacity - totalBooked)
        }
      }
    });
  } catch (error) {
    debugLog("eligibility error:", error);
    res.status(500).json({error: "Failed to retrieve eligibility"});
  }
}

export async function attendeesForEvent(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const bookings = await booking.find({eventIds: eventId, status: BookingStatus.ACTIVE});
    const allAttendees = bookings.flatMap(b => b.attendees).filter(attendee => !!bookingAttendeeEmail(attendee));
    const seen = new Set<string>();
    const uniqueAttendees = allAttendees.filter(a => {
      const key = bookingAttendeeEmail(a);
      if (!key) {
        return false;
      }
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    res.json({
      response: {
        eventId,
        attendees: uniqueAttendees,
        totalBookings: bookings.length
      }
    });
  } catch (error) {
    debugLog("attendeesForEvent error:", error);
    res.status(500).json({error: "Failed to retrieve attendees"});
  }
}

function parseEmailType(value: string): BookingEmailType | null {
  const match = values(BookingEmailType).find(type => type === value);
  return match as BookingEmailType || null;
}

export async function sendEmailsByType(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const emailType = parseEmailType(req.params.emailType);
    if (!eventId) {
      res.status(400).json({error: "Event id is required"});
      return;
    }
    if (!emailType) {
      res.status(400).json({error: "Valid email type is required"});
      return;
    }
    const dispatch: BookingReminderDispatch = await sendEmailsByTypeForEvent(eventId, emailType);
    res.json({request: {eventId, emailType}, response: dispatch});
  } catch (error) {
    debugLog("sendEmailsByType error:", error);
    res.status(500).json({error: "Failed to send booking emails"});
  }
}

export async function previewEmail(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    const emailType = parseEmailType(req.params.emailType);
    if (!eventId) {
      res.status(400).json({error: "Event id is required"});
      return;
    }
    if (!emailType) {
      res.status(400).json({error: "Valid email type is required"});
      return;
    }

    const event = await extendedGroupEvent.findById(eventId).lean().then(doc => doc ? transforms.toObjectWithId(doc) : null);
    if (!event) {
      res.status(404).json({error: "Event not found"});
      return;
    }

    const sampleBooking = await booking.findOne({eventIds: eventId}).lean()
      .then(doc => doc ? transforms.toObjectWithId(doc) : null);
    const previewBooking: Booking = sampleBooking || {
      eventIds: [eventId],
      attendees: [{displayName: "Sample Attendee", email: "attendee@example.com"}],
      status: BookingStatus.ACTIVE
    } as Booking;

    const build = await buildBookingEmailRequest(emailType, previewBooking, event, null);
    if (!build) {
      res.status(400).json({error: "Unable to build preview - notification config missing"});
      return;
    }

    res.json({
      request: {eventId, emailType},
      response: {
        templateId: build.templateId,
        htmlContent: build.bodyContent,
        params: build.params,
        subject: build.subject
      }
    });
  } catch (error) {
    debugLog("previewEmail error:", error);
    res.status(500).json({error: "Failed to build booking email preview"});
  }
}

export async function sendReminders(req: Request, res: Response) {
  try {
    const eventId = req.params.eventId;
    if (!eventId) {
      res.status(400).json({error: "Event id is required"});
      return;
    }

    const reminderDispatch: BookingReminderDispatch = await sendReminderEmailsForEvent(eventId);
    res.json({request: {eventId}, response: reminderDispatch});
  } catch (error) {
    debugLog("sendReminders error:", error);
    res.status(500).json({error: "Failed to send booking reminders"});
  }
}

interface PriorityWindow {
  active: boolean;
  publicOpensAtMillis: number | null;
  days: number | null;
}

function memberPriorityWindow(event: any, bookingConfig?: BookingConfig): PriorityWindow {
  const memberPriorityDays = event?.fields?.memberPriorityDays || bookingConfig?.defaultMemberPriorityDays;
  if (!memberPriorityDays || !event?.groupEvent?.start_date_time) {
    return {active: false, publicOpensAtMillis: null, days: null};
  }
  const eventStart = dateTimeFromIso(event.groupEvent.start_date_time);
  const publicOpensAt = eventStart.minus({days: memberPriorityDays});
  const active = dateTimeNow() < publicOpensAt;
  return {
    active,
    publicOpensAtMillis: publicOpensAt.toMillis(),
    days: memberPriorityDays
  };
}
