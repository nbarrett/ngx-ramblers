import express from "express";
import { envConfig } from "../env-config/env-config";
import debug from "debug";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import * as config from "../mongo/controllers/config";

const router = express.Router();
const debugLog = debug(envConfig.logNamespace("google-maps"));
debugLog.enabled = false;

router.get("/config", async (req, res) => {
  try {
    const systemConfig = await config.queryKey(ConfigKey.SYSTEM);
    const googleMapsConfig = systemConfig?.value?.googleMaps;

    if (googleMapsConfig?.apiKey) {
      debugLog("Using Google Maps config from database");
      res.send(googleMapsConfig);
    } else {
      debugLog("No Google Maps API key configured in database");
      res.send({ apiKey: null });
    }
  } catch (error) {
    debugLog("Error fetching Google Maps config:", error);
    res.send({ apiKey: null });
  }
});

export const googleMapsRoutes = router;
