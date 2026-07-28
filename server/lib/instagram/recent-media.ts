import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Request, Response } from "express";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";
import { graphApiRequest } from "../social/graph-api";
import { GraphApiMethod } from "../../../projects/ngx-ramblers/src/app/models/social-publish.model";

const debugLog = debug(envConfig.logNamespace("instagram:recent-media"));
debugLog.enabled = false;
const MEDIA_FIELDS = "id,media_type,media_url,permalink,username,timestamp,caption";

export async function recentMedia(req: Request, res: Response): Promise<void> {
  try {
    const config: SystemConfig = await systemConfig();
    const instagram = config?.externalSystems?.instagram;
    const pageAccessToken = config?.externalSystems?.facebook?.pageAccessToken;
    if (!instagram?.igUserId || !pageAccessToken) {
      res.status(400).json({
        request: {},
        error: "Instagram feed needs a Facebook Page connection with a linked Instagram account (System Settings → External Systems → Social Media)"
      });
    } else {
      const response = await graphApiRequest({
        method: GraphApiMethod.GET,
        path: `/${instagram.igUserId}/media`,
        params: {fields: MEDIA_FIELDS, access_token: pageAccessToken},
        debug: debugLog
      });
      res.json({request: {}, response});
    }
  } catch (error) {
    debugLog("error in recentMedia:", error);
    res.status(502).json({request: {}, error: error?.message || String(error)});
  }
}
