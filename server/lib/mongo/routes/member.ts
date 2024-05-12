import express = require("express");
import * as authConfig from "../../auth/auth-config";
import * as member from "../controllers/member";
const router = express.Router();

router.post("", authConfig.authenticate(), member.create);
router.get("/find-one", authConfig.authenticate(), member.findOne);
router.get("/all", authConfig.authenticate(), member.all);
router.post("/all", authConfig.authenticate(), member.createOrUpdateAll);
router.post("/delete-all", authConfig.authenticate(), member.deleteAll);
router.put("/:id", authConfig.authenticate(), member.update);
router.put("/:id/email-subscription", member.updateEmailSubscription);
router.delete("/:id", authConfig.authenticate(), member.deleteOne);
router.get("/:id", authConfig.authenticate(), member.findById);
router.get("/password-reset-id/:id", member.findByPasswordResetId);

export const memberRoutes = router;
