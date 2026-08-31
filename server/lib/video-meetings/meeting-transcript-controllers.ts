import { Request, Response } from "express";
import { isArray } from "es-toolkit/compat";
import debugLib from "debug";
import { envConfig } from "../env-config/env-config";
import { dateTimeNowAsValue } from "../shared/dates";
import { meetingTranscriptLine } from "../mongo/models/meeting-transcript";
import { dedupeIncomingLines, joinTranscriptLines, transcriptTimeSpan } from "../../../projects/ngx-ramblers/src/app/functions/meeting-transcript";
import { MeetingTranscriptLine } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";

const debug = debugLib(envConfig.logNamespace("video-meetings:transcript"));
debug.enabled = true;

export async function appendMeetingTranscript(req: Request, res: Response): Promise<void> {
  const room = (req.body?.room || "").toString().trim();
  const authorName = (req.body?.authorName || "").toString().trim();
  const incoming: string[] = isArray(req.body?.lines) ? req.body.lines : [];
  if (!room) {
    debug("appendMeetingTranscript: rejected, room is required");
    res.status(400).json({message: "room is required"});
  } else {
    try {
      const previous = await meetingTranscriptLine.findOne({room, authorName}).sort({at: -1}).lean().exec();
      const lines = dedupeIncomingLines(previous?.text || null, incoming);
      if (lines.length) {
        const now = dateTimeNowAsValue();
        await meetingTranscriptLine.insertMany(lines.map((text, index) => ({room, authorName, text, at: now + index})));
      }
      debug("appendMeetingTranscript:", {room, authorName, received: incoming.length, saved: lines.length});
      res.status(200).json({saved: lines.length});
    } catch (error) {
      debug("appendMeetingTranscript failed:", error);
      res.status(502).json({message: "Failed to append transcript", error: String(error)});
    }
  }
}

export async function getMeetingTranscript(req: Request, res: Response): Promise<void> {
  const room = (req.query?.room || "").toString().trim();
  if (!room) {
    debug("getMeetingTranscript: rejected, room is required");
    res.status(400).json({message: "room is required"});
  } else {
    try {
      const stored = await meetingTranscriptLine.find({room}).sort({at: 1}).lean().exec() as unknown as MeetingTranscriptLine[];
      const transcript = joinTranscriptLines(stored);
      const span = transcriptTimeSpan(stored);
      const entries = stored.map(line => ({authorName: line.authorName, text: line.text, at: line.at}));
      debug("getMeetingTranscript:", {room, lines: stored.length, transcriptChars: transcript.length});
      res.status(200).json({transcript, lines: stored.length, entries, startedAt: span.startedAt, endedAt: span.endedAt});
    } catch (error) {
      debug("getMeetingTranscript failed:", error);
      res.status(502).json({message: "Failed to read transcript", error: String(error)});
    }
  }
}
