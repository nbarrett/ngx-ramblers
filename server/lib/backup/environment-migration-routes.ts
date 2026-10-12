import express from "express";
import * as authConfig from "../auth/auth-config";
import * as controller from "./environment-migration-controller";
import { provisionMigrationMongoTargetRequest } from "./environment-migration-mongo-target";

const router = express.Router();

router.get("/history", authConfig.authenticate(), controller.history);
router.get("/:migrationId", authConfig.authenticate(), controller.migration);
router.post("/mongo/provision", authConfig.authenticate(), controller.requireEnvironmentMigrationEnabled, authConfig.requireAdmin, provisionMigrationMongoTargetRequest);
router.post("/mongo/plan", authConfig.authenticate(), controller.requireEnvironmentMigrationEnabled, authConfig.requireAdmin, controller.planMongoOnlyMigration);
router.post("/mongo/execute", authConfig.authenticate(), controller.requireEnvironmentMigrationEnabled, authConfig.requireAdmin, controller.executeMongoOnlyMigration);
router.post("/mongo/rotate", authConfig.authenticate(), controller.requireEnvironmentMigrationEnabled, authConfig.requireAdmin, controller.rotateMongoCredentials);

export const environmentMigrationRoutes = router;
