import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { DEFAULT_CMS_BASE_URL } from "./models";

const debugLog = debug(envConfig.logNamespace("release-notes:version"));

export async function versionReleases(req: Request, res: Response): Promise<void> {
  try {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.floor(requestedLimit), 200) : 20;
    const response = await fetch(`${DEFAULT_CMS_BASE_URL}/api/public/releases?limit=${limit}`, {
      signal: AbortSignal.timeout(10000)
    });
    if (response.ok) {
      res.set("Cache-Control", "public, max-age=300");
      res.json(await response.json());
    } else {
      debugLog("shared release feed returned status %s", response.status);
      res.status(502).json({message: "Shared release notes are unavailable"});
    }
  } catch (error) {
    debugLog("shared release feed failed: %O", error);
    res.status(502).json({message: "Shared release notes are unavailable"});
  }
}
