const {envConfig} = require("../env-config/env-config");
const debug = require("debug")(envConfig.logNamespace("instagram:refresh-token"));
debug.enabled = false;
const messageHandlers = require("../shared/message-handlers");
exports.refreshToken = (req, res) => {
  return messageHandlers.httpRequest({
    apiRequest: {
      hostname: "graph.instagram.com",
      protocol: "https:",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      method: "get",
      path: `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${envConfig.instagram.accessToken}`
    },
    debug: debug,
    res: res,
    req: req,
  })};
