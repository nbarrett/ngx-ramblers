import express from "express";
import * as authConfig from "../../auth/auth-config";
import { memberBulkLoadAudit } from "../models/member-bulk-load-audit";
import * as crudController from "../controllers/crud-controller";
import { MemberBulkLoadAudit } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { memberBulkLoadDateMap } from "../controllers/member-bulk-load-audit";

const controller = crudController.create<MemberBulkLoadAudit>(memberBulkLoadAudit, false);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("/member/:id", authConfig.authenticate(), controller.all);
router.get("/all", controller.all);
router.get("/member-bulk-load-date-map", memberBulkLoadDateMap);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const memberBulkLoadAuditRoutes = router;
