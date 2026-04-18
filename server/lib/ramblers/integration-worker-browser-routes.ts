import debug from "debug";
import { isString } from "es-toolkit/compat";
import express, { Request, Response } from "express";
import { Browser, chromium, Page } from "playwright";
import { verifyRamblersUploadSignature } from "./integration-worker-crypto";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../../../projects/ngx-ramblers/src/app/models/environment.model";
import { FlickrScrapedAlbumSummary, FlickrScrapedUserAlbumsData } from "../../../projects/ngx-ramblers/src/app/models/system.model";

const debugLog = debug(envConfig.logNamespace("integration-worker-browser-routes"));
debugLog.enabled = true;

const router = express.Router();

interface HtmlFetchRequest {
  url: string;
  timeoutMs?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle" | "commit";
}

interface HtmlFetchResponse {
  html: string;
  finalUrl: string;
  baseHref: string | null;
}

interface FlickrUserAlbumsRequest {
  userId: string;
}

router.post("/html-fetch", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({ error: "Invalid integration worker request signature" });
    return;
  }
  const body = req.body as HtmlFetchRequest;
  const url = body?.url;
  if (!isString(url) || !url) {
    res.status(400).json({ error: "url is required" });
    return;
  }
  const timeoutMs = body?.timeoutMs || 60000;
  const waitUntil = body?.waitUntil || "domcontentloaded";
  let browser: Browser | null = null;
  try {
    browser = await launchHeadlessChromium();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil, timeout: timeoutMs });
    const html = await page.content();
    const baseHref = await page.evaluate(() => {
      const el = document.querySelector("base[href]") as HTMLBaseElement | null;
      return el?.getAttribute("href") || null;
    });
    const response: HtmlFetchResponse = { html, finalUrl: page.url(), baseHref };
    res.json(response);
  } catch (error) {
    debugLog("html-fetch failed url:", url, "error:", (error as Error).message);
    res.status(502).json({ error: (error as Error).message });
  } finally {
    await closeBrowserQuietly(browser);
  }
});

