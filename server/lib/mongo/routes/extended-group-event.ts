import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as crudController from "../controllers/crud-controller";
import * as walkController from "../controllers/walk";
import { extendedGroupEvent } from "../models/extended-group-event";
import { count, recreateIndex, urlFromTitle } from "../controllers/extended-group-event";

const controller = crudController.create(extendedGroupEvent, false);
const router = express.Router();
router.get("/recreate-index", authConfig.authenticate(), recreateIndex);
router.get("/count", count);
router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.post("/delete-all", authConfig.authenticate(), controller.deleteAll);
router.post("/update-many", authConfig.authenticate(), controller.updateMany);
router.post("/all", authConfig.authenticate(), controller.createOrUpdateAll);
router.get("/walk-leaders", authConfig.authenticate(), walkController.queryWalkLeaders);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);
router.post("/url-from-title", authConfig.authenticate(), urlFromTitle());

export const extendedGroupEventRoutes = router;
