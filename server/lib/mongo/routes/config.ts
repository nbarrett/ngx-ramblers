import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as config from "./../controllers/config";

const router = express.Router();

router.post("", authConfig.authenticate(), config.createOrUpdate);
router.get("", config.handleQuery);
router.delete("/:id", authConfig.authenticate(), config.deleteOne);

export const configRoutes = router;
