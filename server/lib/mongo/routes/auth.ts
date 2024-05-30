import express from "express";
import * as resetPassword from "../controllers/reset-password";
import * as auth from "../controllers/auth";
import * as login from "../controllers/login";
import * as forgotPassword from "../controllers/forgot-password";

const router = express.Router();
router.post("/logout", auth.logout);
router.post("/login", login.login);
router.post("/reset-password", resetPassword.resetPassword);
router.post("/forgot-password", forgotPassword.forgotPassword);
router.post("/refresh", auth.refresh);

export const authRoutes = router;
