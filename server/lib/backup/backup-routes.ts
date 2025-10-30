import express from "express";
import * as authConfig from "../auth/auth-config";
import * as controller from "./backup-controller";

const router = express.Router();

router.get("/environments", authConfig.authenticate(), controller.listEnvironments);
router.get("/environments/:environment/collections", authConfig.authenticate(), controller.listCollections);
router.get("/backups", authConfig.authenticate(), controller.listBackups);
router.get("/sessions", authConfig.authenticate(), controller.listSessions);
router.get("/sessions/:sessionId", authConfig.authenticate(), controller.session);
router.post("/backup", authConfig.authenticate(), controller.startBackup);
router.post("/restore", authConfig.authenticate(), controller.startRestore);
router.post("/initialize-config", authConfig.authenticate(), controller.initializeConfig);
router.post("/backups/delete", authConfig.authenticate(), controller.deleteBackups);
router.get("/s3/backups", authConfig.authenticate(), controller.listS3Backups);
router.post("/backups/s3/delete", authConfig.authenticate(), controller.deleteS3Backups);

export const backupRoutes = router;
