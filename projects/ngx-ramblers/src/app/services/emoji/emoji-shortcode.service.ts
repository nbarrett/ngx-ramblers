import { inject, Injectable } from "@angular/core";
import * as joypixels from "emoji-toolkit";
import { DEFAULT_EMOJI_SYNONYMS, EMOJI_SUGGESTION_LIMIT, EmojiShortcodeMatch, EmojiSynonym } from "../../models/emoji.model";
import { keys, toPairs, uniqBy } from "es-toolkit/compat";
import { SystemConfigService } from "../system/system-config.service";

const SKIN_TONE_PATTERN = /_tone\d|skin_tone/;

@Injectable({
  providedIn: "root"
})
export class EmojiShortcodeService {

  private readonly matches: EmojiShortcodeMatch[] = this.buildMatches();
  private readonly matchesByName: Map<string, EmojiShortcodeMatch> = new Map(this.matches.map(match => [this.nameOf(match), match]));
  private synonyms: EmojiSynonym[] = DEFAULT_EMOJI_SYNONYMS;

  constructor() {
    inject(SystemConfigService).events().subscribe(config => {
      const configured = config?.emoji?.synonyms || [];
      this.synonyms = configured.length > 0 ? configured : DEFAULT_EMOJI_SYNONYMS;
    });
  }

  suggestionsFor(query: string, limit = EMOJI_SUGGESTION_LIMIT): EmojiShortcodeMatch[] {
    const normalised = (query || "").toLowerCase().replace(/^:/, "").replace(/:$/, "").replace(/[\s-]+/g, "_");
    if (normalised) {
      const synonymMatches = this.synonymShortnamesFor(normalised)
        .map(name => this.matchesByName.get(name))
        .filter(match => !!match);
      const exact = this.matches.filter(match => this.nameOf(match) === normalised);
      const startsWith = this.matches.filter(match => this.nameOf(match).startsWith(normalised) && this.nameOf(match) !== normalised);
      const contains = this.matches.filter(match => this.nameOf(match).includes(normalised) && !this.nameOf(match).startsWith(normalised));
      const ranked = uniqBy([...exact, ...synonymMatches, ...startsWith, ...contains], match => match.shortname);
      const wantsSkinTones = SKIN_TONE_PATTERN.test(normalised);
      const ordered = wantsSkinTones
        ? ranked
        : [...ranked.filter(match => !this.skinToneVariant(match)), ...ranked.filter(match => this.skinToneVariant(match))];
      return ordered.slice(0, limit);
    } else {
      return [];
    }
  }

  private synonymShortnamesFor(normalised: string): string[] {
    const keyword = normalised.replace(/_/g, "");
    return this.synonyms.filter(synonym => synonym.keyword === keyword).flatMap(synonym => synonym.shortnames);
  }

  private nameOf(match: EmojiShortcodeMatch): string {
    return match.shortname.slice(1, -1);
  }

  private skinToneVariant(match: EmojiShortcodeMatch): boolean {
    return SKIN_TONE_PATTERN.test(this.nameOf(match));
  }

  private buildMatches(): EmojiShortcodeMatch[] {
    const seen = new Set<string>();
    const results: EmojiShortcodeMatch[] = [];
    const emojiList = (joypixels as any).emojiList || {};
    toPairs(emojiList).forEach(([canonical, data]: [string, any]) => {
      const unicode = (joypixels as any).shortnameToUnicode(canonical);
      if (unicode && unicode !== canonical) {
        const shortnames = [canonical, ...((data?.shortnames || []) as string[])];
        shortnames.forEach(shortname => {
          if (shortname && !seen.has(shortname)) {
            seen.add(shortname);
            results.push({shortname, unicode});
          }
        });
      }
    });
    const altShortNames = (joypixels as any).altShortNames || {};
    keys(altShortNames).forEach((shortname: string) => {
      if (shortname && !seen.has(shortname)) {
        const unicode = (joypixels as any).shortnameToUnicode(shortname);
        if (unicode && unicode !== shortname) {
          seen.add(shortname);
          results.push({shortname, unicode});
        }
      }
    });
    return results;
  }
}
