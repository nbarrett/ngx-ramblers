import { isNumber, isObject, isString } from "es-toolkit/compat";
import { toBritishEnglish } from "./british-english";
import { siteLocale } from "../models/locale.model";

export const AI_MEETING_NOTE_AUTHOR = "Minutes";

export const MEETING_TRANSCRIBE_PROMPT = [
  "Transcribe this audio verbatim in British English (en-GB).",
  "Write only the words that can actually be heard.",
  "If the audio is singing or music, transcribe the lyrics you hear.",
  "Do not invent speech, names, meetings, agendas, decisions or extra sentences.",
  "Do not complete or continue unfinished phrases with words that were not spoken.",
  "If there is no clear speech, return an empty response."
].join(" ");

export function meetingTranscribePrompt(recorderName: string, participants: string[], speakers: string[] = []): string {
  const recorder = (recorderName || "").trim();
  const others = (participants || [])
    .map(name => (name || "").trim())
    .filter(name => !!name && name.toLowerCase() !== recorder.toLowerCase())
    .filter((name, index, names) => names.findIndex(candidate => candidate.toLowerCase() === name.toLowerCase()) === index);
  const known = [recorder, ...others].filter(name => !!name);
  const heard = (speakers || []).map(name => (name || "").trim()).filter(name => !!name);
  const heardGuidance = heard.length
    ? [`The meeting software detected these people speaking during this clip, the one who spoke most first: ${heard.join(", ")}. Prefer those names when deciding who said each line.`]
    : [];
  const speakerGuidance = known.length
    ? [
      `This audio was recorded on the device of ${recorder || "the host"}, so the loudest, closest voice is ${recorder || "the host"}; other voices arrive through the speakers and sound more distant.`,
      `The people in the meeting are: ${known.join(", ")}.`,
      ...heardGuidance,
      "Start every utterance on its own line, prefixed with the speaker's name from that list and a colon, for example \"Rachel: I can hear you now.\".",
      "When a voice clearly belongs to nobody on the list, label it Unknown. Never attribute one person's words to another."
    ]
    : [
      ...heardGuidance,
      "Start every utterance on its own line. If more than one person speaks, prefix each line with Speaker 1, Speaker 2 and so on, followed by a colon."
    ];
  return [MEETING_TRANSCRIBE_PROMPT, ...speakerGuidance].join(" ");
}

export function meetingMinutesSummaryPrompt(): string {
  return [
    "You are writing the minutes of a UK Ramblers group or committee video meeting from a verbatim record of what was said, the meeting chat and any typed notes.",
    "Summarise only what is in the record.",
    "Each line of the record starts with the name of the person who said it. Attribute every statement, account and action to that named person, and never to whoever recorded the meeting.",
    "Every name, place, date, number, decision and action in your minutes must appear in the record; if it is not there, leave it out.",
    "Do not add, infer or embellish anything, do not guess at intentions, and do not pad thin material - if little was said, write little.",
    "Minute a spoken account in full: every name, what people did, where they went and what happened, in the order it was told. Do not shrink it to a single bullet or dismiss it as small talk.",
    "Keep the order in which things were discussed, and keep every distinct topic, however briefly it was raised.",
    "Use headings and bullet points. Use Discussion for what was talked about, and add Decisions, Actions or Next meeting only when the record actually contains one; omit a heading rather than writing that nothing was recorded.",
    "If a date is given for the next meeting, put it under Next meeting. Never treat that date as the date of this meeting, and do not add your own Date or Location headings.",
    "Leave out greetings, connection small talk, repeated words and false starts.",
    `Write British English (${siteLocale()}) with UK spelling throughout, even where the record used American forms.`,
    "Do not mention that you are an AI or that you worked from a transcript."
  ].join(" ");
}

function minutesSection(title: string, body: string): string {
  const text = (body || "").trim();
  if (!text) {
    return "";
  } else {
    return `## ${title}\n\n${text}`;
  }
}

export function meetingMinutesFromSource(transcript: string, chat: string, existingNotes: string): string {
  return [
    minutesSection("What was said", transcript),
    minutesSection("Chat", chat),
    minutesSection("Notes taken in the meeting", existingNotes)
  ].filter(section => !!section).join("\n\n");
}

