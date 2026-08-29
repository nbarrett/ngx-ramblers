import { describe, expect, it } from "vitest";
import { dedupeIncomingLines, joinTranscriptLines, transcriptLineLabel } from "./meeting-transcript";

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

describe("transcriptLineLabel", () => {

  it("prefixes the author when present", () => {
    expect(transcriptLineLabel({room: "r", authorName: "Jane", text: "hello", at: 1})).toEqual("Jane: hello");
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

});
