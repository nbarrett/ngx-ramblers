import express from "express";
import { contentForId, contentForPath } from "./content-export";

const router = express.Router();

router.get("/path/*", contentForPath);
router.get("/:pageId", contentForId);

export const contentExportRoutes = router;
