import { Task, Answerable } from "@serenity-js/core";
import { ExecuteScript } from "@serenity-js/web";
import { ScrapedImage } from "../../../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { isArray } from "es-toolkit/compat";

export interface ScrapeResult {
  html: string;
  images: ScrapedImage[];
  selectorErrors?: SelectorError[];
}

interface SelectorError {
  selector: string;
  error: string;
}

export class ScrapePageContent {
  static using(contentSelector: Answerable<string>, excludeSelectors: Answerable<string[]>): Task {
    return Task.where(`scrape page content`,
      ExecuteScript.sync((selector: string, excludes: string[]): ScrapeResult => {
        const node = document.querySelector(selector) || document.body;
        const selectors = isArray(excludes) ? excludes : [];
        const errors: SelectorError[] = [];

        selectors.forEach(sel => {
          try {
            node.querySelectorAll(sel).forEach(n => n.remove());
          } catch (e) {
            errors.push({
              selector: sel,
              error: e instanceof Error ? e.message : String(e)
            });
          }
        });

        Array.from(node.querySelectorAll("img")).forEach(img => {
          const src = img.getAttribute("src");
          if (src) img.setAttribute("src", new URL(src, location.href).href);
        });

        const html = node.innerHTML;
        const images = Array.from(node.querySelectorAll("img")).map(img => ({
          src: img.src,
          alt: img.alt || ""
        }));

        return { html, images, selectorErrors: errors.length > 0 ? errors : undefined };
      }).withArguments(contentSelector, excludeSelectors)
    );
  }
}
