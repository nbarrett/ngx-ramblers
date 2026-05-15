import debug from "debug";
import express, { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import * as authConfig from "../auth/auth-config";
import { configuredCloudflare } from "./cloudflare-config";
import { queryWebAnalyticsSummary } from "./cloudflare-analytics";
import { errorResponse } from "../shared/error-response";
import { CloudflareWebAnalyticsRequest } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-web-analytics.model";

const messageType = "cloudflare:web-analytics";
const debugLog = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;
const errorDebugLog = debug("ERROR:" + envConfig.logNamespace(messageType));
errorDebugLog.enabled = true;

const router = express.Router();

router.post("/analytics", authConfig.authenticate(), async (req: Request, res: Response) => {
  const request: CloudflareWebAnalyticsRequest = req.body;
  debugLog("POST /analytics request:", request);
  try {
    if (!request?.siteTag) {
      res.status(400).json({request: {messageType}, error: {message: "siteTag is required"}});
      return;
    }
    const cloudflareConfig = await configuredCloudflare();
    const summary = await queryWebAnalyticsSummary(cloudflareConfig, request);
    res.json({request: {messageType}, response: summary});
  } catch (error) {
    errorDebugLog("Error querying web analytics:", error.message, error.stack);
    res.status(500).json({request: {messageType}, error: errorResponse(error)});
  }
});

export const cloudflareWebAnalyticsRoutes = router;
