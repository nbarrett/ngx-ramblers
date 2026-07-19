import debug from "debug";
import express, { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { booleanOf } from "../shared/string-utils";
import * as authConfig from "../auth/auth-config";
import { crossEnvironmentHealth } from "./cross-environment-health";
import { allHostnameHealth } from "../environment-setup/hostname-health-controllers";

const debugLog = debug(envConfig.logNamespace("cross-environment-health:routes"));
debugLog.enabled = true;

const router = express.Router();

router.get("/", authConfig.authenticate(), authConfig.requireAdmin, async (_req: Request, res: Response) => {
  if (!booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED])) {
    res.status(403).json({ error: "Cross-environment health monitoring is not enabled on this environment" });
    return;
  }

  try {
    const result = await crossEnvironmentHealth();
    debugLog("Returning cross-environment health for %d environments", result.environments.length);
    res.json(result);
  } catch (error) {
    debugLog("Error checking cross-environment health:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get("/hostnames", authConfig.authenticate(), authConfig.requireAdmin, allHostnameHealth);

export const crossEnvironmentHealthRoutes = router;