function recordValue(source: unknown, key: string): unknown {
  if (isObject(source) && key in (source as object)) {
    return (source as Record<string, unknown>)[key];
  } else {
    return null;
  }
}

function firstString(source: unknown, keys: string[]): string {
  return keys.reduce((found, key) => {
    if (found) {
      return found;
    } else {
      const value = recordValue(source, key);
      return isString(value) && value.trim() ? value.trim() : "";
    }
  }, "");
}

function participantName(participant: unknown): string {
  return firstString(participant, ["name", "displayName", "formattedDisplayName"]);
}

function payloadData(payload: unknown): unknown {
  const nested = recordValue(payload, "data");
  if (isObject(nested)) {
    return nested;
  } else {
    return payload;
  }
}

export function lineFromJitsiTranscription(payload: unknown): string | null {
  const data = payloadData(payload);
  const text = toBritishEnglish(firstString(data, ["message", "text", "transcript", "stable"]));
  if (!text) {
    return null;
  } else {
    const name = firstString(data, ["name"]) || participantName(recordValue(data, "participant"));
    if (name) {
      return `${name}: ${text}`;
    } else {
      return text;
    }
  }
}

export function lineFromJitsiChat(payload: unknown): string | null {
  const data = payloadData(payload);
  const text = firstString(data, ["message", "text"]);
  if (!text) {
    return null;
  } else {
    const name = firstString(data, ["nick", "name", "displayName"]);
    if (name) {
      return `${name}: ${text}`;
    } else {
      return text;
    }
  }
}

export function appendUniqueLine(lines: string[], line: string | null): string[] {
  if (!line || lines[lines.length - 1] === line) {
    return lines;
  } else {
    return [...lines, line];
  }
}

export function meetingMinutesWriteError(error: unknown): string {
  const status = isObject(error) ? (error as {status?: unknown}).status : null;
  const body = isObject(error) ? (error as {error?: unknown}).error : null;
  const fromBody = isObject(body) && isString((body as {message?: unknown}).message)
    ? (body as {message: string}).message
    : "";
  const fromError = isObject(error) && isString((error as {message?: unknown}).message)
    ? (error as {message: string}).message
    : "";
  const message = (fromBody || fromError).toLowerCase();
  if (status === 503 || message.includes("not enabled")) {
    return "Automatic notes need AI to be switched on for this site.";
  } else if (status === 400 || message.includes("nothing to write")) {
    return "There is no chat or typed note to capture yet. Manually add a note or use chat, then try again.";
  } else if (message.includes("http failure") || (isNumber(status) && status >= 500)) {
    return "The notes service did not respond. Try again in a moment.";
  } else if (fromBody) {
    return fromBody;
  } else {
    return "Try again in a moment.";
  }
}

export function meetingNotesUpdatedMessage(durationLabel: string): string {
  if (durationLabel) {
    return `Notes updated from ${durationLabel} of the call.`;
  } else {
    return "Notes updated from the call.";
  }
}

export function meetingMinutesWriteIsEmpty(error: unknown): boolean {
  const status = isObject(error) ? (error as {status?: unknown}).status : null;
  const message = meetingMinutesWriteError(error).toLowerCase();
  return status === 400 || message.includes("no chat or typed note") || message.includes("nothing to write");
}

export function meetingMinutesLookUnusable(markdown: string): boolean {
  const text = (markdown || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return true;
  } else {
    const lower = text.toLowerCase();
    return /insufficient information to (provide|write)/.test(lower)
      || lower.includes("transcript appears to be silent")
      || /unable to (provide|write|produce) minutes/.test(lower);
  }
}

export function meetingMinutesDateLabel(
  startedAt: number | null,
  endedAt: number | null,
  formatDate: (value: number) => string,
  formatTime: (value: number) => string
): string {
  if (!startedAt) {
    return "";
  } else if (!endedAt || endedAt === startedAt) {
    return `${formatDate(startedAt)}, ${formatTime(startedAt)}`;
  } else {
    return `${formatDate(startedAt)}, ${formatTime(startedAt)} - ${formatTime(endedAt)}`;
  }
}
