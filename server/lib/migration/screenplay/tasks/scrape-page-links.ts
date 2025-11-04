import { Task, Answerable } from "@serenity-js/core";
import { ExecuteScript } from "@serenity-js/web";
import { PageLink } from "../../../../../projects/ngx-ramblers/src/app/models/migration-config.model";

export class ScrapePageLinks {
  static from(baseUrl: Answerable<string>, menuSelector: Answerable<string>): Task {
    return Task.where(`scrape page links from menu`,
      ExecuteScript.sync((base: string, selector: string): PageLink[] => {
        const links = Array.from(document.querySelectorAll(selector))
          .filter((a: HTMLAnchorElement) => a.href.startsWith(base))
          .map((a: HTMLAnchorElement) => ({ path: a.href, title: a.textContent!.trim() }));
        return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
      }).withArguments(baseUrl, menuSelector)
    );
  }
}