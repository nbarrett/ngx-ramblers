import { TestBed } from "@angular/core/testing";
import { Subject } from "rxjs";
import { EmojiShortcodeService } from "./emoji-shortcode.service";
import { SystemConfigService } from "../system/system-config.service";
import { SystemConfig } from "../../models/system.model";
import { emojiSynonymsFromText, emojiSynonymsToText } from "../../models/emoji.model";

describe("EmojiShortcodeService", () => {

  const configEvents = new Subject<SystemConfig>();
  const service = (): EmojiShortcodeService => TestBed.inject(EmojiShortcodeService);
  const names = (query: string, limit?: number): string[] => service().suggestionsFor(query, limit).map(match => match.shortname);

  beforeEach(() => TestBed.configureTestingModule({
    providers: [{provide: SystemConfigService, useValue: {events: () => configEvents}}]
  }));

  it("finds thanks-type emojis from a plain word using the default shortcuts", () => {
    expect(names("thanks").slice(0, 3)).toEqual([":pray:", ":clap:", ":raised_hands:"]);
  });

  it("uses shortcuts from system settings when they are configured", () => {
    service();
    configEvents.next({emoji: {synonyms: [{keyword: "thanks", shortnames: ["tada"]}]}} as SystemConfig);
    expect(names("thanks")[0]).toEqual(":tada:");
  });

  it("puts an exact shortcode first, then names starting with the query", () => {
    const results = names("heart");
    expect(results[0]).toEqual(":heart:");
    expect(results.indexOf(":hearts:")).toBeLessThan(results.indexOf(":sparkling_heart:"));
  });

  it("pushes skin tone variants below everything else", () => {
    const results = names("hea");
    const firstSkinTone = results.findIndex(name => /_tone\d|skin_tone/.test(name));
    const lastPlain = results.map(name => /_tone\d|skin_tone/.test(name)).lastIndexOf(false);
    expect(results).toContain(":heart:");
    expect(firstSkinTone === -1 || firstSkinTone > lastPlain).toBe(true);
  });

  it("returns nothing for an empty query and respects the limit", () => {
    expect(names("")).toEqual([]);
    expect(names("a", 5).length).toEqual(5);
  });
});

describe("emoji synonym text conversion", () => {

  it("round-trips the one-line-per-keyword format", () => {
    const text = "thanks: pray, clap\nwalk: walking, hiking_boot";
    const synonyms = emojiSynonymsFromText(text);
    expect(synonyms).toEqual([
      {keyword: "thanks", shortnames: ["pray", "clap"]},
      {keyword: "walk", shortnames: ["walking", "hiking_boot"]}
    ]);
    expect(emojiSynonymsToText(synonyms)).toEqual(text);
  });

  it("tolerates colons around shortcodes, spaces in keywords and blank lines", () => {
    expect(emojiSynonymsFromText("Well done : :clap:, :trophy:\n\nnot a line\n: pray")).toEqual([
      {keyword: "welldone", shortnames: ["clap", "trophy"]}
    ]);
  });
});
