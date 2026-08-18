import { Request, Response } from "express";
import debug from "debug";
import https from "https";
import { envConfig } from "../env-config/env-config";
import * as systemConfig from "../config/system-config";
import { clientKeyFromRequest, takeTileAllowance, warnHighTileUse } from "./os-maps-tile-limiter";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("os-maps-proxy"));
debugLog.enabled = false;
const upstreamTimeoutMs = 10000;
const tileCacheControl = "public, max-age=86400";

export async function tileProxy(req: Request, res: Response) {
  const {layer, z, x, y} = req.params;
  const clientKey = clientKeyFromRequest(req);
  const allowance = takeTileAllowance(clientKey);

  debugLog("Tile proxy request received:", {layer, z, x, y, clientKey, allowed: allowance.allowed});

  if (!allowance.allowed) {
    res.setHeader("Retry-After", String(allowance.retryAfterSeconds));
    res.status(429).json({error: "Too many map tile requests"});
  } else {
    try {
      const config = await systemConfig.systemConfig();
      const apiKey = config?.externalSystems?.osMaps?.apiKey;
      if (!apiKey) {
        debugLog("OS Maps API key not configured - returning 503");
        res.status(503).json({error: "OS Maps service not configured"});
      } else {
        const tilePath = `/maps/raster/v1/zxy/${layer}/${z}/${x}/${y}.png?key=${apiKey}`;
        const timeout = {fired: false};
        const request = https.request({
          hostname: "api.os.uk",
          protocol: "https:",
          headers: {
            "User-Agent": "NGX-Ramblers/1.0"
          },
          method: "GET",
          path: tilePath
        }, response => {
          debugLog("OS Maps API response:", {
            statusCode: response.statusCode,
            contentType: response.headers["content-type"],
            contentLength: response.headers["content-length"]
          });
          res.statusCode = response.statusCode;
          res.setHeader("Content-Type", response.headers["content-type"] || "image/png");
          res.setHeader("Cache-Control", tileCacheControl);
          response.pipe(res);
        });
        request.setTimeout(upstreamTimeoutMs, () => {
          timeout.fired = true;
          request.destroy(new Error(`OS Maps tile request timed out after ${upstreamTimeoutMs}ms`));
        });
        request.on("error", error => {
          debugLog("Tile proxy HTTPS request error:", error);
          if (!res.headersSent) {
            res.status(timeout.fired ? 504 : 500).json({error: timeout.fired ? "OS Maps tile request timed out" : "Failed to fetch map tile"});
          }
        });
        request.end();
      }
    } catch (error) {
      debugLog("Tile proxy catch error:", error);
      if (!res.headersSent) {
        res.status(500).json({error: "Failed to fetch map tile"});
      }
    }
  }

  if (allowance.crossedDailyAlert) {
    void warnHighTileUse(clientKey, allowance.dayCount);
  }
}
