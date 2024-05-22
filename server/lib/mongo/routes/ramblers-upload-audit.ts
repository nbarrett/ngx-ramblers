import express from "express";
import * as authConfig from "../../auth/auth-config";
import { ramblersUploadAudit } from "../models/ramblers-upload-audit";
import * as crudController from "../controllers/crud-controller";

const controller = crudController.create(ramblersUploadAudit);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const ramblersUploadAuditRoutes = router;
