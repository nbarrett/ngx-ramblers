import { envConfig } from "../env-config/env-config";
import debugLib from "debug";
import * as messageHandlers from "../shared/message-handlers";
import { Request, Response } from "express";
import { systemConfig } from "../config/system-config";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";

const debug = debugLib(envConfig.logNamespace("instagram:refresh-token"));
debug.enabled = true;

export async function refreshAccessToken(req: Request, res: Response) {
  const config: SystemConfig = await systemConfig();
  return messageHandlers.httpRequest({
    apiRequest: {
      hostname: "graph.instagram.com",
      protocol: "https:",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      method: "get",
      path: `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${config.externalSystems.instagram.accessToken}`
    },
    debug,
    res,
    req,
  });
}
