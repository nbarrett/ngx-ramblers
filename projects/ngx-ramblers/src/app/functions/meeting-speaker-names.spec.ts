import { describe, expect, it } from "vitest";
import { givenName, matchKnownSpeaker, namesForTranscribePrompt, shortSpeakerName } from "./meeting-speaker-names";

describe("shortSpeakerName", () => {

  it("uses the first name when nobody else in the meeting shares it", () => {
    expect(shortSpeakerName("Nick Barrett", ["Nick Barrett", "Chris"])).toEqual("Nick");
    expect(shortSpeakerName("Chris", ["Nick Barrett", "Chris"])).toEqual("Chris");
  });

  it("keeps the surname when two people share a first name", () => {
    expect(shortSpeakerName("Nick Barrett", ["Nick Barrett", "Nick Smith"])).toEqual("Nick Barrett");
  });

});

describe("matchKnownSpeaker", () => {

  it("matches a first name to the unique full name in the meeting", () => {
    expect(matchKnownSpeaker("Nick", ["Nick Barrett", "Chris Green"])).toEqual("Nick Barrett");
    expect(matchKnownSpeaker("chris green", ["Nick Barrett", "Chris Green"])).toEqual("Chris Green");
  });

  it("does not guess when two people share that first name", () => {
    expect(matchKnownSpeaker("Nick", ["Nick Barrett", "Nick Smith"])).toEqual("");
  });

});

describe("namesForTranscribePrompt", () => {

  it("lists first names when they are unique", () => {
    expect(namesForTranscribePrompt(["Nick Barrett", "nick barrett", "Chris"])).toEqual(["Nick", "Chris"]);
  });

});

describe("givenName", () => {

  it("takes the first word", () => {
    expect(givenName("Nick Barrett")).toEqual("Nick");
    expect(givenName("")).toEqual("");
  });

});
