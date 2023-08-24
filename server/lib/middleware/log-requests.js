const {envConfig} = require("../env-config/env-config");
const debug = require("debug")(envConfig.logNamespace("log-requests"));
const fs = require("fs");
const {get} = require("lodash");
const moment = require("moment-timezone");
const mkdirpsync = require('mkdirpsync');

exports.requests = (req, res) => {
  const path = req.path;
  const query = req.query;
  const body = req.body;
  const payload = get(req.body, "additional", "0") || body;
  const outputDirectory = `../logs`;
  const momentInstance = moment().tz("Europe/London");
  const fileName = `${outputDirectory}/${momentInstance.format("YYYYMMDD-HHmmss-SSS")}-response.json`;
  debug("Saving logs to", fileName);
  if (!fs.existsSync(outputDirectory)) {
    mkdirpsync(outputDirectory);
  }
  fs.writeFileSync(fileName, JSON.stringify({path, query, payload}, null, 2));
  res.send({})
}
