import express = require("express");
import * as authConfig from "../../auth/auth-config";
import * as mailListAudit from "./../controllers/mail-list-audit";

const router = express.Router();

router.post("", authConfig.authenticate(), mailListAudit.create);
router.get("", authConfig.authenticate(), mailListAudit.findByConditions);
router.get("/all", mailListAudit.all);
router.put("/:id", authConfig.authenticate(), mailListAudit.update);
router.get("/:id", authConfig.authenticate(), mailListAudit.findById);
router.delete("/:id", authConfig.authenticate(), mailListAudit.deleteOne);

export const mailListAuditRoutes = router;
