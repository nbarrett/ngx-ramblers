import { envConfig } from "../env-config/env-config";
import debugLib from "debug";
import * as messageHandlers from "../shared/message-handlers";
import { Request, Response } from "express";
import { Instagram } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { configuredInstagram } from "./instagram-controllers";

const debug = debugLib(envConfig.logNamespace("instagram:refresh-token"));
debug.enabled = false;

export async function refreshAccessToken(req: Request, res: Response) {
  const instagram: Instagram = await configuredInstagram();
  return messageHandlers.httpRequest({
    apiRequest: {
      hostname: "graph.instagram.com",
      protocol: "https:",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      method: "get",
      path: `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${instagram?.accessToken}`
    },
    debug,
    res,
    req,
  });
}
