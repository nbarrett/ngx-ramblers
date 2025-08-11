import express from "express";
import * as authConfig from "../../auth/auth-config";
import { ramblersUploadAudit } from "../models/ramblers-upload-audit";
import * as crudController from "../controllers/crud-controller";
import { queryUploadSessions } from "../controllers/ramblers-upload-audit";
import { RamblersUploadAudit } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";

const controller = crudController.create<RamblersUploadAudit>(ramblersUploadAudit);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.get("/upload-sessions", authConfig.authenticate(), queryUploadSessions);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const ramblersUploadAuditRoutes = router;
