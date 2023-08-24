const express = require("express");
const migrator = require("./template-migrator");
const router = express.Router();

router.get("/migrate-template", migrator.migrateTemplate);
module.exports = router;
