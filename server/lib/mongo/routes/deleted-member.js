const express = require("express");
const deletedMember = require("../controllers/deleted-member");
const authConfig = require("../../auth/auth-config");

const router = express.Router();

router.post("", authConfig.authenticate(), deletedMember.create);
router.get("/all", authConfig.authenticate(), deletedMember.all);

module.exports = router;
