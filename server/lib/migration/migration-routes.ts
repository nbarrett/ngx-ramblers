import express from "express";
import { deriveBaseUrl as derivePuppeteerBaseUrl, launchBrowser as launchPuppeteerBrowser } from "./puppeteer-utils";
import {
  deriveBaseUrl as deriveSerenityBaseUrl,
  launchBrowser as launchSerenityBrowser
} from "./serenity-migration-utils";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../env-config/environment-model";
import { htmlToMarkdown } from "./turndown-service-factory";
import { buildHtmlPastePreview, buildMarkdownPastePreview } from "./html-paste-preview";
import { BaseHrefResult } from "./migration-types";
import { isString } from "es-toolkit/compat";
import { parseVenueFromHtml } from "../venue/venue-parser";

const debugLog = debug(envConfig.logNamespace("migration-routes"));
const router = express.Router();
const USE_SERENITY = envConfig.booleanValue(Environment.USE_SERENITY_FOR_MIGRATION);

router.post("/html-to-markdown", (req, res) => {
  try {
    const { html, baseUrl } = req.body;

    if (!isString(html) || !html) {
      return res.status(400).json({
        error: "Invalid request: html string required in request body"
      });
    }

    const markdown = htmlToMarkdown(html, baseUrl);
    debugLog("Converted HTML to markdown, length:", html.length, "->", markdown.length, "baseUrl:", baseUrl);

    res.json({ markdown });
  } catch (error) {
    debugLog("Error converting HTML to markdown:", error);
    res.status(500).json({
      error: "Failed to convert HTML to markdown",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post("/html-paste-preview", (req, res) => {
  try {
    const { html, baseUrl } = req.body;

    if (!isString(html) || !html) {
      return res.status(400).json({
        error: "Invalid request: html string required in request body"
      });
    }

    const preview = buildHtmlPastePreview(html, baseUrl);
    res.json(preview);
  } catch (error) {
    debugLog("Error building HTML paste preview:", error);
    res.status(500).json({
      error: "Failed to build HTML paste preview",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post("/markdown-paste-preview", (req, res) => {
  try {
    const { markdown } = req.body;

    if (!isString(markdown) || !markdown) {
      return res.status(400).json({
        error: "Invalid request: markdown string required in request body"
      });
    }

    const preview = buildMarkdownPastePreview(markdown);
    res.json(preview);
  } catch (error) {
    debugLog("Error building markdown paste preview:", error);
    res.status(500).json({
      error: "Failed to build markdown paste preview",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post("/html-from-url", async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!isString(url) || !url) {
      return res.status(400).json({ error: "Invalid request: url string required in request body" });
    }

    const cleaned = url.trim().replace(/^view-source:/i, "");
    let parsed: URL;
    try {
      parsed = new URL(cleaned);
    } catch (e) {
      debugLog(`Invalid URL "${cleaned}":`, e instanceof Error ? e.message : String(e));
      return res.status(400).json({ error: "Invalid URL supplied" });
    }
    if (!/^https?:$/i.test(parsed.protocol)) {
      return res.status(400).json({ error: "Unsupported protocol" });
    }

    let browser: any | null = null;
    try {
      if (USE_SERENITY) {
        browser = await launchSerenityBrowser();
        await browser.url(parsed.toString());
        await browser.waitUntil(async () => {
          const state = await browser.execute(() => document.readyState);
          return state === "complete" || state === "interactive";
        }, {timeout: 60000, timeoutMsg: "Page did not load within 60 seconds"});

        const html = await browser.execute(() => document.documentElement.outerHTML);
        const baseHrefResult = await browser.execute((): BaseHrefResult => {
          const el = document.querySelector("base[href]") as HTMLBaseElement | null;
          return {baseHref: el?.getAttribute("href") || null};
        });
        const currentUrl = await browser.getUrl();
        const baseUrl = deriveSerenityBaseUrl(currentUrl, baseHrefResult.baseHref || undefined);
        return res.json({html, baseUrl});
      } else {
        browser = await launchPuppeteerBrowser();
        const page = await browser.newPage();
        await page.goto(parsed.toString(), {waitUntil: "domcontentloaded", timeout: 60000});
        const html = await page.content();
        const baseHrefResult = await page.evaluate((): BaseHrefResult => {
          const el = document.querySelector("base[href]") as HTMLBaseElement | null;
          return {baseHref: el?.getAttribute("href") || null};
        });
        const baseUrl = derivePuppeteerBaseUrl(page.url(), baseHrefResult.baseHref || undefined);
        return res.json({html, baseUrl});
      }
    } catch (e) {
      debugLog(`${USE_SERENITY ? "Serenity/JS" : "Puppeteer"} fetch failed, falling back to fetch:`, e);
      const response = await fetch(parsed.toString(), { redirect: "follow" });
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch URL: ${response.statusText}` });
      }
      const html = await response.text();
      const baseUrl = USE_SERENITY ? deriveSerenityBaseUrl(parsed.toString()) : derivePuppeteerBaseUrl(parsed.toString());
      return res.json({ html, baseUrl });
    } finally {
      if (browser) {
        try {
          if (USE_SERENITY) {
            await browser.deleteSession();
          } else {
            await browser.close();
          }
        } catch (e) {
          debugLog("Failed to close browser:", e instanceof Error ? e.message : String(e));
        }
      }
    }
  } catch (error) {
    debugLog("Error fetching HTML from URL:", error);
    res.status(500).json({
      error: "Failed to fetch HTML from URL",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

const PRIORITY_PATH_KEYWORDS = ["contact", "find", "location", "visit", "about", "where", "address", "directions"];

function extractTopLevelLinks(html: string, baseUrl: string): string[] {
  const linkRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi;
  const links = new Set<string>();
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    let href = match[1].trim();
    if (!href || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    try {
      const absoluteUrl = new URL(href, baseUrl);
      if (absoluteUrl.origin !== new URL(baseUrl).origin) {
        continue;
      }
      const path = absoluteUrl.pathname;
      const pathParts = path.split("/").filter(p => p.length > 0);
      if (pathParts.length <= 1 && path !== "/") {
        links.add(`${absoluteUrl.origin}${path}`);
      }
    } catch {
      continue;
    }
  }

  return Array.from(links);
}

function sortLinksByPriority(links: string[]): string[] {
  return links.sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aHasPriority = PRIORITY_PATH_KEYWORDS.some(keyword => aLower.includes(keyword));
    const bHasPriority = PRIORITY_PATH_KEYWORDS.some(keyword => bLower.includes(keyword));
    if (aHasPriority && !bHasPriority) return -1;
    if (!aHasPriority && bHasPriority) return 1;
    return 0;
  });
}

async function fetchHtmlFromUrl(urlString: string): Promise<string> {
  let browser: any | null = null;
  try {
    if (USE_SERENITY) {
      browser = await launchSerenityBrowser();
      await browser.url(urlString);
      await browser.waitUntil(async () => {
        const state = await browser.execute(() => document.readyState);
        return state === "complete" || state === "interactive";
      }, {timeout: 60000, timeoutMsg: "Page did not load within 60 seconds"});
      return await browser.execute(() => document.documentElement.outerHTML);
    } else {
      browser = await launchPuppeteerBrowser();
      const page = await browser.newPage();
      await page.goto(urlString, {waitUntil: "domcontentloaded", timeout: 60000});
      return await page.content();
    }
  } catch (e) {
    debugLog(`${USE_SERENITY ? "Serenity/JS" : "Puppeteer"} fetch failed, falling back to fetch:`, e);
    const response = await fetch(urlString, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    return await response.text();
  } finally {
    if (browser) {
      try {
        if (USE_SERENITY) {
          await browser.deleteSession();
        } else {
          await browser.close();
        }
      } catch (e) {
        debugLog("Failed to close browser:", e instanceof Error ? e.message : String(e));
      }
    }
  }
}

router.post("/scrape-venue", async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!isString(url) || !url) {
      return res.status(400).json({ error: "Invalid request: url string required in request body" });
    }

    const cleaned = url.trim().replace(/^view-source:/i, "");
    let parsed: URL;
    try {
      parsed = new URL(cleaned);
    } catch (e) {
      debugLog(`Invalid URL "${cleaned}":`, e instanceof Error ? e.message : String(e));
      return res.status(400).json({ error: "Invalid URL supplied" });
    }
    if (!/^https?:$/i.test(parsed.protocol)) {
      return res.status(400).json({ error: "Unsupported protocol" });
    }

    const baseUrl = `${parsed.protocol}//${parsed.host}`;
    const html = await fetchHtmlFromUrl(parsed.toString());
    let result = parseVenueFromHtml(html, baseUrl);
    debugLog("scrape-venue: initial result from", url, "confidence:", result.confidence);

    if (result.confidence < 50) {
      debugLog("scrape-venue: low confidence, scanning top-level pages");
      const topLevelLinks = extractTopLevelLinks(html, baseUrl);
      const sortedLinks = sortLinksByPriority(topLevelLinks);
      debugLog("scrape-venue: found", sortedLinks.length, "top-level links to try");

      for (const linkUrl of sortedLinks) {
        if (linkUrl === parsed.toString() || linkUrl === baseUrl || linkUrl === baseUrl + "/") {
          continue;
        }
        try {
          debugLog("scrape-venue: trying", linkUrl);
          const pageHtml = await fetchHtmlFromUrl(linkUrl);
          const pageResult = parseVenueFromHtml(pageHtml, baseUrl);
          debugLog("scrape-venue: page result confidence:", pageResult.confidence);
          if (pageResult.confidence > result.confidence) {
            result = pageResult;
            debugLog("scrape-venue: using result from", linkUrl);
            if (result.confidence >= 50) {
              break;
            }
          }
        } catch (e) {
          debugLog("scrape-venue: failed to fetch", linkUrl, e instanceof Error ? e.message : String(e));
        }
      }
    }

    debugLog("scrape-venue: final result:", result);
    return res.json(result);
  } catch (error) {
    debugLog("Error scraping venue from URL:", error);
    res.status(500).json({
      error: "Failed to scrape venue from URL",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.post("/search-venue-website", async (req, res) => {
  try {
    const { query } = req.body as { query?: string };
    if (!isString(query) || !query?.trim()) {
      return res.status(400).json({ error: "Invalid request: query string required in request body" });
    }

    debugLog("search-venue-website: searching for:", query);
    const searchQuery = encodeURIComponent(`${query.trim()} official website`);
    const searchUrl = `https://www.google.com/search?q=${searchQuery}`;

    let browser: any | null = null;
    let html: string;
    try {
      if (USE_SERENITY) {
        browser = await launchSerenityBrowser();
        await browser.url(searchUrl);
        await browser.waitUntil(async () => {
          const state = await browser.execute(() => document.readyState);
          return state === "complete" || state === "interactive";
        }, {timeout: 30000, timeoutMsg: "Search page did not load"});
        html = await browser.execute(() => document.documentElement.outerHTML);
      } else {
        browser = await launchPuppeteerBrowser();
        const page = await browser.newPage();
        await page.goto(searchUrl, {waitUntil: "domcontentloaded", timeout: 30000});
        html = await page.content();
      }
    } catch (e) {
      debugLog("search-venue-website: browser fetch failed:", e);
      return res.json({ url: null });
    } finally {
      if (browser) {
        try {
          if (USE_SERENITY) {
            await browser.deleteSession();
          } else {
            await browser.close();
          }
        } catch (e) {
          debugLog("Failed to close browser:", e);
        }
      }
    }

    const urlPattern = /<a[^>]+href="(https?:\/\/(?!www\.google|google|webcache|translate\.google)[^"]+)"[^>]*>/gi;
    const matches: string[] = [];
    let match;
    while ((match = urlPattern.exec(html)) !== null && matches.length < 10) {
      const url = match[1];
      if (!url.includes("google.com") &&
          !url.includes("youtube.com") &&
          !url.includes("facebook.com") &&
          !url.includes("twitter.com") &&
          !url.includes("instagram.com") &&
          !url.includes("tripadvisor") &&
          !url.includes("yelp.com") &&
          !url.includes("wikipedia.org")) {
        try {
          const parsed = new URL(url);
          const cleanUrl = `${parsed.protocol}//${parsed.host}`;
          if (!matches.includes(cleanUrl)) {
            matches.push(cleanUrl);
          }
        } catch {
          continue;
        }
      }
    }

    debugLog("search-venue-website: found potential URLs:", matches);
    const resultUrl = matches.length > 0 ? matches[0] : null;
    return res.json({ url: resultUrl });
  } catch (error) {
    debugLog("Error searching for venue website:", error);
    res.status(500).json({
      error: "Failed to search for venue website",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export const migrationRoutes = router;
