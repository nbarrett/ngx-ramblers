import express from "express";
import * as authConfig from "../auth/auth-config";
import { drivingDistance, googleMapsConfig } from "./google-maps-controllers";

const router = express.Router();

router.get("/config", googleMapsConfig);
router.get("/driving-distance", authConfig.authenticate(), drivingDistance);

export const googleMapsRoutes = router;
