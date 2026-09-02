import { Request, Response } from "express";
import { isArray, isObject } from "es-toolkit/compat";
import debugLib from "debug";
import { envConfig } from "../env-config/env-config";
import { dateTimeNowAsValue } from "../shared/dates";
import { meetingTranscriptLine } from "../mongo/models/meeting-transcript";
import { meetingNote } from "../mongo/models/meeting-note";
import committeeFile from "../mongo/models/committee-file";
import { dedupeIncomingLines, joinTranscriptLines, transcriptTimeSpan } from "../../../projects/ngx-ramblers/src/app/functions/meeting-transcript";
import { videoMeetingTitleFromRoom } from "../../../projects/ngx-ramblers/src/app/functions/video-meeting-join";
import { MEETING_MINUTES_TEMPLATE_ID, MeetingTranscriptLine } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";

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

export async function listMeetingTranscriptRooms(req: Request, res: Response): Promise<void> {
  try {
    const grouped = await meetingTranscriptLine.aggregate([
      {$group: {_id: "$room", lines: {$sum: 1}, startedAt: {$min: "$at"}, endedAt: {$max: "$at"}}},
      {$sort: {endedAt: -1}},
      {$limit: 30}
    ]);
    const rooms = grouped.map(row => row._id).filter(Boolean);
    const minutesFiles = rooms.length
      ? await committeeFile.find({
        "meeting.room": {$in: rooms},
        "document.templateId": MEETING_MINUTES_TEMPLATE_ID
      }).select("meeting.room document.title meeting.title").lean().exec()
      : [];
    const minutesByRoom = new Map((minutesFiles || []).map(file => [file.meeting?.room, file]));
    const summaries = grouped.filter(row => !!row._id).map(row => {
      const minutes = minutesByRoom.get(row._id);
      return {
        room: row._id,
        title: minutes?.document?.title || minutes?.meeting?.title || videoMeetingTitleFromRoom(row._id),
        lines: row.lines || 0,
        startedAt: row.startedAt || null,
        endedAt: row.endedAt || null,
        hasMinutes: !!minutes
      };
    });
    debug("listMeetingTranscriptRooms:", {rooms: summaries.length});
    res.status(200).json({rooms: summaries});
  } catch (error) {
    debug("listMeetingTranscriptRooms failed:", error);
    res.status(502).json({message: "Failed to list meeting recordings", error: String(error)});
  }
}

export async function deleteMeetingTranscript(req: Request, res: Response): Promise<void> {
  const room = (req.query?.room || "").toString().trim();
  if (!room) {
    debug("deleteMeetingTranscript: rejected, room is required");
    res.status(400).json({message: "room is required"});
  } else {
    const outcome = await deleteRoomCaptureWithRetry(room);
    if (outcome.ok === true) {
      debug("deleteMeetingTranscript:", {
        room,
        transcriptDeleted: outcome.transcriptDeleted,
        notesDeleted: outcome.notesDeleted
      });
      res.status(200).json({
        room,
        transcriptDeleted: outcome.transcriptDeleted,
        notesDeleted: outcome.notesDeleted
      });
    } else {
      debug("deleteMeetingTranscript failed:", outcome.error);
      res.status(502).json({message: "Failed to discard meeting recording", error: String(outcome.error)});
    }
  }
}

async function deleteRoomCapture(room: string): Promise<{transcriptDeleted: number; notesDeleted: number}> {
  const transcript = await meetingTranscriptLine.deleteMany({room}).exec();
  const notes = await meetingNote.deleteMany({room}).exec();
  return {
    transcriptDeleted: transcript.deletedCount || 0,
    notesDeleted: notes.deletedCount || 0
  };
}

async function deleteRoomCaptureWithRetry(room: string): Promise<
  {ok: true; transcriptDeleted: number; notesDeleted: number} | {ok: false; error: unknown}
> {
  try {
    const result = await deleteRoomCapture(room);
    return {ok: true as const, transcriptDeleted: result.transcriptDeleted, notesDeleted: result.notesDeleted};
  } catch (error) {
    if (!isRetryableMongoNetworkError(error)) {
      return {ok: false as const, error};
    } else {
      debug("deleteMeetingTranscript: retrying after a dropped database connection", {room});
      try {
        const result = await deleteRoomCapture(room);
        return {ok: true as const, transcriptDeleted: result.transcriptDeleted, notesDeleted: result.notesDeleted};
      } catch (retryError) {
        return {ok: false as const, error: retryError};
      }
    }
  }
}

function isRetryableMongoNetworkError(error: unknown): boolean {
  const record = isObject(error) ? error as {name?: string; hasErrorLabel?: (label: string) => boolean} : {};
  if (record.name === "MongoNetworkTimeoutError") {
    return true;
  } else if (record.hasErrorLabel) {
    return record.hasErrorLabel("RetryableWriteError") || record.hasErrorLabel("RetryableError");
  } else {
    return false;
  }
}
