import express from "express";
import { envConfig } from "../env-config/env-config";
import debug from "debug";

const router = express.Router();
const debugLog = debug(envConfig.logNamespace("google-maps"));

router.get("/config", (req, res) => {
  debugLog(envConfig.googleMaps);
  res.send(envConfig.googleMaps);
});

export const googleMapsRoutes = router;
