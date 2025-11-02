import express from "express";
import { launchBrowser, deriveBaseUrl } from "./puppeteer-utils";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { htmlToMarkdown } from "./turndown-service-factory";
import { buildHtmlPastePreview, buildMarkdownPastePreview } from "./html-paste-preview";

const debugLog = debug(envConfig.logNamespace("migration-routes"));
const router = express.Router();

router.post("/html-to-markdown", (req, res) => {
  try {
    const { html, baseUrl } = req.body;

    if (!html || typeof html !== "string") {
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

    if (!html || typeof html !== "string") {
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

    if (!markdown || typeof markdown !== "string") {
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
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Invalid request: url string required in request body" });
    }

    const cleaned = url.trim().replace(/^view-source:/i, "");
    let parsed: URL;
    try {
      parsed = new URL(cleaned);
    } catch {
      return res.status(400).json({ error: "Invalid URL supplied" });
    }
    if (!/^https?:$/i.test(parsed.protocol)) {
      return res.status(400).json({ error: "Unsupported protocol" });
    }

    let browser: any | null = null;
    try {
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.goto(parsed.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });
      const html = await page.content();
      const { baseHref } = await page.evaluate(() => {
        const el = document.querySelector("base[href]") as HTMLBaseElement | null;
        return { baseHref: el?.getAttribute("href") || null } as { baseHref: string | null };
      });
      const baseUrl = deriveBaseUrl(page.url(), baseHref || undefined);
      return res.json({ html, baseUrl });
    } catch (e) {
      debugLog("Puppeteer fetch failed, falling back to fetch:", e);
      const response = await fetch(parsed.toString(), { redirect: "follow" });
      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch URL: ${response.statusText}` });
      }
      const html = await response.text();
      const baseUrl = deriveBaseUrl(parsed.toString());
      return res.json({ html, baseUrl });
    } finally {
      if (browser) {
        try { await browser.close(); } catch {}
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
