import express from "express";
import { migrateAlbums, migrateNorthWestKentRamblers } from "./migrate-static-site";
import * as authConfig from "../auth/auth-config";

const router = express.Router();

router.get("/static-content", authConfig.authenticate(), migrateNorthWestKentRamblers);
router.get("/album", authConfig.authenticate(), migrateAlbums);

export const migrationRoutes = router;
