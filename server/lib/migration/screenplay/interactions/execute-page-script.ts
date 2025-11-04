import { Interaction } from "@serenity-js/core";
import { ExecuteScript } from "@serenity-js/web";

export interface ScrapeResult {
  html: string;
  images: { src: string; alt: string }[];
  selectorErrors?: { selector: string; error: string }[];
}

export class ExecutePageScript {
  static scrapeLinks(baseUrl: string, menuSelector: string): Interaction {
    return ExecuteScript.sync((base: string, selector: string): { path: string; title: string }[] => {
      const links = Array.from(document.querySelectorAll(selector))
        .filter((a: HTMLAnchorElement) => a.href.startsWith(base))
        .map((a: HTMLAnchorElement) => ({path: a.href, title: a.textContent!.trim()}));
      return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
    }).withArguments(baseUrl, menuSelector);
  }

  static scrapeContent(contentSelector: string, excludeSelectors: string[]): Interaction {
    return ExecuteScript.sync((selector: string, excludes: string[]): ScrapeResult => {
      const node = document.querySelector(selector) || document.body;
      const selectors = Array.isArray(excludes) ? excludes : [];
      const selectorErrors: { selector: string; error: string }[] = [];

      selectors.forEach(sel => {
        try {
          node.querySelectorAll(sel).forEach(n => n.remove());
        } catch (e) {
          selectorErrors.push({
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

      return {html, images, selectorErrors: selectorErrors.length > 0 ? selectorErrors : undefined};
    }).withArguments(contentSelector, excludeSelectors);
  }
}
