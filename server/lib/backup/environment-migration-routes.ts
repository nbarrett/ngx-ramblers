import express from "express";
import { NextFunction, Request, Response } from "express";
import * as authConfig from "../auth/auth-config";
import * as controller from "./environment-migration-controller";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { booleanOf } from "../shared/string-utils";

const router = express.Router();

function requireEnvironmentMigrationAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!booleanOf(process.env[Environment.PLATFORM_ADMIN_ENABLED])) {
    res.status(403).json({ error: "Environment migration is not enabled on this environment" });
    return;
  }

  const user = req.user as any;
  const isAdmin = !!(user?.memberAdmin || user?.contentAdmin || user?.fileAdmin ||
    user?.walkAdmin || user?.socialAdmin || user?.treasuryAdmin || user?.financeAdmin);

  if (!isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}

router.get("/history", authConfig.authenticate(), controller.history);
router.get("/:migrationId", authConfig.authenticate(), controller.migration);
router.post("/mongo/plan", authConfig.authenticate(), requireEnvironmentMigrationAdmin, controller.planMongoOnlyMigration);
router.post("/mongo/execute", authConfig.authenticate(), requireEnvironmentMigrationAdmin, controller.executeMongoOnlyMigration);
router.post("/mongo/rotate", authConfig.authenticate(), requireEnvironmentMigrationAdmin, controller.rotateMongoCredentials);

export const environmentMigrationRoutes = router;
