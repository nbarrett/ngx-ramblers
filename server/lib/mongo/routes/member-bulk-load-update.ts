import express from "express";
import * as authConfig from "../../auth/auth-config";
import { memberBulkLoadAudit } from "../models/member-bulk-load-audit";
import * as crudController from "../controllers/crud-controller";

const controller = crudController.create(memberBulkLoadAudit, false);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("/member/:id", authConfig.authenticate(), controller.all);
router.get("/all", controller.all);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const memberBulkLoadAuditRoutes = router;
