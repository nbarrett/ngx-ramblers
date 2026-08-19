import { describe, expect, it } from "vitest";
import {
  appendUniqueLine,
  lineFromJitsiChat,
  lineFromJitsiTranscription,
  meetingMinutesInput
} from "./video-meeting-minutes";

describe("lineFromJitsiTranscription", () => {

  it("reads a final caption with a speaker name", () => {
    expect(lineFromJitsiTranscription({
      data: {message: "We will meet at the hall", participant: {name: "Jane"}}
    })).toEqual("Jane: We will meet at the hall");
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

describe("appendUniqueLine", () => {

  it("ignores empty and duplicate consecutive lines", () => {
    expect(appendUniqueLine(["a"], null)).toEqual(["a"]);
    expect(appendUniqueLine(["a"], "a")).toEqual(["a"]);
    expect(appendUniqueLine(["a"], "b")).toEqual(["a", "b"]);
  });

});
