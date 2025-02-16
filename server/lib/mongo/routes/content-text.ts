import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as crudController from "../controllers/crud-controller";
import { contentText } from "../models/content-text";

const controller = crudController.create(contentText);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("/all", authConfig.authenticate(), controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", controller.findById);
router.get("", controller.findByConditions);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const contentTextRoutes = router;
