const {envConfig} = require("../env-config/env-config");
const debug = require("debug")(envConfig.logNamespace("meetup:venues"));
const messageHandlers = require("../shared/message-handlers");
const querystring = require("querystring");
const requestDefaults = require("./request-defaults");

exports.create = function (req, res) {
  const defaultOptions = requestDefaults.createApiRequestOptions(req.body)
  messageHandlers.httpRequest({
    apiRequest: {
      hostname: defaultOptions.hostname,
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "post",
      path: `/${envConfig.meetup.group}/venues`
    },
    debug: debug,
    successStatusCodes: defaultOptions.successStatusCodes,
    body: req.body,
    res: res,
    req: req,
  }).then(response => res.json(response))
    .catch(error => res.json(error));
};

exports.list = function (req, res) {
  const defaultOptions = requestDefaults.createApiRequestOptions(req.body)
  messageHandlers.httpRequest({
    apiRequest: {
      hostname: defaultOptions.hostname,
      protocol: defaultOptions.protocol,
      headers: defaultOptions.headers,
      method: "get",
      path: `/find_venues/search?${querystring.stringify(req.query)}`,
    },
    body: req.body,
    debug: debug,
    res: res,
    req: req
  }).then(response => res.json(response))
    .catch(error => res.json(error));
};
