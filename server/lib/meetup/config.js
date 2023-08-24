const {envConfig} = require("../env-config/env-config");
const debug = require("debug")(envConfig.logNamespace("meetup:config"));

exports.config = function (req, res) {
  debug("meetup:config", JSON.stringify(envConfig.meetup));
  return res.json(envConfig.meetup);
};
