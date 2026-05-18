import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as memberEmailSend from "../controllers/member-email-send";

const router = express.Router();

router.get("", authConfig.authenticate(), memberEmailSend.list);

export const memberEmailSendRoutes = router;
