import { describe, expect, it } from "vitest";
import {
  dedupeIncomingLines,
  isUsableTranscriptText,
  joinTranscriptLines,
  speakerLabelledLines,
  textFromGenerateContent,
  transcriptionExceedsAudio,
  transcriptLineLabel,
  transcriptTimeSpan,
  usableTranscriptText
} from "./meeting-transcript";

describe("dedupeIncomingLines", () => {

  it("trims and drops empty lines", () => {
    expect(dedupeIncomingLines(null, ["  hello ", "", "   "])).toEqual(["hello"]);
  });

  it("drops consecutive duplicates within the batch", () => {
    expect(dedupeIncomingLines(null, ["one", "one", "two", "two", "one"])).toEqual(["one", "two", "one"]);
  });

  it("drops a first line equal to the previously stored line", () => {
    expect(dedupeIncomingLines("two", ["two", "three"])).toEqual(["three"]);
  });

  it("keeps a first line that differs from the previously stored line", () => {
    expect(dedupeIncomingLines("two", ["three", "three"])).toEqual(["three"]);
  });

});

describe("joinTranscriptLines", () => {

  it("removes duplicate lines from the same speaker so a stuttering transcript reads once", () => {
    expect(joinTranscriptLines([
      {room: "r", authorName: "Nick", text: "can you see this", at: 1},
      {room: "r", authorName: "Nick", text: "can you see this", at: 2},
      {room: "r", authorName: "Nick", text: "can you see this", at: 3}
    ])).toEqual("Nick: can you see this");
  });

  it("keeps the same words spoken by different people", () => {
    expect(joinTranscriptLines([
      {room: "r", authorName: "Nick", text: "hello", at: 1},
      {room: "r", authorName: "Guy", text: "hello", at: 2}
    ])).toEqual("Nick: hello\nGuy: hello");
  });

  it("keeps a genuine repeat later in the meeting rather than deleting it", () => {
    expect(joinTranscriptLines([
      {room: "r", authorName: "Nick", text: "agreed", at: 1},
      {room: "r", authorName: "Jane", text: "we will book the hall", at: 2},
      {room: "r", authorName: "Nick", text: "agreed", at: 3}
    ])).toEqual("Nick: agreed\nJane: we will book the hall\nNick: agreed");
  });

});

describe("transcriptLineLabel", () => {

  it("prefixes the author when present", () => {
    expect(transcriptLineLabel({room: "r", authorName: "Jane", text: "hello", at: 1})).toEqual("Jane: hello");
  });

  it("rewrites American spelling when the stored line used it", () => {
    expect(transcriptLineLabel({
      room: "r",
      authorName: "Nick Barrett",
      text: "just got home that we realized the phone was missing",
      at: 1
    })).toEqual("Nick Barrett: just got home that we realised the phone was missing");
  });

  it("returns just the text when there is no author", () => {
    expect(transcriptLineLabel({room: "r", text: "hello", at: 1})).toEqual("hello");
  });

});

describe("joinTranscriptLines", () => {

  it("joins labelled lines and skips blanks", () => {
    expect(joinTranscriptLines([
      {room: "r", authorName: "Jane", text: "one", at: 1},
      {room: "r", authorName: "Pat", text: "", at: 2},
      {room: "r", text: "two", at: 3}
    ])).toEqual("Jane: one\ntwo");
  });

  it("drops Gemini refusal and silent-chunk filler so minutes see only real speech", () => {
    expect(joinTranscriptLines([
      {room: "r", authorName: "Nick Barrett", text: "(No clear speech)", at: 1},
      {room: "r", authorName: "Nick Barrett", text: "00:00:00:01:00:00:02:00:00:03", at: 2},
      {room: "r", authorName: "Nick Barrett", text: "the react button doesn't do anything", at: 3},
      {room: "r", authorName: "Nick Barrett", text: "I can't provide a transcription for this audio. It appears to be silent.", at: 4},
      {room: "r", authorName: "Nick Barrett", text: "uh uh uh uh", at: 5}
    ])).toEqual("Nick Barrett: the react button doesn't do anything");
  });

});

describe("textFromGenerateContent", () => {

  it("reads the transcript text from a generateContent response", () => {
    expect(textFromGenerateContent({
      candidates: [{content: {parts: [{text: "waiting for the morning light"}]}}]
    })).toEqual("waiting for the morning light");
  });

  it("treats a silent clip with no text part as empty, not as a meeting", () => {
    expect(textFromGenerateContent({
      candidates: [{content: {role: "model"}, finishReason: "STOP"}]
    })).toEqual("");
  });

});

describe("transcriptionExceedsAudio", () => {

  it("rejects a page of invented speech from a short clip", () => {
    const twoSecondsOfWav = 44 + 16000 * 2 * 2;
    const invented = Array.from({length: 200}, () => "welcome").join(" ");
    expect(transcriptionExceedsAudio(invented, twoSecondsOfWav)).toBe(true);
  });

  it("keeps a short line from a short clip", () => {
    const twoSecondsOfWav = 44 + 16000 * 2 * 2;
    expect(transcriptionExceedsAudio("Waiting for the morning light", twoSecondsOfWav)).toBe(false);
  });

  it("rejects even a modest paragraph that a two second clip could not hold", () => {
    const twoSecondsOfWav = 44 + 16000 * 2 * 2;
    const invented = Array.from({length: 20}, () => "welcome").join(" ");
    expect(transcriptionExceedsAudio(invented, twoSecondsOfWav)).toBe(true);
  });

});

