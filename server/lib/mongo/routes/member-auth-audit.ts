import express from "express";
import * as authConfig from "../../auth/auth-config";
import { memberAuthAudit } from "../models/member-auth-audit";
import * as crudController from "../controllers/crud-controller";

const controller = crudController.create(memberAuthAudit);
const router = express.Router();

router.post("", controller.create);
router.get("", controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const memberAuthAuditRoutes = router;
