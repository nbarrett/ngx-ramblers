import express from "express";
import { eventCalendar, eventsCalendarFeed } from "./calendar-controllers";

const router = express.Router();

router.get("/events.ics", eventsCalendarFeed);

router.get("/event/:eventId", eventCalendar);

export const calendarRoutes = router;
