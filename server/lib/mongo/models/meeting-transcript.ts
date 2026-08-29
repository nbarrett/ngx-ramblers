import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { MeetingTranscriptLine } from "../../../../projects/ngx-ramblers/src/app/models/video-meeting.model";

const meetingTranscriptSchema = new mongoose.Schema({
  room: {type: String, required: true, index: true},
  authorName: {type: String},
  text: {type: String, required: true},
  at: {type: Number}
}, {collection: "meetingTranscript"});

export const meetingTranscriptLine: mongoose.Model<MeetingTranscriptLine> = ensureModel<MeetingTranscriptLine>("meetingTranscriptLine", meetingTranscriptSchema);
