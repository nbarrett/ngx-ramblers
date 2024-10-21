import express from "express";
import { validateTokenRequest } from "./validate-token-request";
import { sendTransactionalMail } from "../brevo/transactional-mail/send-transactional-mail";

const router = express.Router();

router.post("/validate-token", validateTokenRequest);
router.post("/transactional/send", sendTransactionalMail);

export const contactUsRoutes = router;
