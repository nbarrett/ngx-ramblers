const express = require("express");
const authConfig = require("../../auth/auth-config");
const expenseClaim = require("../models/expense-claim");
const controller = require("../controllers/crud-controller").create(expenseClaim);

const router = express.Router();

router.post("", authConfig.authenticate(), controller.create);
router.get("", authConfig.authenticate(), controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.get("/:id", authConfig.authenticate(), controller.findById);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

module.exports = router;
