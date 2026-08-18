import { isObject, isString } from "es-toolkit/compat";

export const AI_MEETING_NOTE_AUTHOR = "AI notes";

export function meetingMinutesSystemPrompt(): string {
  return [
    "You are taking notes for a Ramblers group or committee video meeting.",
    "Write concise UK English minutes from the transcript, chat and any handwritten notes.",
    "Use short headings and bullet points for: discussion, decisions, and actions (with a name if one was clearly given).",
    "Only record what is actually said or written. Do not invent attendees, decisions, places or actions.",
    "If the material is thin, say so in one sentence and list only what is there.",
    "Do not include greetings, small talk or repeated ums.",
    "Do not mention that you are an AI."
  ].join(" ");
}

export function meetingMinutesInput(transcript: string, chat: string, existingNotes: string): string {
  return [
    "Transcript:",
    transcript?.trim() || "(none yet)",
    "",
    "Chat:",
    chat?.trim() || "(none)",
    "",
    "Notes already taken:",
    existingNotes?.trim() || "(none)"
  ].join("\n");
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
  const text = firstString(data, ["message", "text", "transcript"]);
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
