import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { deriveBaseUrl } from "../migration/browser-utils";
import { fetchHtmlViaIntegrationWorker } from "../ramblers/integration-worker-browser-client";
import { PlaywrightWaitUntil } from "../../../projects/ngx-ramblers/src/app/models/integration-worker.model";
import { legacyUrlMapping } from "../mongo/models/legacy-url-mapping";
import { dateTimeNowAsValue } from "../shared/dates";
import {
  RedirectConfidence,
  RedirectMappingStatus,
  LegacyScrapeRequest
} from "../../../projects/ngx-ramblers/src/app/models/legacy-url-redirect.model";

const debugLog = debug(envConfig.logNamespace("legacy-url-scraper"));

interface ScrapedUrl {
  path: string;
  fullUrl: string;
  title: string;
  httpStatus: number;
  contentType: string;
  lastModified?: string;
}

interface ScrapePageResult {
  title: string;
  links: string[];
  contentType: string;
}

type ProgressCallback = (message: string, percent?: number) => void;

function normaliseUrl(baseOrigin: string, href: string): URL | null {
  try {
    const url = new URL(href, baseOrigin);
    url.hash = "";
    url.search = "";
    return url;
  } catch {
    return null;
  }
}

const NON_PAGE_EXTENSION_PATTERN = /\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff?|pdf|docx?|xlsx?|pptx?|csv|zip|rar|7z|gz|tar|mp[34]|m4a|wav|ogg|avi|mov|wmv|flv|mkv|css|js|mjs|map|json|xml|rss|atom|woff2?|ttf|otf|eot)$/i;

function isPageUrl(pathname: string): boolean {
  return !NON_PAGE_EXTENSION_PATTERN.test(pathname);
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function extractLinks(html: string, baseUrl: string): string[] {
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  return Array.from(html.matchAll(linkPattern))
    .map(match => match[1].trim())
    .filter(href => href && !href.startsWith("javascript:") && !href.startsWith("mailto:") && !href.startsWith("tel:"))
    .flatMap(href => {
      try {
        return [new URL(href, baseUrl).toString()];
      } catch {
        return [];
      }
    });
}

async function checkRobotsTxt(baseOrigin: string): Promise<Set<string>> {
  const disallowed = new Set<string>();
  try {
    const response = await fetch(`${baseOrigin}/robots.txt`);
    if (response.ok) {
      const text = await response.text();
      text.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (trimmed.toLowerCase().startsWith("disallow:")) {
          const path = trimmed.substring("disallow:".length).trim();
          if (path) {
            disallowed.add(path);
          }
        }
      });
    }
  } catch {
    debugLog("could not fetch robots.txt");
  }
  return disallowed;
}

function isDisallowed(path: string, disallowedPaths: Set<string>): boolean {
  return Array.from(disallowedPaths).some(disallowed => path.startsWith(disallowed));
}

async function scrapePage(url: string): Promise<ScrapePageResult> {
  const { html, finalUrl, baseHref } = await fetchHtmlViaIntegrationWorker(url, PlaywrightWaitUntil.DomContentLoaded, 30000);
  const baseUrl = deriveBaseUrl(finalUrl, baseHref || undefined);
  const title = extractTitle(html);
  const links = extractLinks(html, baseUrl);
  return { title, links, contentType: "text/html" };
}

