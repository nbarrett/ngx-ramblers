import debug from "debug";
import {Request, Response} from "express";
import {envConfig} from "../env-config/env-config";
import {Environment} from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import {EnvironmentHealthEvent, EnvironmentHealthEventType} from "../../../projects/ngx-ramblers/src/app/models/health.model";
import {booleanOf} from "../shared/string-utils";
import {crossEnvironmentHealth} from "./cross-environment-health";

const debugLog = debug(envConfig.logNamespace("cross-environment-health:controllers"));

export async function allEnvironmentHealth(_req: Request, res: Response): Promise<void> {
  if (!booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED])) {
    res.status(403).json({error: "Cross-environment health monitoring is not enabled on this environment"});
  } else {
    try {
      res.json(await crossEnvironmentHealth());
    } catch (error) {
      debugLog("Error checking cross-environment health: %s", error.message);
      res.status(500).json({error: error.message});
    }
  }
}

export async function streamEnvironmentHealth(_req: Request, res: Response): Promise<void> {
  if (!booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED])) {
    res.status(403).json({error: "Cross-environment health monitoring is not enabled on this environment"});
  } else {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    res.on("close", cancel);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    const send = (event: EnvironmentHealthEvent): void => {
      if (!controller.signal.aborted) {
        res.write(JSON.stringify(event) + "\n");
      }
    };
    try {
      await crossEnvironmentHealth(send, controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        debugLog("Environment health stream failed: %s", error.message);
        send({type: EnvironmentHealthEventType.ERROR, error: error.message});
      }
    } finally {
      res.off("close", cancel);
      if (!res.destroyed) {
        res.end();
      }
    }
  }
}
