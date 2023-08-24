const express = require("express");
const log = require("./log-requests");
const router = express.Router();

router.post("/", log.requests);
module.exports = router;
