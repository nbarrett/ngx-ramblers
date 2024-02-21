import express = require("express");
import { sendTransactionalMail } from "./transactional-mail/send-transactional-mail";
import { queryAccount } from "./account/account";
import { queryTemplates } from "./templates/query-templates";

const router = express.Router();

router.post("/transactional/send", sendTransactionalMail);
router.post("/templates", queryTemplates);
router.get("/account", queryAccount);

export const brevoRoutes = router;
