const express = require("express");
const authConfig = require("../../auth/auth-config");
const memberAuthAudit = require("../models/member-auth-audit");
const controller = require("../controllers/crud-controller").create(memberAuthAudit);

const router = express.Router();

router.post("", controller.create);
router.get("", controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.delete);

module.exports = router;
