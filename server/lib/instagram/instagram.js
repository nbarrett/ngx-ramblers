const express = require("express");
const instagramAuthentication = {};
const instagram = require("./instagram-controllers")(instagramAuthentication);
const recentMedia = require("./recent-media")
const router = express.Router();

router.get("/authorise", instagram.authorise);
router.get("/authorise-ok", instagram.authoriseOK);
router.get("/handle-auth", instagram.handleAuth);
router.get("/recent-media", recentMedia.recentMedia);

module.exports = router;
