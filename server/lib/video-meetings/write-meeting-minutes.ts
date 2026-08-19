import { Request, Response } from "express";
import debugLib from "debug";
import { envConfig } from "../env-config/env-config";
import { dateTimeNowAsValue } from "../shared/dates";
import { aiConfigFromEnvironment } from "../ai/ai-config";
import { generate } from "../ai/ai-generation";
import { integrationWorkerConfigured, meetingMinutesViaIntegrationWorker } from "../ai/ai-worker-client";
import { meetingNote } from "../mongo/models/meeting-note";
import * as transforms from "../mongo/controllers/transforms";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {
  AI_MEETING_NOTE_AUTHOR,
  meetingMinutesInput,
  meetingMinutesSystemPrompt
} from "../../../projects/ngx-ramblers/src/app/functions/video-meeting-minutes";
import { MeetingNote, MeetingNoteSource } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";
import { Ai } from "../../../projects/ngx-ramblers/src/app/models/system.model";

const debug = debugLib(envConfig.logNamespace("video-meetings:minutes"));
debug.enabled = false;

export async function generateMeetingMinutes(
  ai: Ai,
  transcript: string,
  chat: string,
  existingNotes: string
): Promise<string> {
  if (integrationWorkerConfigured()) {
    return meetingMinutesViaIntegrationWorker(ai, transcript, chat, existingNotes);
  } else {
    return generate(ai, meetingMinutesSystemPrompt(), meetingMinutesInput(transcript, chat, existingNotes));
  }
}

export async function writeMeetingMinutes(req: Request, res: Response): Promise<void> {
  const room = (req.body?.room || "").trim();
  const transcript = (req.body?.transcript || "").toString();
  const chat = (req.body?.chat || "").toString();
  const ai = aiConfigFromEnvironment();
  if (!room) {
    res.status(400).json({message: "room is required"});
  } else if (!ai.enabled) {
    res.status(503).json({message: "AI is not enabled in this environment"});
  } else {
    try {
      const existing = await meetingNote.find({room}).sort({createdAt: 1}).lean().exec();
      const handwritten = existing
        .filter(note => note.source !== MeetingNoteSource.AI)
        .map(note => `${note.authorName || "Member"}: ${note.text}`)
        .join("\n");
      if (!transcript.trim() && !chat.trim() && !handwritten.trim()) {
        res.status(400).json({message: "Nothing to write up yet"});
      } else {
        const output = (await generateMeetingMinutes(ai, transcript, chat, handwritten))?.trim();
        if (!output) {
          res.status(502).json({message: "The notes came back empty"});
        } else {
          const member = req.user as MemberCookie;
          const saved = await persistAiNote(room, output, member);
          res.status(200).json({note: transforms.toObjectWithId(saved)});
        }
      }
    } catch (error) {
      debug("write meeting minutes failed:", error);
      res.status(502).json({message: "Failed to write meeting minutes", error: String(error)});
    }
  }
}

async function persistAiNote(room: string, text: string, member: MemberCookie): Promise<MeetingNote> {
  const previous = await meetingNote.findOne({room, source: MeetingNoteSource.AI}).sort({createdAt: -1}).exec();
  const created = await meetingNote.create({
    room,
    memberId: member?.memberId,
    authorName: AI_MEETING_NOTE_AUTHOR,
    text,
    source: MeetingNoteSource.AI,
    createdAt: dateTimeNowAsValue(),
    createdBy: member?.memberId
  });
  if (previous?._id) {
    await meetingNote.deleteOne({_id: previous._id}).exec();
  }
  return created;
}
