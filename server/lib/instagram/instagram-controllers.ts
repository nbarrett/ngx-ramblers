import { envConfig } from "../env-config/env-config";
import debugLib from "debug";
import { Request, Response } from "express";
import { instagram } from "instagram-node";
import { systemConfig } from "../config/system-config";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";

const debug = debugLib(envConfig.logNamespace("instagram"));
debug.enabled = true;
const ig = instagram();
const port = envConfig.server.listenPort;
const redirectUri = `http://localhost:${port}/instagram/handleAuth`;

systemConfig().then((systemConfig: SystemConfig) => {
  const instagramConfig = {
    client_id: systemConfig.externalSystems.instagram.clientId,
    client_secret: systemConfig.externalSystems.instagram.clientSecret,
    access_token: systemConfig.externalSystems.instagram.accessToken,
  };
  debug("configuring ig.use to use instagramConfig:", instagramConfig);
  if (systemConfig.externalSystems.instagram.showFeed) {
    ig.use(instagramConfig);
  }
}).catch((error: Error) => {
  debug("error", error);
});

export function authorise(req: Request, res: Response) {
  const authorizationUrl = ig.get_authorization_url(redirectUri, {scope: ["public_content", "likes"]});
  debug("authorise: called with redirect to", authorizationUrl);
  res.redirect(authorizationUrl);
  }

export function authoriseOK(req: Request, res: Response) {
  debug("handleAuth called with req.query", req.query);
  debug("handleAuth called with req.url", req.url);
  debug("handleAuth called with req.path", req.path);
  res.json({response: "OK"});
  }

export function authoriseUser(req: Request, res: Response) {
  debug("handleAuth called with req.query", req.query);
  debug("handleAuth called with req.url", req.url);
  debug("handleAuth called with req.path", req.path);
  ig.authorize_user(req.query.code, redirectUri, function (err, result) {
    if (err) {
      res.send(err);
    }
    const receivedAccessToken = result.access_token;

    const response = {accessToken: receivedAccessToken, userId: receivedAccessToken.split(".")?.[0]};
    debug("handleAuth:generated new response:", response);
    res.json(response);
  });
}

export function handleAuth(req: Request, res: Response) {
  debug("handleAuth called with req.query", req.query);
  debug("handleAuth called with req.url", req.url);
  debug("handleAuth called with req.path", req.path);
  debug("handleAuth:auth code", req.query.code);
  res.json({response: "OK", query: req.query, url: req.url, path: req.path});
  }

