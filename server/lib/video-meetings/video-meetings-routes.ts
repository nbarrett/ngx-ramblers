import express from "express";
import * as authConfig from "../auth/auth-config";
import { getVideoMeetingConfig, handleGuestInvite, issueGuestTokenForRoom, issueMemberToken } from "./video-meetings-controllers";
import { writeMeetingMinutes } from "./write-meeting-minutes";
import { appendMeetingTranscript, getMeetingTranscript } from "./meeting-transcript-controllers";

const router = express.Router();

router.get("/config", authConfig.optionalAuthenticate(), getVideoMeetingConfig);
router.post("/token", authConfig.authenticate(), issueMemberToken);
router.post("/invite", authConfig.authenticate(), handleGuestInvite);
router.post("/minutes", authConfig.authenticate(), writeMeetingMinutes);
router.post("/transcript", authConfig.optionalAuthenticate(), appendMeetingTranscript);
router.get("/transcript", authConfig.optionalAuthenticate(), getMeetingTranscript);
router.post("/guest-token", issueGuestTokenForRoom);

export const videoMeetingsRoutes = router;
