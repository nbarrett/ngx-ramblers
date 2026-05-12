import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as externalRecipient from "../controllers/external-recipient";

const router = express.Router();

router.get("", authConfig.authenticate(), externalRecipient.list);
router.post("", authConfig.authenticate(), externalRecipient.create);
router.delete("/:id", authConfig.authenticate(), externalRecipient.deleteOne);

export const externalRecipientRoutes = router;
