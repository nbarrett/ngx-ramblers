import express, { NextFunction, Request, Response } from "express";
import * as authConfig from "../../auth/auth-config";
import { Environment } from "../../../../projects/ngx-ramblers/src/app/models/environment.model";
import { booleanOf } from "../../shared/string-utils";
import { executeMoveBrevo, moveBrevoJobStatus, planMoveBrevo } from "./move-brevo-controller";

const router = express.Router();

function requirePlatformAdmin(_req: Request, res: Response, next: NextFunction): void {
  if (!booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED])) {
    res.status(403).json({ error: "Move Brevo is not enabled on this environment" });
  } else {
    next();
  }
}

router.post("/plan", authConfig.authenticate(), requirePlatformAdmin, authConfig.requireAdmin, planMoveBrevo);
router.post("/execute", authConfig.authenticate(), requirePlatformAdmin, authConfig.requireAdmin, executeMoveBrevo);
router.get("/jobs/:jobId", authConfig.authenticate(), requirePlatformAdmin, authConfig.requireAdmin, moveBrevoJobStatus);

export const moveBrevoRoutes = router;
