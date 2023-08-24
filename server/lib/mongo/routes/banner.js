const express = require("express");
const authConfig = require("../../auth/auth-config");
const banner = require("../models/banner");
const controller = require("../controllers/crud-controller").create(banner);

const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", authConfig.authenticate(), controller.findByConditions);
router.get("/all", controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", authConfig.authenticate(), controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.delete);

module.exports = router;
