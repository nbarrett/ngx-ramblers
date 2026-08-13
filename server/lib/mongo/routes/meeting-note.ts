import express from "express";
import * as authConfig from "../../auth/auth-config";
import * as meetingNote from "../controllers/meeting-note";

const router = express.Router();

router.get("/room/:room", authConfig.authenticate(), meetingNote.findByRoom);
router.post("", authConfig.authenticate(), meetingNote.create);
router.put("/:id", authConfig.authenticate(), meetingNote.update);
router.delete("/:id", authConfig.authenticate(), meetingNote.deleteOne);
router.get("/:id", authConfig.authenticate(), meetingNote.findById);

export const meetingNoteRoutes = router;
