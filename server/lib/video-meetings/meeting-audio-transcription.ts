import { Request, Response } from "express";
import debugLib from "debug";
import { isArray, isString } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import { aiConfigFromEnvironment } from "../ai/ai-config";
import { dateTimeNowAsValue } from "../shared/dates";
import { meetingTranscriptLine } from "../mongo/models/meeting-transcript";
import {
  speakerLabelledLines,
  textFromGenerateContent,
  transcriptionExceedsAudio
} from "../../../projects/ngx-ramblers/src/app/functions/meeting-transcript";
import { meetingTranscribePrompt } from "../../../projects/ngx-ramblers/src/app/functions/video-meeting-minutes";
import { MeetingAudioTranscription } from "../../../projects/ngx-ramblers/src/app/models/video-meeting.model";

const debug = debugLib(envConfig.logNamespace("video-meetings:audio"));
debug.enabled = true;

function geminiGenerateContentUrl(baseUrl: string, model: string): string {
  const root = baseUrl.replace(/\/openai\/?$/i, "").replace(/\/+$/, "");
  return `${root}/models/${encodeURIComponent(model)}:generateContent`;
}

export function participantNamesFromRequest(value: unknown): string[] {
  const parsed = (() => {
    if (isArray(value)) {
      return value;
    } else if (isString(value) && value.trim().startsWith("[")) {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    } else if (isString(value)) {
      return value.split(",");
    } else {
      return [];
    }
  })();
  return (isArray(parsed) ? parsed : [])
    .map(name => (name ?? "").toString().trim())
    .filter(name => !!name);
}

async function transcribeAudioViaAi(audio: Buffer, mimeType: string, prompt: string): Promise<MeetingAudioTranscription> {
  const ai = aiConfigFromEnvironment();
  if (!ai.enabled || !ai.baseUrl || !ai.apiKey || !ai.model) {
    throw new Error("Audio transcription is not configured in this environment");
  } else {
    const endpoint = geminiGenerateContentUrl(ai.baseUrl, ai.model);
    const body = {
      contents: [{
        parts: [
          {text: prompt},
          {inline_data: {mime_type: mimeType || "audio/wav", data: audio.toString("base64")}}
        ]
      }],
      generationConfig: {temperature: 0, maxOutputTokens: 768}
    };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {"Content-Type": "application/json", "x-goog-api-key": ai.apiKey},
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      debug("audio transcription failed", response.status, errorText.slice(0, 300));
      throw new Error(`Transcription request failed with status ${response.status}`);
    } else {
      const data = await response.json();
      const text = textFromGenerateContent(data);
      if (transcriptionExceedsAudio(text, audio.length)) {
        debug("audio transcription discarded: more words than the audio could hold", {
          bytes: audio.length,
          chars: text.length
        });
        return {text: "", discarded: true};
      } else {
        return {text, discarded: false};
      }
    }
  }
}

export async function transcribeMeetingAudio(req: Request, res: Response): Promise<void> {
  const room = (req.body?.room || "").toString().trim();
  const authorName = (req.body?.authorName || "").toString().trim();
  const participants = participantNamesFromRequest(req.body?.participants);
  const speakers = participantNamesFromRequest(req.body?.speakers);
  const file = (req as Request & {file?: {buffer: Buffer; mimetype: string}}).file;
  const mimeType = (file?.mimetype || "audio/wav").toLowerCase();
  if (!room || !file?.buffer?.length) {
    res.status(400).json({message: "room and audio are required"});
  } else if (!mimeType.includes("wav")) {
    res.status(415).json({message: "Only WAV audio is supported"});
  } else {
    try {
      const transcription = await transcribeAudioViaAi(file.buffer, mimeType, meetingTranscribePrompt(authorName, participants, speakers));
      const lines = speakerLabelledLines(transcription.text, authorName, participants, speakers);
      if (lines.length) {
        const now = dateTimeNowAsValue();
        await meetingTranscriptLine.insertMany(lines.map((line, index) => ({room, authorName: line.authorName, text: line.text, at: now + index})));
      }
      debug("transcribeMeetingAudio:", {
        room,
        authorName,
        participants,
        heardSpeakers: speakers,
        bytes: file.buffer.length,
        chars: transcription.text.length,
        saved: lines.length,
        speakers: lines.map(line => line.authorName).filter((name, index, names) => names.indexOf(name) === index),
        discarded: transcription.discarded
      });
      res.status(200).json({
        saved: lines.length,
        discarded: transcription.discarded ? 1 : 0,
        text: lines.map(line => `${line.authorName}: ${line.text}`).join("\n")
      });
    } catch (error) {
      debug("transcribeMeetingAudio failed:", error);
      res.status(502).json({message: "Failed to transcribe audio", error: String(error)});
    }
  }
}
