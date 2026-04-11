import express from "express";
import * as authConfig from "../auth/auth-config";
import * as controller from "./s3-backup-controller";

const router = express.Router();

router.post("/backup", authConfig.authenticate(), controller.startBackup);
router.post("/restore", authConfig.authenticate(), controller.startRestore);
router.get("/manifests", authConfig.authenticate(), controller.listManifests);
router.get("/manifests/:id", authConfig.authenticate(), controller.manifestById);
router.get("/manifests/:site/:timestamp", authConfig.authenticate(), controller.manifestByTimestamp);
router.get("/sites", authConfig.authenticate(), controller.listSites);
router.post("/manifests/delete", authConfig.authenticate(), controller.deleteManifests);

export const s3BackupRoutes = router;
