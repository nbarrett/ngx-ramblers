import express = require("express");
import createEvent = require("./create-event");
import deleteEvent = require("./delete-event");
import updateEvent = require("./update-event");
import handleAuth = require("./handle-auth");
import config = require("./config");
import events = require("./events");
import locations = require("./locations");
import venues = require("./venues");
const router = express.Router();

router.get("/config", config.config);
router.delete("/events/delete/:eventId", deleteEvent.deleteEvent);
router.get("/events/:eventId", events.single);
router.get("/events", events.all);
router.patch("/events/update/:eventId", updateEvent.updateEvent);
router.post("/events/create", createEvent.createEvent);
router.post("/venues/create", venues.create);
router.get("/venues/list", venues.list);
router.get("/handle-auth", handleAuth.handleAuth);
router.get("/locations", locations.locations);

export const meetup = router;
