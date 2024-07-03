import express from "express";
import * as authConfig from "../../auth/auth-config";
import { pageContent } from "../models/page-content";
import * as crudController from "../controllers/crud-controller";

const controller = crudController.create(pageContent);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const pageContentRoutes = router;
