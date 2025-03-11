import express from "express";
import { migrateKentRamblers } from "./migrate-static-site";

const router = express.Router();

router.get("/static-content", migrateKentRamblers);

export const migrationRoutes = router;
