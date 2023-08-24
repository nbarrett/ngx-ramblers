const express = require("express");
const auth = require("../controllers/auth");
const login = require("../controllers/login");
const resetPassword = require("../controllers/reset-password");
const forgotPassword = require("../controllers/forgot-password");
const router = express.Router();
router.post("/logout", auth.logout);
router.post("/login", login.login);
router.post("/audit-member-login", auth.auditMemberLogin);
router.post("/reset-password", resetPassword.resetPassword);
router.post("/forgot-password", forgotPassword.forgotPassword);
router.post("/refresh", auth.refresh);

module.exports = router;
