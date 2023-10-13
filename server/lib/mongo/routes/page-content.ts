import express = require("express");

import * as authConfig from "../../auth/auth-config";
import { pageContent } from "../models/page-content";
import * as crudController from "../controllers/crud-controller";

const controller = crudController.create(pageContent, true);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.delete);

export const pageContentRoutes = router;
