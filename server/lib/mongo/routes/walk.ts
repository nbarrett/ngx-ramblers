import express from "express";
import * as authConfig from "../../auth/auth-config";
import { walk } from "../models/walk";
import * as crudController from "../controllers/crud-controller";
import * as walkController from "../controllers/walk";

const controller = crudController.create(walk);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/walk-leaders", authConfig.authenticate(), walkController.queryWalkLeaders);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const walksRoutes = router;
