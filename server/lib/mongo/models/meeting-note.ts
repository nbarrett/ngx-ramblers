import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { MeetingNote } from "../../../../projects/ngx-ramblers/src/app/models/video-meeting.model";

const meetingNoteSchema = new mongoose.Schema({
  room: {type: String, required: true, index: true},
  memberId: {type: String},
  authorName: {type: String},
  text: {type: String, required: true},
  createdAt: {type: Number},
  createdBy: {type: String},
  updatedAt: {type: Number},
  updatedBy: {type: String},
  source: {type: String}
}, {collection: "meetingNotes"});

export const meetingNote: mongoose.Model<MeetingNote> = ensureModel<MeetingNote>("meetingNote", meetingNoteSchema);
