import { isNumber, isObject, isString } from "es-toolkit/compat";

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
  const text = firstString(data, ["message", "text", "transcript", "stable"]);
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
