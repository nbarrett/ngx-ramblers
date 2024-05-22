import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as mailchimpListAudit from "./../controllers/mailchimp-list-audit";

const router = express.Router();

router.post("", authConfig.authenticate(), mailchimpListAudit.create);
router.get("", authConfig.authenticate(), mailchimpListAudit.findByConditions);
router.get("/all", mailchimpListAudit.all);
router.put("/:id", authConfig.authenticate(), mailchimpListAudit.update);
router.get("/:id", authConfig.authenticate(), mailchimpListAudit.findById);
router.delete("/:id", authConfig.authenticate(), mailchimpListAudit.deleteOne);

export const mailchimpListAuditRoutes = router;
