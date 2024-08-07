import { envConfig } from "../env-config/env-config";
import debugLib from "debug";
import { Request, Response } from "express";
import { Instagram, SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { systemConfig } from "../config/system-config";

const debug = debugLib(envConfig.logNamespace("instagram"));
debug.enabled = true;

export async function configuredInstagram(): Promise<Instagram> {
  const config: SystemConfig = await systemConfig();
  return config?.externalSystems?.instagram;
}

export function authoriseOK(req: Request, res: Response) {
  debug("handleAuth called with req.query", req.query);
  debug("handleAuth called with req.url", req.url);
  debug("handleAuth called with req.path", req.path);
  res.json({response: "OK"});
  }

export function handleAuth(req: Request, res: Response) {
  debug("handleAuth called with req.query", req.query);
  debug("handleAuth called with req.url", req.url);
  debug("handleAuth called with req.path", req.path);
  debug("handleAuth:auth code", req.query.code);
  res.json({response: "OK", query: req.query, url: req.url, path: req.path});
}

