import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { systemConfig } from "../config/system-config";
import { escapeXml } from "../shared/string-utils";
import { publicSitePaths } from "../mongo/controllers/site-search";

const debugLog = debug(envConfig.logNamespace("sitemap"));
debugLog.enabled = false;
const errorDebugLog = createErrorDebugLog("sitemap");

async function siteBaseUrl(): Promise<string> {
  const config = await systemConfig();
  return (config?.group?.href || "").replace(/\/+$/, "");
}

function urlEntry(location: string): string {
  return `  <url><loc>${escapeXml(location)}</loc></url>`;
}

export async function sitemapXml(req: Request, res: Response): Promise<void> {
  try {
    const baseUrl = await siteBaseUrl();
    if (!baseUrl) {
      res.status(404).type("text/plain").send("Sitemap unavailable: site address not configured");
      return;
    }
    const paths = await publicSitePaths();
    if (!paths) {
      res.status(503).setHeader("Retry-After", "60");
      res.type("text/plain").send("Sitemap is being generated - please retry shortly");
      return;
    }
    const locations = [baseUrl].concat(paths.map(path => `${baseUrl}/${path.replace(/^\/+/, "")}`));
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...locations.map(urlEntry),
      `</urlset>`
    ].join("\n");
    debugLog("sitemapXml: returning", locations.length, "urls for base", baseUrl);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.type("application/xml").send(xml);
  } catch (error) {
    errorDebugLog("sitemapXml failed:", error);
    res.status(500).type("text/plain").send("Sitemap generation failed");
  }
}

export async function robotsTxt(req: Request, res: Response): Promise<void> {
  try {
    const baseUrl = await siteBaseUrl();
    const lines = [
      "User-agent: *",
      "Disallow: /admin",
      "Disallow: /login",
      "Disallow: /logout",
      "Allow: /"
    ];
    const withSitemap = baseUrl ? lines.concat(["", `Sitemap: ${baseUrl}/sitemap.xml`]) : lines;
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.type("text/plain").send(withSitemap.join("\n"));
  } catch (error) {
    errorDebugLog("robotsTxt failed:", error);
    res.status(500).type("text/plain").send("robots.txt generation failed");
  }
}
