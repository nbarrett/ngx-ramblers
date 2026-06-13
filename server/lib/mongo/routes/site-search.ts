import express from "express";
import * as authConfig from "../../auth/auth-config";
import { search, searchStatus, siteMapPages } from "../controllers/site-search";

const router = express.Router();

router.get("/status", searchStatus);
router.get("/site-map", authConfig.optionalAuthenticate(), siteMapPages);
router.get("", authConfig.optionalAuthenticate(), search);

export const siteSearchRoutes = router;
