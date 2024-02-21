import express = require("express");
import * as authConfig from "../../auth/auth-config";
import * as notificationConfig from "./../controllers/notification-config";

const router = express.Router();

router.post("", authConfig.authenticate(), notificationConfig.create);
router.get("", authConfig.authenticate(), notificationConfig.findByConditions);
router.get("/all", notificationConfig.all);
router.put("/:id", authConfig.authenticate(), notificationConfig.update);
router.get("/:id", authConfig.authenticate(), notificationConfig.findById);
router.delete("/:id", authConfig.authenticate(), notificationConfig.deleteOne);

export const notificationConfigRoutes = router;
