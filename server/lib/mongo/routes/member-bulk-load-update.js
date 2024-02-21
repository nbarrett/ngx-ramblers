const express = require("express");
const audit = require("../controllers/member-bulk-load-audit");
const authConfig = require("../../auth/auth-config");

const router = express.Router();

router.post("", authConfig.authenticate(), audit.create);
router.get("/member/:id", authConfig.authenticate(), audit.all);
router.get("/all", audit.all);
router.delete("/:id", authConfig.authenticate(), audit.deleteOne);

module.exports = router;
