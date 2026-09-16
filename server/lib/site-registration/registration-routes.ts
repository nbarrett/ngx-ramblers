import { asyncRoute } from "../shared/async-route";
import express from "express";
import { authenticate } from "../auth/auth-config";
import {
  beginRegistration, discoverRegistration, listRegistrations, lookupRegistrationLogo, markRegistrationBroken, queueRegistration,
  readRegistration, readRegistrationSettings, registrationAvailability, registrationError,
  requireRegistrationAdmin, requireRegistrationPlatform, retryOwnRegistration, retryRegistration, reviewRegistration, deleteRegistration, sendRegistrationReturnLink, stopRegistration,
  updateRegistration, updateRegistrationSettings, verifyRegistration
} from "./registration-controllers";

export const registrationRoutes = express.Router();
registrationRoutes.use(requireRegistrationPlatform);
registrationRoutes.get("/availability", asyncRoute("site-registration", registrationAvailability));
registrationRoutes.get("/logo", asyncRoute("site-registration", lookupRegistrationLogo));
registrationRoutes.post("/start", asyncRoute("site-registration", beginRegistration));
registrationRoutes.post("/confirm", asyncRoute("site-registration", verifyRegistration));
registrationRoutes.get("/current", asyncRoute("site-registration", readRegistration));
registrationRoutes.put("/current", asyncRoute("site-registration", updateRegistration));
registrationRoutes.post("/discover", asyncRoute("site-registration", discoverRegistration));
registrationRoutes.post("/submit", asyncRoute("site-registration", queueRegistration));
registrationRoutes.post("/retry", asyncRoute("site-registration", retryOwnRegistration));
registrationRoutes.get("/admin", authenticate(), requireRegistrationAdmin, asyncRoute("site-registration", listRegistrations));
registrationRoutes.get("/admin/settings", authenticate(), requireRegistrationAdmin, asyncRoute("site-registration", readRegistrationSettings));
registrationRoutes.put("/admin/settings", authenticate(), requireRegistrationAdmin, asyncRoute("site-registration", updateRegistrationSettings));
registrationRoutes.post("/admin/:id/approve", authenticate(), requireRegistrationAdmin, asyncRoute("site-registration", reviewRegistration));
registrationRoutes.post("/admin/:id/retry", authenticate(), requireRegistrationAdmin, asyncRoute("site-registration", retryRegistration));
registrationRoutes.post("/admin/:id/return-link", authenticate(), requireRegistrationAdmin, asyncRoute("site-registration", sendRegistrationReturnLink));
registrationRoutes.post("/admin/:id/stop", authenticate(), requireRegistrationAdmin, asyncRoute("site-registration", stopRegistration));
registrationRoutes.post("/admin/:id/broken", authenticate(), requireRegistrationAdmin, asyncRoute("site-registration", markRegistrationBroken));
registrationRoutes.delete("/admin/:id", authenticate(), requireRegistrationAdmin, asyncRoute("site-registration", deleteRegistration));
registrationRoutes.use(registrationError);
