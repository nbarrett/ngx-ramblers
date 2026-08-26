import { describe, expect, it } from "vitest";
import { createMeetingSpeechRecognition, finalSpeechLines } from "./video-meeting-speech";

describe("createMeetingSpeechRecognition", () => {

  it("returns null when the browser has no speech recognition", () => {
    expect(createMeetingSpeechRecognition({} as Window)).toEqual(null);
  });

  it("uses British English and keeps listening", () => {
    const recognition = {
      continuous: false,
      interimResults: true,
      lang: "",
      onresult: null,
      onerror: null,
      onend: null,
      start: () => undefined,
      stop: () => undefined
    };
    const SpeechRecognition = function SpeechRecognition() {
      return recognition;
    };
    const created = createMeetingSpeechRecognition({SpeechRecognition} as unknown as Window);
    expect(created).toBe(recognition);
    expect(recognition.continuous).toEqual(true);
    expect(recognition.interimResults).toEqual(true);
    expect(recognition.lang).toEqual("en-GB");
  });

});

describe("finalSpeechLines", () => {

  it("keeps only finished phrases", () => {
    expect(finalSpeechLines({
      results: {
        length: 2,
        0: {isFinal: false, 0: {transcript: "we should "}},
        1: {isFinal: true, 0: {transcript: " We should meet at the hall "}}
      }
    })).toEqual(["We should meet at the hall"]);
  });

  it("returns nothing when there are no results", () => {
    expect(finalSpeechLines({results: {length: 0}})).toEqual([]);
  });

});