export async function scrapeLegacySite(
  request: LegacyScrapeRequest,
  onProgress: ProgressCallback
): Promise<{ urlsDiscovered: number; urlsMapped: number }> {
  const { legacyDomain, respectRobotsTxt = true, maxPages = 1000, delayMs = 500 } = request;
  const baseOrigin = legacyDomain.startsWith("http") ? legacyDomain : `https://${legacyDomain}`;
  const parsedBase = new URL(baseOrigin);
  const hostname = parsedBase.hostname;

  onProgress(`starting scrape of ${hostname} via the integration worker`, 0);

  const disallowedPaths = respectRobotsTxt ? await checkRobotsTxt(baseOrigin) : new Set<string>();
  if (disallowedPaths.size > 0) {
    onProgress(`found ${disallowedPaths.size} disallowed paths in robots.txt`);
  }

  const visited = new Set<string>();
  const queue: string[] = [baseOrigin + "/"];
  const scrapedUrls: ScrapedUrl[] = [];
  const now = dateTimeNowAsValue();
  const scrapeBatchId = `scrape-${hostname}-${now}`;

  let processedCount = 0;

  const processQueue = async (): Promise<void> => {
    if (queue.length === 0 || processedCount >= maxPages) {
      return;
    }

    const currentUrl = queue.shift();
    if (!currentUrl || visited.has(currentUrl)) {
      return processQueue();
    }

    visited.add(currentUrl);
    const parsed = normaliseUrl(baseOrigin, currentUrl);
    if (!parsed || parsed.hostname !== hostname) {
      return processQueue();
    }

    if (!isPageUrl(parsed.pathname)) {
      debugLog(`skipping non-page asset: ${parsed.pathname}`);
      return processQueue();
    }

    if (respectRobotsTxt && isDisallowed(parsed.pathname, disallowedPaths)) {
      debugLog(`skipping disallowed: ${parsed.pathname}`);
      return processQueue();
    }

    processedCount += 1;
    const percent = Math.min(99, Math.round((processedCount / Math.max(queue.length + processedCount, 1)) * 100));
    onProgress(`scraping ${parsed.pathname} (${processedCount} pages processed, ${queue.length} queued)`, percent);

    try {
      const { title, links, contentType } = await scrapePage(currentUrl);

      if (parsed.pathname !== "/") {
        scrapedUrls.push({
          path: parsed.pathname,
          fullUrl: currentUrl,
          title,
          httpStatus: 200,
          contentType
        });
      }

      links.forEach(link => {
        const linkUrl = normaliseUrl(baseOrigin, link);
        if (linkUrl && linkUrl.hostname === hostname && isPageUrl(linkUrl.pathname) && !visited.has(linkUrl.toString())) {
          queue.push(linkUrl.toString());
        }
      });

      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      debugLog(`error scraping ${currentUrl}:`, error);
      if (parsed.pathname !== "/") {
        scrapedUrls.push({
          path: parsed.pathname,
          fullUrl: currentUrl,
          title: "",
          httpStatus: 0,
          contentType: ""
        });
      }
    }

    return processQueue();
  };

  await processQueue();

  onProgress(`scraping complete, storing ${scrapedUrls.length} URLs`, 90);

  const existingMappings = await legacyUrlMapping.find({ legacyDomain: hostname }).lean();
  const existingKeys = new Set(
    existingMappings.map((m: any) => m.legacyPath)
  );

  const newMappings = scrapedUrls
    .filter(scraped => !existingKeys.has(scraped.path))
    .map(scraped => ({
      legacyDomain: hostname,
      legacyPath: scraped.path,
      legacyFragment: null,
      legacyFullUrl: scraped.fullUrl,
      title: scraped.title,
      httpStatus: scraped.httpStatus,
      contentType: scraped.contentType,
      lastModified: scraped.lastModified || null,
      confidence: RedirectConfidence.UNMAPPED,
      status: RedirectMappingStatus.PENDING,
      redirectType: 301,
      hitCount: 0,
      createdDate: now,
      updatedDate: now,
      scrapeBatchId
    }));

  if (newMappings.length > 0) {
    await legacyUrlMapping.insertMany(newMappings, { ordered: false }).catch(error => {
      debugLog("some inserts failed (likely duplicates):", error.message);
    });
  }

  onProgress(`stored ${newMappings.length} new URLs (${existingMappings.length} already existed)`, 100);

  return {
    urlsDiscovered: scrapedUrls.length,
    urlsMapped: 0
  };
}
