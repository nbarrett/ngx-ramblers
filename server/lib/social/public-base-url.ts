import debug from "debug";
import { Request } from "express";
import { envConfig } from "../env-config/env-config";
import { SystemConfig } from "../../../projects/ngx-ramblers/src/app/models/system.model";

const debugLog = debug(envConfig.logNamespace("social:public-base-url"));
debugLog.enabled = false;

export function requestBaseUrl(req: Request): string {
  const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  return `${protocol}://${req.get("host")}`;
}

function isLocalHost(hostname: string): boolean {
  const host = (hostname || "").toLowerCase().split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".local");
}

function hostnameFrom(req: Request, fromRequest: string): string {
  try {
    return new URL(fromRequest).hostname;
  } catch {
    return req.get("host") || "";
  }
}

export function publicImageBaseUrl(req: Request, config: SystemConfig): string {
  const fromRequest = requestBaseUrl(req);
  const configured = (config?.group?.href || "").trim().replace(/\/+$/, "");
  const hostname = hostnameFrom(req, fromRequest);
  if (configured && isLocalHost(hostname)) {
    debugLog("using group.href for public base URL:", configured, "instead of:", fromRequest);
    return configured;
  } else {
    return fromRequest;
  }
}
