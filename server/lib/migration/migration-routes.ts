import express from "express";
import { migrateNorthWestKentRamblers } from "./migrate-static-site";
import * as authConfig from "../auth/auth-config";

const router = express.Router();

router.get("/static-content", authConfig.authenticate(), migrateNorthWestKentRamblers);

export const migrationRoutes = router;
