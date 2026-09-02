import express from "express";
import multer from "multer";
import * as authConfig from "../auth/auth-config";
import { getVideoMeetingConfig, handleGuestInvite, issueGuestTokenForRoom, issueMemberToken } from "./video-meetings-controllers";
import { writeMeetingMinutes } from "./write-meeting-minutes";
import { appendMeetingTranscript, deleteMeetingTranscript, getMeetingTranscript, listMeetingTranscriptRooms } from "./meeting-transcript-controllers";
import { transcribeMeetingAudio } from "./meeting-audio-transcription";

const router = express.Router();
const audioUpload = multer({storage: multer.memoryStorage(), limits: {fileSize: 25 * 1024 * 1024}});

router.get("/config", authConfig.optionalAuthenticate(), getVideoMeetingConfig);
router.post("/token", authConfig.authenticate(), issueMemberToken);
router.post("/invite", authConfig.authenticate(), handleGuestInvite);
router.post("/minutes", authConfig.authenticate(), writeMeetingMinutes);
router.post("/transcript", authConfig.optionalAuthenticate(), appendMeetingTranscript);
router.get("/transcript", authConfig.optionalAuthenticate(), getMeetingTranscript);
router.get("/transcript-rooms", authConfig.authenticate(), listMeetingTranscriptRooms);
router.delete("/transcript", authConfig.authenticate(), deleteMeetingTranscript);
router.post("/transcribe-audio", authConfig.optionalAuthenticate(), audioUpload.single("audio"), transcribeMeetingAudio);
router.post("/guest-token", issueGuestTokenForRoom);

export const videoMeetingsRoutes = router;
