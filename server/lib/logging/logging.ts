import debug from "debug";
import { Express, Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import morgan, { TokenIndexer } from "morgan";

morgan.token("id", req => req.headers["x-request-id"] as string || "-");

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

function colorStatus(status: number) {
  if (status >= 500) return `${RED}${status}${RESET}`;
  if (status >= 400) return `${YELLOW}${status}${RESET}`;
  if (status >= 300) return `${CYAN}${status}${RESET}`;
  if (status >= 200) return `${GREEN}${status}${RESET}`;
  return status;
}

const debugLog = debug(envConfig.logNamespace("configure-logging"));
debugLog.enabled = false;

export function configureLogging(app: Express): void {
  app.use(morgan((tokens: TokenIndexer, req: Request, res: Response) => {
    const status = Number(tokens.status(req, res));
    const user: any = req.user;
    const userName = user?.userName ? (`${user?.userName} (${user?.firstName} ${user?.lastName})`) : "guest";
    debugLog("User found in request:", user, "userName:", userName);
    return [
      tokens.method(req, res),
      tokens.url(req, res),
      colorStatus(status),
      tokens["response-time"](req, res), "ms",
      "id:", tokens.id(req, res),
      "user:", userName
    ].join(" ");
  }));

}
