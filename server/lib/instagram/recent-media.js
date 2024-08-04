const {envConfig} = require("../env-config/env-config");
const refreshToken = require("./refresh-token");
const debug = require("debug")(envConfig.logNamespace("instagram:recent-media"));
debug.enabled = false;
const messageHandlers = require("../shared/message-handlers");
const refreshOnEachCall = true;

const recentMedia = (res, req) => {
  messageHandlers.httpRequest({
    apiRequest: {
      hostname: "graph.instagram.com",
      protocol: "https:",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      method: "get",
      path: `https://graph.instagram.com/${envConfig.instagram.userId}/media?access_token=${envConfig.instagram.accessToken}&fields=id,media_type,media_url,permalink,username,timestamp,caption`
    },
    debug: debug,
    res: res,
    req: req,
  }).then(response => res.json(response));
};

exports.recentMedia = (req, res) => {
  const refreshRequest = {};
  const refreshResponse = {};
  if (refreshOnEachCall) {
    refreshToken.refreshToken(refreshRequest, refreshResponse)
      .then(apiResponse => {
        debug("refreshToken response:", apiResponse.response, "apiStatusCode:", apiResponse.apiStatusCode);
        return recentMedia(res, req);
      })
      .catch(error => {
        debug("error in refreshOnEachCall:", error);
        return res.status(500).json({error: error.message});
      });
  } else {
    recentMedia(res, req)
      .catch(error => {
        debug("error not in refreshOnEachCall:", error);
        return res.status(500).json({error: error.message});
      });
  }
};
