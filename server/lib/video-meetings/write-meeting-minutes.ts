import { Request, Response } from "express";
import debugLib from "debug";
import { envConfig } from "../env-config/env-config";
import { dateTimeNowAsValue } from "../shared/dates";
import { aiConfigFromEnvironment } from "../ai/ai-config";
import { generate } from "../ai/ai-generation";
import { meetingNote } from "../mongo/models/meeting-note";
import { meetingTranscriptLine } from "../mongo/models/meeting-transcript";
import { joinTranscriptLines, usableTranscriptText } from "../../../projects/ngx-ramblers/src/app/functions/meeting-transcript";
import { MeetingTranscriptLine } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";
import * as transforms from "../mongo/controllers/transforms";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {
  AI_MEETING_NOTE_AUTHOR,
  meetingMinutesFromSource,
  meetingMinutesLookUnusable,
  meetingMinutesSummaryPrompt
} from "../../../projects/ngx-ramblers/src/app/functions/video-meeting-minutes";
import { toBritishEnglish } from "../../../projects/ngx-ramblers/src/app/functions/british-english";
import { MeetingNote, MeetingNoteSource } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";
import { publishMeetingMinutes } from "./meeting-minutes-document";

const debug = debugLib(envConfig.logNamespace("video-meetings:minutes"));
debug.enabled = true;

const MEETING_MINUTES_MAX_TOKENS = 8192;

export async function generateMeetingMinutes(source: string): Promise<string> {
  const ai = aiConfigFromEnvironment();
  if (!ai.enabled || !source.trim()) {
    debug("generateMeetingMinutes: returning the verbatim record", {aiEnabled: ai.enabled, sourceChars: source.length});
    return source;
  } else {
    try {
      const summarised = toBritishEnglish((await generate(ai, meetingMinutesSummaryPrompt(), source, MEETING_MINUTES_MAX_TOKENS) || "").trim());
      const usable = !!summarised && !meetingMinutesLookUnusable(summarised);
      debug("generateMeetingMinutes:", {sourceChars: source.length, summarisedChars: summarised.length, usable});
      return usable ? summarised : source;
    } catch (error) {
      debug("generateMeetingMinutes: summarisation failed, returning the verbatim record", error);
      return source;
    }
  }
}

export async function writeMeetingMinutes(req: Request, res: Response): Promise<void> {
  const room = (req.body?.room || "").trim();
  const requestTranscript = (req.body?.transcript || "").toString();
  const chat = (req.body?.chat || "").toString();
  debug("writeMeetingMinutes:", {
    room,
    requestTranscriptChars: requestTranscript.length,
    chatChars: chat.length,
    existingNotesChars: (req.body?.existingNotes || "").toString().length
  });
  if (!room) {
    debug("writeMeetingMinutes: rejected, room is required");
    res.status(400).json({message: "room is required"});
  } else {
    try {
      const existing = await meetingNote.find({room}).sort({createdAt: 1}).lean().exec();
      const fromDatabase = existing
        .filter(note => note.source !== MeetingNoteSource.AI)
        .map(note => `${note.authorName || "Member"}: ${note.text}`)
        .join("\n");
      const fromRequest = (req.body?.existingNotes || "").toString();
      const handwritten = fromDatabase.trim() || fromRequest.trim();
      const pooled = await meetingTranscriptLine.find({room}).sort({at: 1}).lean().exec() as unknown as MeetingTranscriptLine[];
      const transcript = joinTranscriptLines(pooled).trim() || usableTranscriptText(requestTranscript);
      debug("writeMeetingMinutes: material:", {
        room,
        notesInRoom: existing.length,
        pooledTranscriptLines: pooled.length,
        transcriptChars: transcript.length,
        fromDatabaseChars: fromDatabase.length,
        fromRequestChars: fromRequest.length,
        handwrittenChars: handwritten.length
      });
      if (!transcript.trim() && !chat.trim() && !handwritten.trim()) {
        debug("writeMeetingMinutes: nothing to write up yet");
        res.status(400).json({message: "Nothing to write up yet"});
      } else {
        const source = meetingMinutesFromSource(transcript, chat, handwritten).trim();
        const output = (await generateMeetingMinutes(source)).trim();
        debug("writeMeetingMinutes: generated:", {room, outputChars: (output || "").length});
        if (!output || meetingMinutesLookUnusable(output)) {
          debug("writeMeetingMinutes: generated output was empty or unusable");
          res.status(400).json({message: "Nothing to write up yet"});
        } else {
          const member = req.user as MemberCookie;
          const note = transforms.toObjectWithId(await persistAiNote(room, output, member));
          const notify = req.body?.notify === true;
          const published = await publishMeetingMinutes(room, output, notify)
            .catch(publishError => {
              debug("could not save the minutes as a committee document", publishError);
              return null;
            });
          debug("writeMeetingMinutes: saved:", {room, noteId: note.id, outputChars: output.length, notify, published});
          res.status(200).json({
            note,
            link: published?.link || "",
            path: published?.path || "",
            slug: published?.slug || ""
          });
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
