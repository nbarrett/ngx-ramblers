const express = require("express");
const authConfig = require("../../auth/auth-config");
const socialEvent = require("../models/social-event");
const controller = require("../controllers/crud-controller").create(socialEvent);

const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.get("/all-public",  controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

module.exports = router;
