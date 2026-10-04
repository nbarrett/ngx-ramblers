import express from "express";
import { documentationSites } from "./documentation-sites";

const router = express.Router();

router.get("/sites", documentationSites);

export const documentationRoutes = router;
