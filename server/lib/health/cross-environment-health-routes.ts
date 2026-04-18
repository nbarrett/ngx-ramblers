import debug from "debug";
import express, { Request, Response } from "express";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { booleanOf } from "../shared/string-utils";
import * as authConfig from "../auth/auth-config";
import { crossEnvironmentHealth } from "./cross-environment-health";

const debugLog = debug(envConfig.logNamespace("cross-environment-health:routes"));
debugLog.enabled = true;

const router = express.Router();

router.get("/", authConfig.authenticate(), async (req: Request, res: Response) => {
  if (!booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED])) {
    res.status(403).json({ error: "Cross-environment health monitoring is not enabled on this environment" });
    return;
  }

  const user = req.user as any;
  const isAdmin = !!(user?.memberAdmin || user?.contentAdmin || user?.fileAdmin ||
    user?.walkAdmin || user?.socialAdmin || user?.treasuryAdmin || user?.financeAdmin);

  if (!isAdmin) {
    res.status(403).json({ error: "Admin access required" });
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

export const crossEnvironmentHealthRoutes = router;
