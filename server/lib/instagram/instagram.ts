import express from "express";
import { authoriseOK, handleAuth } from "./instagram-controllers";
import { recentMedia } from "./recent-media";

const router = express.Router();

router.get("/authorise-ok", authoriseOK);
router.get("/handle-auth", handleAuth);
router.get("/recent-media", recentMedia);

export const instagramRoutes = router;
