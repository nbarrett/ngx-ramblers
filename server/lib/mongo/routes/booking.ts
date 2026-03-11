import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as booking from "../controllers/booking";

const router = express.Router();

router.post("", authConfig.optionalAuthenticate(), booking.create);
router.get("", authConfig.authenticate(), booking.findByConditions);
router.get("/all", authConfig.authenticate(), booking.all);
router.get("/capacity/:eventId", booking.capacity);
router.get("/eligibility/:eventId", booking.eligibility);
router.get("/attendees/:eventId", authConfig.authenticate(), booking.attendeesForEvent);
router.post("/lookup", booking.lookup);
router.put("/cancel/:id", booking.cancel);
router.put("/:id", authConfig.authenticate(), booking.update);
router.get("/:id", authConfig.authenticate(), booking.findById);
router.delete("/:id", authConfig.authenticate(), booking.deleteOne);

export const bookingRoutes = router;
