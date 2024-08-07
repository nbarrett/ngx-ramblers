import { envConfig } from "../env-config/env-config";
import { refreshAccessToken } from "./refresh-access-token";
import debugLib from "debug";
import * as messageHandlers from "../shared/message-handlers";
import { Request, Response } from "express";
import { Instagram } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { configuredInstagram } from "./instagram-controllers";

const debug = debugLib(envConfig.logNamespace("instagram:recent-media"));
debug.enabled = true;
const refreshOnEachCall = true;

async function recentMediaRequest(req: Request, res: Response) {
  const instagram: Instagram = await configuredInstagram();
  const response = await messageHandlers.httpRequest({
    apiRequest: {
      hostname: "graph.instagram.com",
      protocol: "https:",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      method: "get",
      path: `https://graph.instagram.com/me/media?access_token=${instagram.accessToken}&fields=id,media_type,media_url,permalink,username,timestamp,caption`
    },
    debug,
    res,
    req,
  });
  return res.json(response);
}

export function recentMedia(req: Request, res: Response) {
  if (refreshOnEachCall) {
    refreshAccessToken(req, res)
      .then((apiResponse: any) => {
        debug("refreshToken response:", apiResponse.response, "apiStatusCode:", apiResponse.apiStatusCode);
        return recentMediaRequest(req, res);
      })
      .catch(error => {
        debug("error in refreshOnEachCall:", error);
        return res.status(500).json({error: error.message});
      });
  } else {
    recentMediaRequest(req, res)
      .catch(error => {
        debug("error not in refreshOnEachCall:", error);
        return res.status(500).json({error: error.message});
      });
  }
}
