const express = require("express");
const contentMetadata = require("../models/content-metadata");
const controller = require("../controllers/crud-controller").create(contentMetadata);
const authConfig = require("../../auth/auth-config");
const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("", controller.findByConditions);

module.exports = router;
