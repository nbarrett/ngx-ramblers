import { describe, expect, it } from "vitest";
import { SiteLocale, SITE_TIME_ZONE, siteLocale } from "../models/locale.model";
import { toBritishEnglish } from "./british-english";

describe("site locale", () => {

  it("treats this site as British English because it runs on Europe/London", () => {
    expect(SITE_TIME_ZONE).toEqual("Europe/London");
    expect(siteLocale()).toEqual(SiteLocale.BritishEnglish);
  });

});

describe("toBritishEnglish", () => {

  it("converts the American spellings that show up in meeting transcripts", () => {
    expect(toBritishEnglish("we realized the phone was missing")).toEqual("we realised the phone was missing");
    expect(toBritishEnglish("We realized")).toEqual("We realised");
    expect(toBritishEnglish("REALIZED")).toEqual("REALISED");
    expect(toBritishEnglish("learned from my mistakes")).toEqual("learnt from my mistakes");
    expect(toBritishEnglish("favorite color of the organization")).toEqual("favourite colour of the organisation");
  });

  it("leaves British spelling and unrelated words alone", () => {
    expect(toBritishEnglish("we realised the phone was missing")).toEqual("we realised the phone was missing");
    expect(toBritishEnglish("a prize of some size")).toEqual("a prize of some size");
    expect(toBritishEnglish("Save a draft of the minutes")).toEqual("Save a draft of the minutes");
  });

  it("never rewrites names and places, so the record stays authentic", () => {
    expect(toBritishEnglish("Mrs Gray met us at Center Parcs")).toEqual("Mrs Gray met us at Center Parcs");
    expect(toBritishEnglish("we walked along Harbor Street with Mr Gray")).toEqual("we walked along Harbor Street with Mr Gray");
  });

  it("still converts a plain word at the start of a sentence", () => {
    expect(toBritishEnglish("Realized too late. Colors were wrong")).toEqual("Realised too late. Colours were wrong");
  });

  it("returns empty input unchanged", () => {
    expect(toBritishEnglish("")).toEqual("");
  });

});
