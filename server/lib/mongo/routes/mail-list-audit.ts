import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as crudController from "../controllers/crud-controller";
import { mailListAudit } from "../models/mail-list-audit";

const controller = crudController.create(mailListAudit, true);
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", authConfig.authenticate(), controller.findByConditions);
router.get("/all", controller.all);
router.post("/all", controller.createOrUpdateAll);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", authConfig.authenticate(), controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const mailListAuditRoutes = router;
