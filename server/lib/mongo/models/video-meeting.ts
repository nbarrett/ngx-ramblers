import mongoose from "mongoose";
import { ensureModel } from "../utils/model-utils";
import { VideoMeeting } from "../../../../projects/ngx-ramblers/src/app/models/video-meeting.model";

const videoMeetingSchema = new mongoose.Schema({
  room: {type: String, required: true, index: true},
  title: {type: String},
  startTime: {type: Number},
  durationMinutes: {type: Number},
  meetingType: {type: String},
  committeeFileId: {type: String},
  createdAt: {type: Number},
  createdBy: {type: String},
  createdByName: {type: String}
}, {collection: "videoMeetings"});

export const videoMeeting: mongoose.Model<VideoMeeting> = ensureModel<VideoMeeting>("videoMeeting", videoMeetingSchema);
