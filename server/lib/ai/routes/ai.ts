import express from "express";
import * as authConfig from "../../auth/auth-config";
import { chooseCover, rewrite, status } from "../controllers/ai";
import { draftNewsletterIntro, planNewsletter } from "../controllers/newsletter";
import { draftReleaseNoteUpdate, requireReleaseNoteUpdatePlatformAdmin } from "../controllers/release-note-update";

const router = express.Router();

router.post("/rewrite", authConfig.authenticate(), rewrite);

router.post("/newsletter-intro", authConfig.authenticate(), draftNewsletterIntro);

router.post("/newsletter-plan", authConfig.authenticate(), planNewsletter);

router.post("/release-note-update", authConfig.authenticate(), requireReleaseNoteUpdatePlatformAdmin, draftReleaseNoteUpdate);

router.post("/choose-cover", authConfig.authenticate(), chooseCover);

router.get("/status", authConfig.authenticate(), status);

export const aiRoutes = router;
