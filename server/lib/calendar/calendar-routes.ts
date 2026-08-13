import express from "express";
import { eventCalendar, eventsCalendarFeed, meetingInviteCalendar } from "./calendar-controllers";

const router = express.Router();

router.get("/events.ics", eventsCalendarFeed);

router.get("/event/:eventId", eventCalendar);

router.get("/meeting/:room", meetingInviteCalendar);

export const calendarRoutes = router;
