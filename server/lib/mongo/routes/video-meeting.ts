import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as videoMeeting from "../controllers/video-meeting";

const router = express.Router();

router.post("", authConfig.authenticate(), videoMeeting.create);
router.get("/all", authConfig.authenticate(), videoMeeting.all);
router.get("/room/:room", authConfig.authenticate(), videoMeeting.findByRoom);
router.delete("/:id", authConfig.authenticate(), videoMeeting.deleteOne);
router.get("/:id", authConfig.authenticate(), videoMeeting.findById);

export const videoMeetingRoutes = router;
