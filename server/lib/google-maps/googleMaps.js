const express = require("express");
const {envConfig} = require("../env-config/env-config");
const router = express.Router();
let debug = require("debug")(envConfig.logNamespace("google-maps"));

router.get("/config", (req, res) => {
  debug(envConfig.googleMaps);
  res.send(envConfig.googleMaps);
});

module.exports = router;