router.post("/flickr-user-albums", async (req: Request, res: Response) => {
  if (!requestIsSigned(req)) {
    res.status(401).json({ error: "Invalid integration worker request signature" });
    return;
  }
  const body = req.body as FlickrUserAlbumsRequest;
  const userId = body?.userId;
  if (!isString(userId) || !userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  const url = `https://www.flickr.com/photos/${userId}/albums`;
  let browser: Browser | null = null;
  try {
    browser = await launchHeadlessChromium();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    await page.waitForFunction(
      () => document.querySelectorAll("a[href*='/albums/'], a[href*='/sets/']").length > 0
        || document.querySelectorAll("script").length > 5,
      null,
      { timeout: 10000 }
    ).catch(() => {
      debugLog("flickr-user-albums: albums not detected before consent");
    });

    await dismissCookieConsent(page);

    await page.waitForFunction(
      () => document.querySelectorAll("a[href*='/albums/'], a[href*='/sets/']").length > 0
        || document.querySelectorAll("script").length > 5,
      null,
      { timeout: 10000 }
    ).catch(() => {
      debugLog("flickr-user-albums: albums not detected after consent");
    });

    const userAlbumsData = await page.evaluate((userIdParam: string): FlickrScrapedUserAlbumsData | null => {
      try {
        const scripts = document.querySelectorAll("script");
        for (const script of Array.from(scripts)) {
          const content = script.textContent || "";
          if (content.includes("modelExport")) {
            const mainMatch = content.match(/"main"\s*:\s*(\{[\s\S]*\})\s*\}\s*;?\s*$/);
            if (mainMatch) {
              try {
                const mainData = JSON.parse(mainMatch[1]);
                const collections = mainData["photosets-models"] || mainData["collections-models"] || mainData["photostream-models"];
                if (collections && collections[0]) {
                  const albumsData = collections[0].data?.photosets?.data?._data
                    || collections[0].data?.sets?.data?._data
                    || collections[0].data?._data
                    || [];
                  const albums: FlickrScrapedAlbumSummary[] = [];
                  const albumCollection = albumsData || {};
                  const albumWrappers = (albumCollection as any)[Symbol.iterator]
                    ? Array.from(albumCollection as any)
                    : Object.getOwnPropertyNames(albumCollection).map(key => (albumCollection as any)[key]);
                  albumWrappers.forEach(albumWrapper => {
                    const album = albumWrapper.data || albumWrapper;
                    if (album.id) {
                      albums.push({
                        id: album.id,
                        title: album.title?._content || album.title || "Untitled",
                        description: album.description?._content || album.description || "",
                        photoCount: album.photos || album.count_photos || album.countPhotos || 0,
                        primaryPhotoServer: album.server || album.primary_photo_server || album.primaryPhotoServer,
                        primaryPhotoId: album.primary || album.primary_photo_id || album.primaryPhotoId,
                        primaryPhotoSecret: album.secret || album.primary_photo_secret || album.primaryPhotoSecret
                      });
                    }
                  });
                  const owner = collections[0].data?.owner?.data || {};
                  return {
                    username: owner.username || userIdParam,
                    userId: owner.id || owner.nsid || userIdParam,
                    albums
                  };
                }
              } catch {
                return null;
              }
            }
          }
        }
        const albumEls = document.querySelectorAll(".photo-list-album-view, .album-list-item, [data-album-id], .photo-list-album-container, .album-list-view-item");
        const albums: FlickrScrapedAlbumSummary[] = [];
        albumEls.forEach(el => {
          const albumId = el.getAttribute("data-album-id") || el.getAttribute("data-id") || "";
          const titleEl = el.querySelector(".title, h3, [data-testid='album-title'], .album-title");
          const countEl = el.querySelector(".photo-count, .count, .album-photo-count");
          if (albumId) {
            albums.push({
              id: albumId,
              title: titleEl?.textContent?.trim() || "Untitled",
              photoCount: parseInt(countEl?.textContent || "0", 10) || 0
            });
          }
        });
        if (albums.length === 0) {
          const albumLinks = document.querySelectorAll("a[href*='/albums/'], a[href*='/sets/']");
          albumLinks.forEach(link => {
            const href = link.getAttribute("href") || "";
            const match = href.match(/\/(?:albums|sets)\/(\d+)/);
            if (match) {
              const existingIds = albums.map(a => a.id);
              if (!existingIds.includes(match[1])) {
                const rawTitle = link.textContent?.trim() || "Untitled";
                const photoCountMatch = rawTitle.match(/(\d+)\s*photos?/i);
                const photoCount = photoCountMatch ? parseInt(photoCountMatch[1], 10) : 0;
                const cleanTitle = rawTitle
                  .replace(/\s*\d+\s*photos?\s*(and\s*\d+\s*videos?)?\s*(·\s*\d+\s*views?)?\s*$/i, "")
                  .replace(/\s*·\s*\d+\s*views?\s*$/i, "")
                  .trim();
                let coverPhotoUrl: string | undefined;
                const findCoverInElement = (el: Element | null): string | undefined => {
                  if (!el) return undefined;
                  const img = el.querySelector("img[src*='staticflickr.com'], img[src*='flickr.com']");
                  if (img) return (img as HTMLImageElement).src;
                  const bgEl = el.querySelector("[style*='background']");
                  if (bgEl) {
                    const style = bgEl.getAttribute("style") || "";
                    const bgMatch = style.match(/url\(['"]?(https?:\/\/[^'")\s]+staticflickr\.com[^'")\s]+)['"]?\)/i);
                    if (bgMatch) return bgMatch[1];
                  }
                  const dataImg = el.querySelector("[data-background-image], [data-src]");
                  if (dataImg) {
                    const dataSrc = dataImg.getAttribute("data-background-image") || dataImg.getAttribute("data-src");
                    if (dataSrc?.includes("staticflickr.com")) return dataSrc;
                  }
                  return undefined;
                };
                let parent: Element | null = link.closest(".photo-list-album-view, .album-list-item, [data-album-id], .photo-list-album-container, .photo-list-view");
                if (!parent) {
                  parent = link.parentElement?.parentElement || null;
                }
                coverPhotoUrl = findCoverInElement(parent);
                if (!coverPhotoUrl && link.parentElement) {
                  coverPhotoUrl = findCoverInElement(link.parentElement);
                }
                albums.push({
                  id: match[1],
                  title: cleanTitle || rawTitle,
                  photoCount,
                  coverPhotoUrl
                });
              }
            }
          });
        }
        return {
          username: userIdParam,
          userId: userIdParam,
          albums
        };
      } catch {
        return null;
      }
    }, userId);

    if (!userAlbumsData) {
      res.status(502).json({ error: "Failed to extract user albums from Flickr page" });
      return;
    }
    res.json(userAlbumsData);
  } catch (error) {
    debugLog("flickr-user-albums failed userId:", userId, "error:", (error as Error).message);
    res.status(502).json({ error: (error as Error).message });
  } finally {
    await closeBrowserQuietly(browser);
  }
});

async function launchHeadlessChromium(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu"
    ]
  });
}

