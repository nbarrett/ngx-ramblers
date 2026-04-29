import express from "express";
import { validateTokenRequest } from "./validate-token-request";
import { sendContactUsTransactionalMail } from "./resolve-and-send";

const router = express.Router();

router.post("/validate-token", validateTokenRequest);
router.post("/transactional/send", sendContactUsTransactionalMail);

export const contactUsRoutes = router;
