import { Request, Response } from "express";
import debug from "debug";
import https from "https";
import { envConfig } from "../env-config/env-config";
import * as systemConfig from "../config/system-config";

const debugLog: debug.Debugger = debug(envConfig.logNamespace("os-maps-proxy"));
debugLog.enabled = true;

export async function tileProxy(req: Request, res: Response) {
  const {layer, z, x, y} = req.params;

  debugLog("Tile proxy request received:", {layer, z, x, y});

  try {
    const config = await systemConfig.systemConfig();
    debugLog("System config retrieved:", {
      hasConfig: !!config,
      hasExternalSystems: !!config?.externalSystems,
      hasOsMaps: !!config?.externalSystems?.osMaps,
      hasApiKey: !!config?.externalSystems?.osMaps?.apiKey
    });

    const apiKey = config?.externalSystems?.osMaps?.apiKey;

    if (!apiKey) {
      debugLog("OS Maps API key not configured - returning 503");
      return res.status(503).json({error: "OS Maps service not configured"});
    }

    const tilePath = `/maps/raster/v1/zxy/${layer}/${z}/${x}/${y}.png?key=${apiKey}`;

    debugLog("Proxying tile request to api.os.uk:", {layer, z, x, y, pathLength: tilePath.length});

    const apiRequest = {
      hostname: "api.os.uk",
      protocol: "https:",
      headers: {
        "User-Agent": "NGX-Ramblers/1.0"
      },
      method: "GET",
      path: tilePath
    };

    const request = https.request(apiRequest, response => {
      debugLog("OS Maps API response:", {
        statusCode: response.statusCode,
        contentType: response.headers["content-type"],
        contentLength: response.headers["content-length"]
      });

      res.statusCode = response.statusCode;
      res.setHeader("Content-Type", response.headers["content-type"] || "image/png");

      if (response.headers["cache-control"]) {
        res.setHeader("Cache-Control", response.headers["cache-control"]);
      }

      response.pipe(res);
    });

    request.on("error", error => {
      debugLog("Tile proxy HTTPS request error:", error);
      if (!res.headersSent) {
        res.status(500).json({error: "Failed to fetch map tile"});
      }
    });

    request.end();
  } catch (error) {
    debugLog("Tile proxy catch error:", error);
    if (!res.headersSent) {
      res.status(500).json({error: "Failed to fetch map tile"});
    }
  }
}