async function closeBrowserQuietly(browser: Browser | null): Promise<void> {
  if (!browser) {
    return;
  }
  try {
    await browser.close();
  } catch (error) {
    debugLog("failed to close browser:", (error as Error).message);
  }
}

async function dismissCookieConsent(page: Page): Promise<void> {
  try {
    const iframeSelectors = [
      "iframe[src*='consent']",
      "iframe[src*='trustarc']",
      "iframe[id*='consent']",
      "iframe[title*='consent']"
    ];
    const acceptSelectors = [
      "a.call[data-choice='agree']",
      "button[data-choice='agree']",
      ".acceptAllButtonLowerCenter",
      ".acceptAllButton",
      "#consent_agree_button",
      "a.acceptAllButton",
      "button.acceptAllButton",
      "a[class*='agree']",
      "button[class*='agree']",
      "a.primary",
      "button.primary"
    ];
    for (const iframeSelector of iframeSelectors) {
      const iframeCount = await page.locator(iframeSelector).count();
      if (iframeCount === 0) {
        continue;
      }
      const frame = page.frameLocator(iframeSelector);
      for (const selector of acceptSelectors) {
        const button = frame.locator(selector).first();
        if (await button.count() > 0 && await button.isVisible().catch(() => false)) {
          await button.click({ timeout: 2000 }).catch(error => {
            debugLog("dismissCookieConsent: click failed for", selector, error);
          });
        }
      }
      return;
    }
    const directButtonSelectors = [
      "#onetrust-accept-btn-handler",
      "[data-testid='accept-cookies']",
      "button[aria-label*='Accept']",
      ".cookie-consent-accept",
      "#accept-cookies"
    ];
    for (const selector of directButtonSelectors) {
      const button = page.locator(selector).first();
      if (await button.count() > 0 && await button.isVisible().catch(() => false)) {
        await button.click({ timeout: 2000 }).catch(error => {
          debugLog("dismissCookieConsent: direct click failed for", selector, error);
        });
      }
    }
  } catch (error) {
    debugLog("dismissCookieConsent: error dismissing consent:", error);
  }
}

function requestIsSigned(req: Request): boolean {
  const secret = envConfig.value(Environment.INTEGRATION_WORKER_SHARED_SECRET);
  if (!secret) {
    return false;
  }
  const signature = req.header("x-ramblers-upload-signature") || "";
  const body = JSON.stringify(req.body ?? {});
  return verifyRamblersUploadSignature(body, secret, signature);
}

export const integrationWorkerBrowserRoutes = router;
