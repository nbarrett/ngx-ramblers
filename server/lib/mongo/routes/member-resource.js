const express = require("express");
const authConfig = require("../../auth/auth-config");
const memberResource = require("../models/member-resource");
const controller = require("../controllers/crud-controller").create(memberResource, false);

const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", controller.findByConditions);
router.get("/all", controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.delete);

module.exports = router;
