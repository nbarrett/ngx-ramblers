import express from "express";
import * as instagram from "./instagram-controllers";
import { recentMedia } from "./recent-media";

const router = express.Router();

router.get("/authorise", instagram.authorise);
router.get("/authorise-ok", instagram.authoriseOK);
router.get("/handle-auth", instagram.handleAuth);
router.get("/recent-media", recentMedia);

export const instagramRoutes = router;
