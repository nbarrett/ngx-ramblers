import { Injectable } from "@angular/core";
import * as joypixels from "emoji-toolkit";
import { EmojiShortcodeMatch } from "../../models/emoji.model";
import { keys, toPairs } from "es-toolkit/compat";

@Injectable({
  providedIn: "root"
})
export class EmojiShortcodeService {

  private readonly matches: EmojiShortcodeMatch[] = this.buildMatches();

  suggestionsFor(query: string, limit = 36): EmojiShortcodeMatch[] {
    const normalised = (query || "").toLowerCase().replace(/^:/, "").replace(/:$/, "");
    const startsWith: EmojiShortcodeMatch[] = [];
    const contains: EmojiShortcodeMatch[] = [];
    if (normalised) {
      this.matches.forEach(match => {
        const name = match.shortname.slice(1, -1);
        if (name.startsWith(normalised)) {
          startsWith.push(match);
        } else if (name.includes(normalised)) {
          contains.push(match);
        }
      });
    }
    return [...startsWith, ...contains].slice(0, limit);
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
