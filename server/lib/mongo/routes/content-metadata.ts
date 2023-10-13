import express = require("express");

import * as authConfig from "../../auth/auth-config";
import { contentMetadata } from "../models/content-metadata";
import * as crudController from "../controllers/crud-controller";

const controller = crudController.create(contentMetadata, true);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("", controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.delete("/:id", authConfig.authenticate(), controller.delete);

export const contentMetadataRoutes = router;
