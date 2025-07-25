import express from "express";
import * as authConfig from "../../auth/auth-config";
import { walk } from "../models/walk";
import * as crudController from "../controllers/crud-controller";
import * as walkController from "../controllers/walk";
import { bulkDeleteEvents, eventStats, bulkUpdateEvents, recreateIndex } from "../controllers/walk-admin";

const controller = crudController.create(walk, false);
const router = express.Router();
router.get("/event-stats", authConfig.authenticate(), eventStats);
router.post("/bulk-delete", authConfig.authenticate(), bulkDeleteEvents);
router.post("/bulk-update", authConfig.authenticate(), bulkUpdateEvents);
router.post("/recreate-index", authConfig.authenticate(), recreateIndex);
router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.post("/update-many", authConfig.authenticate(), controller.updateMany);
router.get("/walk-leaders", authConfig.authenticate(), walkController.queryWalkLeaders);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const walksRoutes = router;
