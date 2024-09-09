import express from "express";
import { createEvent } from "./create-event";
import { deleteEvent } from "./delete-event";
import { updateEvent } from "./update-event";
import { all, single } from "./events";
import { locations } from "./locations";
import { create, list } from "./venues";
import { requestAuthorisation } from "./request-authorisation";
import { refreshToken, requestAccess } from "./request-access";
import * as authConfig from "../auth/auth-config";
import { groupDetails } from "./group-details";

const router = express.Router();

router.get("/request-authorisation-url", authConfig.authenticate(), requestAuthorisation);
router.post("/request-access", authConfig.authenticate(), requestAccess);
router.post("/refresh-token", authConfig.authenticate(), refreshToken);
router.delete("/events/delete/:eventId", authConfig.authenticate(), deleteEvent);
router.get("/events/:eventId", single);
router.get("/events", all);
router.patch("/events/update/:eventId", authConfig.authenticate(), updateEvent);
router.post("/events/create", authConfig.authenticate(), createEvent);
router.get("/group-details", groupDetails);
router.post("/venues/create", authConfig.authenticate(), create);
router.get("/venues/list", list);
router.get("/locations", locations);

export const meetupRoutes = router;
