import { describe, expect, it } from "vitest";
import {
  appendUniqueLine,
  lineFromJitsiChat,
  lineFromJitsiTranscription,
  meetingMinutesDateLabel,
  meetingMinutesFromSource,
  meetingMinutesLookUnusable,
  meetingMinutesSummaryPrompt,
  meetingMinutesWriteError,
  meetingMinutesWriteIsEmpty,
  meetingNotesUpdatedMessage,
  MEETING_TRANSCRIBE_PROMPT
} from "./video-meeting-minutes";

describe("lineFromJitsiTranscription", () => {

  it("reads a final caption with a speaker name", () => {
    expect(lineFromJitsiTranscription({
      data: {message: "We will meet at the hall", participant: {name: "Jane"}}
    })).toEqual("Jane: We will meet at the hall");
  });

  it("rewrites American spelling in a caption to British English", () => {
    expect(lineFromJitsiTranscription({
      data: {message: "We realized the phone was missing", participant: {name: "Nick"}}
    })).toEqual("Nick: We realised the phone was missing");
  });

  it("reads a stable caption field when the message key is missing", () => {
    expect(lineFromJitsiTranscription({
      data: {stable: "The walk is on Saturday", name: "Pat"}
    })).toEqual("Pat: The walk is on Saturday");
  });

  it("returns null when there is no text", () => {
    expect(lineFromJitsiTranscription({data: {participant: {name: "Jane"}}})).toBeNull();
  });

});

describe("lineFromJitsiChat", () => {

  it("reads a chat line with the sender nick", () => {
    expect(lineFromJitsiChat({nick: "Tom", message: "I can do the risk assessment"})).toEqual("Tom: I can do the risk assessment");
  });

});

describe("MEETING_TRANSCRIBE_PROMPT", () => {

  it("asks for the words that were heard and forbids invented meetings", () => {
    expect(MEETING_TRANSCRIBE_PROMPT).toContain("verbatim");
    expect(MEETING_TRANSCRIBE_PROMPT).toContain("Do not invent");
    expect(MEETING_TRANSCRIBE_PROMPT).toContain("empty response");
    expect(MEETING_TRANSCRIBE_PROMPT).not.toContain("Ramblers meeting");
  });

});

describe("meetingMinutesSummaryPrompt", () => {

  it("locks the summary to the record so nothing is made up", () => {
    const prompt = meetingMinutesSummaryPrompt();
    expect(prompt).toContain("Summarise only what is in the record");
    expect(prompt).toContain("must appear in the record");
    expect(prompt).toContain("Do not add, infer or embellish");
    expect(prompt).toContain("if little was said, write little");
  });

  it("keeps the useful minute-writing behaviour from the previous prompt", () => {
    const prompt = meetingMinutesSummaryPrompt();
    expect(prompt).toContain("Minute a spoken account in full");
    expect(prompt).toContain("Next meeting");
    expect(prompt).toContain("Never treat that date as the date of this meeting");
    expect(prompt).toContain("British English");
  });

});

describe("meetingMinutesFromSource", () => {

  it("uses the spoken words as the minutes, without adding a story", () => {
    const minutes = meetingMinutesFromSource("Nick Barrett: Waiting for the morning light", "", "");
    expect(minutes).toContain("## What was said");
    expect(minutes).toContain("Nick Barrett: Waiting for the morning light");
    expect(minutes).not.toContain("AGM");
    expect(minutes).not.toContain("Discussion");
  });

  it("includes chat and handwritten notes only when they exist", () => {
    const minutes = meetingMinutesFromSource("Jane: Hello", "Tom: Agreed", "Park at the church");
    expect(minutes).toContain("Jane: Hello");
    expect(minutes).toContain("## Chat");
    expect(minutes).toContain("Tom: Agreed");
    expect(minutes).toContain("Park at the church");
  });

  it("is empty when there is nothing to record", () => {
    expect(meetingMinutesFromSource("", "", "")).toEqual("");
  });

  it("keeps chat and typed notes exactly as their authors wrote them", () => {
    const minutes = meetingMinutesFromSource("", "Tom: the color chart is attached", "Meet Mrs Gray at the center");
    expect(minutes).toContain("Tom: the color chart is attached");
    expect(minutes).toContain("Meet Mrs Gray at the center");
  });

});

describe("meetingMinutesWriteError", () => {

  it("explains when AI is switched off", () => {
    expect(meetingMinutesWriteError({status: 503, error: {message: "AI is not enabled in this environment"}}))
      .toContain("AI to be switched on");
  });

  it("explains when there is nothing to write up", () => {
    expect(meetingMinutesWriteError({status: 400, error: {message: "Nothing to write up yet"}}))
      .toContain("chat or typed note");
  });

  it("treats a 400 empty write as empty, not a failed write", () => {
    expect(meetingMinutesWriteIsEmpty({status: 400, error: {message: "Nothing to write up yet"}})).toBe(true);
    expect(meetingMinutesWriteIsEmpty({status: 502, error: {message: "Failed to write meeting minutes"}})).toBe(false);
  });

});

describe("meetingNotesUpdatedMessage", () => {

  it("includes the call duration when there is one", () => {
    expect(meetingNotesUpdatedMessage("12 mins")).toEqual("Notes updated from 12 mins of the call.");
  });

  it("falls back when the duration is missing", () => {
    expect(meetingNotesUpdatedMessage("")).toEqual("Notes updated from the call.");
  });

});

describe("meetingMinutesLookUnusable", () => {

  it("rejects the silent-transcript placeholder minutes", () => {
    expect(meetingMinutesLookUnusable(
      "There is insufficient information to provide minutes. The transcript appears to be silent or contain indistinct sounds."
    )).toBe(true);
  });

  it("keeps ordinary minutes", () => {
    expect(meetingMinutesLookUnusable("## Discussion\n- The react button does not work.")).toBe(false);
  });

});

describe("meetingMinutesDateLabel", () => {

  const date = (value: number) => value === 1 ? "30 August 2026" : "31 August 2026";
  const time = (value: number) => value === 1 ? "9:07 pm" : "9:11 pm";

  it("shows date and start time when there is no end", () => {
    expect(meetingMinutesDateLabel(1, null, date, time)).toEqual("30 August 2026, 9:07 pm");
  });

  it("shows start and end times on the same date", () => {
    expect(meetingMinutesDateLabel(1, 2, date, time)).toEqual("30 August 2026, 9:07 pm - 9:11 pm");
  });

});

describe("appendUniqueLine", () => {

  it("ignores empty and duplicate consecutive lines", () => {
    expect(appendUniqueLine(["a"], null)).toEqual(["a"]);
    expect(appendUniqueLine(["a"], "a")).toEqual(["a"]);
    expect(appendUniqueLine(["a"], "b")).toEqual(["a", "b"]);
  });

});