describe("isUsableTranscriptText", () => {

  it("keeps ordinary speech, including a labelled line", () => {
    expect(isUsableTranscriptText("the react button doesn't do anything")).toBe(true);
    expect(isUsableTranscriptText("Nick Barrett: we will meet at the hall")).toBe(true);
    expect(isUsableTranscriptText("Hello")).toBe(true);
  });

  it("rejects refusals, timecodes, parenthetical asides and filler", () => {
    expect(isUsableTranscriptText("(No clear speech)")).toBe(false);
    expect(isUsableTranscriptText("It looks like there was no speech in the audio.")).toBe(false);
    expect(isUsableTranscriptText("I'm unable to transcribe the audio. It appears to be a collection of indistinct sounds.")).toBe(false);
    expect(isUsableTranscriptText("00:00:00:01:00:00:02:00:00:03")).toBe(false);
    expect(isUsableTranscriptText("uh uh uh uh")).toBe(false);
    expect(isUsableTranscriptText("my my my")).toBe(false);
  });

  it("rejects square-bracket stage directions the way it rejects parentheses", () => {
    expect(isUsableTranscriptText("[Music]")).toBe(false);
    expect(isUsableTranscriptText("[Applause]")).toBe(false);
    expect(isUsableTranscriptText("Nick Barrett: [silence]")).toBe(false);
  });

  it("rejects stock speech-to-text artifacts that nobody said in the meeting", () => {
    expect(isUsableTranscriptText("Thanks for watching!")).toBe(false);
    expect(isUsableTranscriptText("Thank you for watching.")).toBe(false);
    expect(isUsableTranscriptText("Please subscribe")).toBe(false);
    expect(isUsableTranscriptText("thanks for watching the walk video with us today")).toBe(true);
  });

});

describe("usableTranscriptText", () => {

  it("keeps only usable lines from a pasted transcript", () => {
    expect(usableTranscriptText("(No clear speech)\nNick: hello everyone\nuh uh uh")).toEqual("Nick: hello everyone");
  });

});

describe("transcriptTimeSpan", () => {

  it("uses the first and last timed lines, including discarded speech", () => {
    expect(transcriptTimeSpan([
      {room: "r", text: "(No clear speech)", at: 100},
      {room: "r", text: "hello", at: 200},
      {room: "r", text: "bye", at: 300}
    ])).toEqual({startedAt: 100, endedAt: 300});
  });

  it("returns nulls when there are no timestamps", () => {
    expect(transcriptTimeSpan([])).toEqual({startedAt: null, endedAt: null});
  });

});

describe("speakerLabelledLines", () => {

  it("stores each utterance under the named speaker rather than the person recording", () => {
    const text = "Nick Barrett: can you see my screen\nRachel: yes I can\nNick Barrett: these are the minutes";
    expect(speakerLabelledLines(text, "Nick Barrett", ["Nick Barrett", "Rachel"])).toEqual([
      {authorName: "Nick Barrett", text: "can you see my screen"},
      {authorName: "Rachel", text: "yes I can"},
      {authorName: "Nick Barrett", text: "these are the minutes"}
    ]);
  });

  it("matches speaker names regardless of case and keeps unknown labels as given", () => {
    const text = "rachel: I went to Westwell\nUnknown: who is that";
    expect(speakerLabelledLines(text, "Nick Barrett", ["Rachel"])).toEqual([
      {authorName: "Rachel", text: "I went to Westwell"},
      {authorName: "Unknown", text: "who is that"}
    ]);
  });

  it("attributes unlabelled lines to whoever the meeting heard speaking most, and leaves a mid-sentence colon alone", () => {
    expect(speakerLabelledLines("we meet at seven: bring the reports", "Nick Barrett", ["Rachel"], ["Rachel", "Nick Barrett"])).toEqual([
      {authorName: "Rachel", text: "we meet at seven: bring the reports"}
    ]);
  });

  it("marks unlabelled lines Unknown rather than blaming the recorder when other people are present", () => {
    expect(speakerLabelledLines("we meet at seven", "Nick Barrett", ["Rachel"])).toEqual([
      {authorName: "Unknown", text: "we meet at seven"}
    ]);
  });

  it("attributes unlabelled lines to the recorder when nobody else is in the meeting", () => {
    expect(speakerLabelledLines("we meet at seven", "Nick Barrett", ["Nick Barrett"])).toEqual([
      {authorName: "Nick Barrett", text: "we meet at seven"}
    ]);
  });

  it("drops filler and refusals even when they carry a speaker label", () => {
    expect(speakerLabelledLines("Rachel: um, uh\nNick Barrett: no clear speech", "Nick Barrett", ["Rachel"])).toEqual([]);
  });

});

describe("transcriptionExceedsAudio with speaker labels", () => {

  it("does not count speaker labels as spoken words", () => {
    const twoSecondsOfWav = 44 + 16000 * 2 * 2;
    const labelled = "Rachel: waiting for the morning light\nNick Barrett: yes";
    expect(transcriptionExceedsAudio(labelled, twoSecondsOfWav)).toBe(false);
  });

});
