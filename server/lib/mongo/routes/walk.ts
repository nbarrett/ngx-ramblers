import express from "express";
import * as authConfig from "../../auth/auth-config";
import { walk } from "../models/walk";
import * as crudController from "../controllers/crud-controller";
import { bulkDeleteEvents, bulkUpdateEvents, eventStats, recreateIndex, agmStats, earliestDate } from "../controllers/walk-admin";
import { queryWalkLeaders } from "../controllers/extended-group-event";
import { Walk } from "../../../../projects/ngx-ramblers/src/app/models/deprecated";
import { uploadWalkGpx } from "../../walks/walk-gpx-upload";
import { listWalkGpxFiles } from "../../walks/walk-gpx-list";
import { syncWalksManagerData, getLastSyncTimestamp } from "../../walks/walks-manager-sync";
import { systemConfig } from "../../config/system-config";
import multer from "multer";
import { envConfig } from "../../env-config/env-config";
import { Request, Response } from "express";

const controller = crudController.create<Walk>(walk, false);
const upload = multer({ dest: envConfig.server.uploadDir });
const router = express.Router();

router.post("/sync/walks-manager", authConfig.authenticate(), async (req: Request, res: Response) => {
  try {
    const config = await systemConfig();
    const fullSync = req.body.fullSync || false;
    const result = await syncWalksManagerData(config, { fullSync });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Sync failed", message: error.message });
  }
});

router.get("/sync/status", async (req: Request, res: Response) => {
  try {
    const groupCode = req.query.groupCode as string;
    const lastSyncedAt = await getLastSyncTimestamp(groupCode);
    res.json({ lastSyncedAt });
  } catch (error) {
    res.status(500).json({ error: "Failed to get sync status", message: error.message });
  }
});

router.post("/gpx/upload", authConfig.authenticate(), upload.single("file"), uploadWalkGpx);
router.get("/gpx/list", listWalkGpxFiles);
router.get("/event-stats", authConfig.authenticate(), eventStats);
router.get("/earliest-date", earliestDate);
router.post("/agm-stats", authConfig.authenticate(), agmStats);
router.post("/bulk-delete", authConfig.authenticate(), bulkDeleteEvents);
router.post("/bulk-update", authConfig.authenticate(), bulkUpdateEvents);
router.post("/recreate-index", authConfig.authenticate(), recreateIndex);
router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.post("/update-many", authConfig.authenticate(), controller.updateMany);
router.get("/walk-leaders", queryWalkLeaders);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const walksRoutes = router;
