const {envConfig} = require("../env-config/env-config");
const debug = require("debug")(envConfig.logNamespace("meetup:handle-auth"));

exports.handleAuth = function (req, res) {
  debug("handleAuth called with req.query", req.query);
  debug("handleAuth called with req.url", req.url);
  debug("handleAuth called with req.path", req.path);
  res.json(req.result);
};
