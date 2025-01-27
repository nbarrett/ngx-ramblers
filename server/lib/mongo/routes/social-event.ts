import express from "express";
import * as authConfig from "../../auth/auth-config";
import { socialEvent } from "../models/social-event";
import * as crudController from "../controllers/crud-controller";

const controller = crudController.create(socialEvent);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.get("/all-public",  controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const socialEventsRoutes = router;
