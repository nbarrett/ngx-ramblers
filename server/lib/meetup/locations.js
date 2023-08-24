const {envConfig} = require("../env-config/env-config");
const messageHandlers = require("../shared/message-handlers");
const requestDefaults = require("./request-defaults");
const debug = require("debug")(envConfig.logNamespace("meetup:locations"));

exports.locations = function (req, res) {
  const defaultOptions = requestDefaults.createApiRequestOptions(req.body)
  messageHandlers.httpRequest({
    apiRequest: {
      hostname: defaultOptions.hostname,
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "get",
      path: `/find/locations?&sign=true&photo-host=public&query=${encodeURIComponent(req.query.query)}`
    },
    successStatusCodes: defaultOptions.successStatusCodes,
    res: res,
    req: req,
    debug: debug
  }).then(response => res.json(response))
    .catch(error => res.json(error));
};
