import express = require("express");
import multer = require("multer");
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import * as groups from "./list-groups";
import * as memberBulkLoad from "./member-bulk-load";
import * as ramblersWalkUpload from "./ramblers-walk-upload";
import * as walksAndEvents from "./list-walks";

const router = express.Router();

router.post("/walks-manager/list-walks", walksAndEvents.listWalks);
router.post("/walks-manager/list-groups", groups.listGroups);
router.post("/walks-manager/upload-walks", authConfig.authenticate(), ramblersWalkUpload.uploadWalks);
router.post("/walks-manager/walk-leader-ids", authConfig.authenticate(), walksAndEvents.walkLeaderIds);
router.post("/monthly-reports/upload", authConfig.authenticate(), multer({dest: envConfig.server.uploadDir}).any(), memberBulkLoad.uploadRamblersData);

export const ramblersRoutes = router;
