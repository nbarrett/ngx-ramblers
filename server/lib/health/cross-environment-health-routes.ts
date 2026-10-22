import express from "express";
import * as authConfig from "../auth/auth-config";
import {allEnvironmentHealth, streamEnvironmentHealth} from "./cross-environment-health-controllers";
import {allHostnameHealth} from "../environment-setup/hostname-health-controllers";

const router = express.Router();

router.get("/", authConfig.authenticate(), authConfig.requireAdmin, allEnvironmentHealth);
router.get("/stream", authConfig.authenticate(), authConfig.requireAdmin, streamEnvironmentHealth);
router.get("/hostnames", authConfig.authenticate(), authConfig.requireAdmin, allHostnameHealth);

export const crossEnvironmentHealthRoutes = router;
