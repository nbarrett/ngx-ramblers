import { NextFunction, Request, Response } from "express";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { configuredCloudflare } from "./cloudflare-config";
import { cloudflareWorkerInventory } from "./cloudflare-worker-inventory";
import { booleanOf } from "../shared/string-utils";

export function requireWorkerInventoryAccess(_req: Request, res: Response, next: NextFunction): void {
  if (!booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED])) {
    res.status(403).json({error: "Platform administration is not enabled on this environment"});
  } else {
    next();
  }
}

export async function workerInventory(_req: Request, res: Response): Promise<void> {
  const config = await configuredCloudflare();
  if (!config.apiToken || !config.accountId) {
    res.status(400).json({error: "Configure a Cloudflare account and API token in Global Settings first"});
  } else {
    res.json({response: await cloudflareWorkerInventory(config)});
  }
}
