import { textFingerprint, wordDiff, wordDiffHtml } from "./text-diff";
import { DiffSegmentKind } from "../models/text-diff.model";

describe("wordDiff", () => {

  it("marks only the words that changed", () => {
    const segments = wordDiff("We starting and end at the pub", "We start and end at the pub");
    expect(segments).toEqual([
      {kind: DiffSegmentKind.SAME, text: "We "},
      {kind: DiffSegmentKind.REMOVED, text: "starting"},
      {kind: DiffSegmentKind.ADDED, text: "start"},
      {kind: DiffSegmentKind.SAME, text: " and end at the pub"}
    ]);
  });

  it("shows an unchanged text as one same segment", () => {
    expect(wordDiff("Plenty of parking", "Plenty of parking")).toEqual([{kind: DiffSegmentKind.SAME, text: "Plenty of parking"}]);
  });

  it("treats punctuation separately from the word it follows", () => {
    expect(wordDiff("sun but to get back", "sun, and to get back")).toEqual([
      {kind: DiffSegmentKind.SAME, text: "sun"},
      {kind: DiffSegmentKind.ADDED, text: ","},
      {kind: DiffSegmentKind.SAME, text: " "},
      {kind: DiffSegmentKind.REMOVED, text: "but"},
      {kind: DiffSegmentKind.ADDED, text: "and"},
      {kind: DiffSegmentKind.SAME, text: " to get back"}
    ]);
    expect(wordDiff("St Paul's Cathedral then", "St Paul's Cathedral. From there")).toEqual([
      {kind: DiffSegmentKind.SAME, text: "St Paul's Cathedral"},
      {kind: DiffSegmentKind.ADDED, text: "."},
      {kind: DiffSegmentKind.SAME, text: " "},
      {kind: DiffSegmentKind.REMOVED, text: "then"},
      {kind: DiffSegmentKind.ADDED, text: "From there"}
    ]);
  });

  it("renders the comparison as the export view's red strikethrough and green markup", () => {
    expect(wordDiffHtml("We starting and end", "We start and end")).toEqual(
      "We <span class=\"text-danger text-decoration-line-through\">starting</span><span class=\"text-success\">start</span> and end"
    );
    expect(wordDiffHtml("a <b> c", "a <b> c")).toEqual("a &lt;b&gt; c");
  });

  it("copes with empty text", () => {
    expect(wordDiff("", "New words")).toEqual([{kind: DiffSegmentKind.ADDED, text: "New words"}]);
    expect(wordDiff("Old words", "")).toEqual([{kind: DiffSegmentKind.REMOVED, text: "Old words"}]);
  });


  it("treats bold markers separately so a word wrapped in bold is not reported as a different word", () => {
    expect(wordDiff("Social : **Tour and Tasting**.", "Social: **Tour and Tasting**.")).toEqual([
      {kind: DiffSegmentKind.SAME, text: "Social"},
      {kind: DiffSegmentKind.REMOVED, text: " "},
      {kind: DiffSegmentKind.SAME, text: ": **Tour and Tasting**."}
    ]);
    expect(wordDiff("Tour and Tasting", "**Tour** and Tasting")).toEqual([
      {kind: DiffSegmentKind.ADDED, text: "**"},
      {kind: DiffSegmentKind.SAME, text: "Tour"},
      {kind: DiffSegmentKind.ADDED, text: "**"},
      {kind: DiffSegmentKind.SAME, text: " and Tasting"}
    ]);
  });

  it("fingerprints text ignoring whitespace differences", () => {
    expect(textFingerprint("We start  and end")).toEqual(textFingerprint("We start and end "));
    expect(textFingerprint("We start and end")).not.toEqual(textFingerprint("We starting and end"));
    expect(textFingerprint("Bishopsbourne &amp; Kingston")).toEqual(textFingerprint("Bishopsbourne & Kingston"));
  });

});
