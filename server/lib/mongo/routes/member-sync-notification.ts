import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as controller from "../controllers/member-sync-notification";

const router = express.Router();

router.post("/reconcile", authConfig.authenticate(), controller.reconcile);
router.post("/send", authConfig.authenticate(), controller.send);
router.get("", authConfig.authenticate(), controller.findByConditions);
router.get("/all", authConfig.authenticate(), controller.all);
router.put("/:id", authConfig.authenticate(), controller.update);
router.delete("/:id", authConfig.authenticate(), controller.deleteOne);

export const memberSyncNotificationRoutes = router;
