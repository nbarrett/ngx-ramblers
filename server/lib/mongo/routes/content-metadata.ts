import express from "express";
import * as authConfig from "../../auth/auth-config";
import { contentMetadata } from "../models/content-metadata";
import * as crudController from "../controllers/crud-controller";
import { ContentMetadata } from "../../../../projects/ngx-ramblers/src/app/models/content-metadata.model";

const controller = crudController.create<ContentMetadata>(contentMetadata);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("", controller.findByConditions);
router.get("/all", controller.all);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const contentMetadataRoutes = router;
