import express = require("express");
import * as authConfig from "../../auth/auth-config";
import * as config from "./../controllers/config";

const router = express.Router();

router.post("", authConfig.authenticate(), config.update);
router.get("", config.handleQuery);
router.delete("/:id", authConfig.authenticate(), config.deleteKey);

export const configRoutes = router;
