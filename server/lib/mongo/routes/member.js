const express = require("express");
const member = require("../controllers/member");
const authConfig = require("../../auth/auth-config");

const router = express.Router();

router.post("", authConfig.authenticate(), member.create);
router.get("/find-one", authConfig.authenticate(), member.findOne);
router.get("/all", authConfig.authenticate(), member.all);
router.put("/:id", authConfig.authenticate(), member.update);
router.put("/:id/email-subscription", member.updateEmailSubscription);
router.delete("/:id", authConfig.authenticate(), member.delete);
router.get("/:id", authConfig.authenticate(), member.findById);
router.get("/password-reset-id/:id", member.findByPasswordResetId);

module.exports = router;
