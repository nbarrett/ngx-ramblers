import express from "express";
import multer from "multer";
import * as authConfig from "../auth/auth-config";
import { envConfig } from "../env-config/env-config";
import * as groups from "./list-groups";
import * as memberBulkLoad from "./member-bulk-load";
import * as walksAndEvents from "./list-events";
import { walkLeaders } from "./list-walk-leaders";

const router = express.Router();

router.post("/walks-manager/list-events", walksAndEvents.listEvents);
router.post("/walks-manager/list-groups", groups.listGroups);
router.post("/walks-manager/walk-leaders", authConfig.authenticate(), walkLeaders);
router.post("/monthly-reports/upload", authConfig.authenticate(), multer({dest: envConfig.server.uploadDir}).any(), memberBulkLoad.uploadRamblersData);

export const ramblersRoutes = router;
