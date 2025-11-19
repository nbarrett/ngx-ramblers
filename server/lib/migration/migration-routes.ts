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

export const migrationRoutes = router;
