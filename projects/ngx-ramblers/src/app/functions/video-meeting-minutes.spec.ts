import { describe, expect, it } from "vitest";
import {
  appendUniqueLine,
  lineFromJitsiChat,
  lineFromJitsiTranscription,
  meetingMinutesInput,
  meetingMinutesWriteError,
  meetingMinutesWriteIsEmpty,
  meetingNotesUpdatedMessage
} from "./video-meeting-minutes";

describe("lineFromJitsiTranscription", () => {

  it("reads a final caption with a speaker name", () => {
    expect(lineFromJitsiTranscription({
      data: {message: "We will meet at the hall", participant: {name: "Jane"}}
    })).toEqual("Jane: We will meet at the hall");
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

describe("meetingMinutesInput", () => {

  it("includes transcript, chat and existing notes", () => {
    const input = meetingMinutesInput("Jane: Hello", "Tom: Agreed", "Park at the church");
    expect(input).toContain("Jane: Hello");
    expect(input).toContain("Tom: Agreed");
    expect(input).toContain("Park at the church");
  });

  it("marks missing material rather than leaving blank sections", () => {
    const input = meetingMinutesInput("", "", "");
    expect(input).toContain("(none yet)");
    expect(input).toContain("(none)");
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

describe("appendUniqueLine", () => {

  it("ignores empty and duplicate consecutive lines", () => {
    expect(appendUniqueLine(["a"], null)).toEqual(["a"]);
    expect(appendUniqueLine(["a"], "a")).toEqual(["a"]);
    expect(appendUniqueLine(["a"], "b")).toEqual(["a", "b"]);
  });

});
