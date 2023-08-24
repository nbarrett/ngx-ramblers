import { envConfig } from "../env-config/env-config";
const debug = require("debug")(envConfig.logNamespace("instagram"));
const ig = require("instagram-node").instagram();
const port = envConfig.server.listenPort;
const redirectUri = `http://localhost:${port}/instagram/handleAuth`;
module.exports = instagramAuthentication => {

  instagramAuthentication.result = {
    accessToken: envConfig.instagram.accessToken,
    userId: envConfig.instagram.userId,
  };

  ig.use({
    client_id: envConfig.instagram.clientId,
    client_secret: envConfig.instagram.clientSecret,
    access_token: envConfig.instagram.accessToken,
  });

  function authorise(req, res) {

    var authorizationUrl = ig.get_authorization_url(redirectUri, {scope: ["public_content", "likes"]});
    debug("authorise: called with redirect to", authorizationUrl);
    res.redirect(authorizationUrl);
  }

  function handleOK(req, res) {
    debug("handleAuth called with req.query", req.query);
    debug("handleAuth called with req.url", req.url);
    debug("handleAuth called with req.path", req.path);
    res.json({response: "OK"});
  }

  function handleAuth(req, res) {
    debug("handleAuth called with req.query", req.query);
    debug("handleAuth called with req.url", req.url);
    debug("handleAuth called with req.path", req.path);

    res.json({response: "OK"});
    debug("handleAuth:old instagramAuthentication:", instagramAuthentication, "auth code", req.query.code);
    ig.authorize_user(req.query.code, redirectUri, function (err, result) {
      if (err) res.send(err);
      var receivedAccessToken = result.access_token;

      instagramAuthentication.result = {accessToken: receivedAccessToken, userId: receivedAccessToken.split(".")[0]};
      debug("handleAuth:generated new instagramAuthentication:", instagramAuthentication);

      res.json(instagramAuthentication.result);
    });
  }

  return {
    authorise: authorise,
    handleAuth: handleAuth,
    authoriseOK: handleOK,
  };
};
