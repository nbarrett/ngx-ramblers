import debug from "debug";
import * as fs from "fs/promises";
import path from "path";
import { isArray, isNumber, isString, values } from "es-toolkit/compat";
import { envConfig } from "../env-config/env-config";
import {
  ExternalAlbumMetadata,
  ExternalAlbumSource,
  ExternalAlbumSummary,
  ExternalPhoto,
  ExternalUserAlbumsMetadata,
  FlickrScrapedAlbumData,
  FlickrScrapedAlbumSummary,
  FlickrScrapedPhotoData,
  FlickrScrapedUserAlbumsData
} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {
  AlbumProviderConfig,
  ExternalAlbumProvider,
  ParsedAlbumUrl,
  ProviderProgressCallback
} from "./external-album-provider";
import { launchBrowser } from "../migration/serenity-utils";
import { entries } from "../../../projects/ngx-ramblers/src/app/functions/object-utils";
import { dateTimeNowAsValue } from "../shared/dates";
import { Environment } from "../env-config/environment-model";

const debugLog = debug(envConfig.logNamespace("flickr-provider"));
debugLog.enabled = true;
const flickrHtmlDumpDir = envConfig.value(Environment.FLICKR_SCRAPE_DUMP_DIR);

async function saveHtmlSnapshot(label: string, url: string, html: string): Promise<void> {
  if (!flickrHtmlDumpDir) {
    return;
  }
  try {
    await fs.mkdir(flickrHtmlDumpDir, { recursive: true });
    const safeLabel = label.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");
    const fileName = `${safeLabel || "album"}-${dateTimeNowAsValue()}.html`;
    const filePath = path.join(flickrHtmlDumpDir, fileName);
    await fs.writeFile(filePath, html);
    debugLog("saveHtmlSnapshot: wrote", filePath, "for", url);
  } catch (error) {
    debugLog("saveHtmlSnapshot: failed for", url, error);
  }
}

export function cleanFlickrAlbumTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*\d+\s*photos?\s*(and\s*\d+\s*videos?)?\s*(·\s*\d+\s*views?)?\s*$/i, "")
    .replace(/\s*·\s*\d+\s*views?\s*$/i, "")
    .trim() || rawTitle;
}

const FLICKR_ALBUM_URL_PATTERN = /flickr\.com\/photos\/([^/]+)\/(?:albums|sets)\/(\d+)/i;
const FLICKR_USER_ALBUMS_URL_PATTERN = /flickr\.com\/(?:photos|people)\/([^/]+)\/?(?:albums?\/?)?$/i;
const FLICKR_SHORT_URL_PATTERN = /flic\.kr\/s\/([a-zA-Z0-9]+)/i;

function buildImageUrl(photo: FlickrScrapedPhotoData, size: string): string {
  if (photo.server && photo.secret) {
    return `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_${size}.jpg`;
  }
  return "";
}

function getBestPhotoUrl(photo: FlickrScrapedPhotoData): string {
  if (photo.sizes?.o?.url) return photo.sizes.o.url;
  if (photo.sizes?.l?.url) return photo.sizes.l.url;
  if (photo.sizes?.c?.url) return photo.sizes.c.url;
  if (photo.sizes?.z?.url) return photo.sizes.z.url;
  return buildImageUrl(photo, "b");
}

function getThumbnailUrl(photo: FlickrScrapedPhotoData): string {
  if (photo.sizes?.sq?.url) return photo.sizes.sq.url;
  if (photo.sizes?.s?.url) return photo.sizes.s.url;
  return buildImageUrl(photo, "q");
}

function mergeUniquePhotos(existing: FlickrScrapedPhotoData[], additions: FlickrScrapedPhotoData[]): FlickrScrapedPhotoData[] {
  const seen = new Set(existing.map(photo => photo.id));
  return additions.reduce((acc, photo) => {
    if (seen.has(photo.id)) {
      return acc;
    }
    seen.add(photo.id);
    return acc.concat(photo);
  }, existing);
}

function extractFirstPhotoIdFromHtml(html: string): string | null {
  const modelData = extractModelExportFromHtml(html);
  const modelId = modelData?.photos[0]?.id || null;
  if (modelId) {
    return modelId;
  }
  return null;
}

async function fetchAlbumChunkWithPhoto(
  baseUrl: string,
  photoId: string,
  label: string,
  onProgress?: ProviderProgressCallback
): Promise<FlickrScrapedAlbumData | null> {
  const withUrl = `${baseUrl}/with/${photoId}`;
  debugLog("fetchAlbumChunkWithPhoto: fetching", withUrl);
  if (onProgress) {
    onProgress(`Fetching ${label}...`);
  }

  const response = await fetch(withUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5"
    }
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  await saveHtmlSnapshot(label, withUrl, html);
  const pageData = extractModelExportFromHtml(html);

  if (!pageData || pageData.photos.length === 0) {
    return null;
  }

  return pageData;
}

async function fetchAlbumChunksViaWithPages(
  baseUrl: string,
  pageOneData: FlickrScrapedAlbumData,
  chunkSize: number,
  expectedPhotoCount?: number,
  onProgress?: ProviderProgressCallback
): Promise<FlickrScrapedAlbumData> {
  const targetTotal = expectedPhotoCount || pageOneData.totalPhotos || pageOneData.photos.length;
  const pageSize = chunkSize > 0 ? chunkSize : 100;
  const totalPages = Math.max(1, Math.ceil(targetTotal / pageSize));
  let allPhotos = pageOneData.photos;

  const pages = Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => index + 2);
  await pages.reduce(async (previousPromise, page) => {
    await previousPromise;
    if (targetTotal && allPhotos.length >= targetTotal) {
      return;
    }
    const pageUrl = `${baseUrl}/page${page}`;
    debugLog("fetchAlbumChunksViaWithPages: fetching page", page, pageUrl);
    if (onProgress) {
      onProgress(`Fetching page ${page}...`);
    }

    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });

    if (!response.ok) {
      return;
    }

    const html = await response.text();
    await saveHtmlSnapshot(`page-${page}`, pageUrl, html);
    const firstPhotoId = extractFirstPhotoIdFromHtml(html);
    if (!firstPhotoId) {
      return;
    }

    const chunk = await fetchAlbumChunkWithPhoto(baseUrl, firstPhotoId, `with-${firstPhotoId}`, onProgress);
    if (!chunk) {
      return;
    }

    const previousCount = allPhotos.length;
    allPhotos = mergeUniquePhotos(allPhotos, chunk.photos);
    const added = allPhotos.length - previousCount;
    debugLog("fetchAlbumChunksViaWithPages: page", page, "added", added, "photos, total:", allPhotos.length);

    if (onProgress) {
      const percent = targetTotal ? Math.round((allPhotos.length / targetTotal) * 100) : 0;
      onProgress(`Loaded ${allPhotos.length}${targetTotal ? ` of ${targetTotal}` : ""} photos (${percent}%)`);
    }
  }, Promise.resolve());

  return {
    title: pageOneData.title,
    description: pageOneData.description,
    owner: pageOneData.owner,
    photos: allPhotos,
    totalPhotos: pageOneData.totalPhotos || allPhotos.length
  };
}

function transformScrapedPhoto(photo: FlickrScrapedPhotoData): ExternalPhoto {
  let dateTaken: number | undefined;
  if (photo.dateTaken) {
    const parsed = Date.parse(photo.dateTaken);
    if (!isNaN(parsed)) {
      dateTaken = parsed;
    }
  }

  return {
    id: photo.id,
    title: photo.title || "",
    url: getBestPhotoUrl(photo),
    thumbnailUrl: getThumbnailUrl(photo),
    dateTaken,
    description: photo.description
  };
}

async function dismissCookieConsent(browser: WebdriverIO.Browser): Promise<void> {
  try {
    const iframeSelectors = [
      "iframe[src*='consent']",
      "iframe[src*='trustarc']",
      "iframe[id*='consent']",
      "iframe[title*='consent']"
    ];

    let consentFrame = null;
    await iframeSelectors.reduce(async (previousPromise, selector) => {
      await previousPromise;
      if (!consentFrame) {
        const frame = await browser.$(selector);
        if (await frame.isExisting()) {
          consentFrame = frame;
        }
      }
    }, Promise.resolve());

    if (consentFrame) {
      debugLog("dismissCookieConsent: found consent iframe, switching to it");
      await browser.switchToFrame(consentFrame);

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

      await acceptSelectors.reduce(async (previousPromise, selector) => {
        await previousPromise;
        const button = await browser.$(selector);
        if (await button.isExisting() && await button.isClickable()) {
          debugLog("dismissCookieConsent: clicking", selector);
          await button.click();
        }
      }, Promise.resolve());

      await browser.switchToParentFrame();
      debugLog("dismissCookieConsent: consent dismissed via iframe");
      return;
    }

    const directButtonSelectors = [
      "#onetrust-accept-btn-handler",
      "[data-testid='accept-cookies']",
      "button[aria-label*='Accept']",
      ".cookie-consent-accept",
      "#accept-cookies"
    ];

    await directButtonSelectors.reduce(async (previousPromise, selector) => {
      await previousPromise;
      const button = await browser.$(selector);
      if (await button.isExisting() && await button.isClickable()) {
        debugLog("dismissCookieConsent: clicking direct button", selector);
        await button.click();
      }
    }, Promise.resolve());

  } catch (e) {
    debugLog("dismissCookieConsent: error dismissing consent (continuing anyway):", e);
    try {
      await browser.switchToParentFrame();
    } catch (_) {
      debugLog("dismissCookieConsent: failed to switch back to parent frame");
    }
  }
}

function extractModelExportData(modelExport: any): FlickrScrapedAlbumData | null {
  const setModels = modelExport?.main?.["set-models"];
  if (!setModels?.[0]?.data) {
    debugLog("extractModelExportData: no set-models data found");
    return null;
  }

  const legendEntries = isArray(modelExport?.legend) ? modelExport.legend : [];
  const resolvePath = (root: any, path: any[]) => path.reduce((acc: any, key: any) => (acc ? acc[key] : null), root);
  const legendValues = legendEntries.map((path: any[]) => resolvePath(modelExport?.main, path));
  const resolveLegendValue = (value: any) => {
    if (!isString(value)) {
      return value;
    }
    if (!value.startsWith("~")) {
      return value;
    }
    const index = parseInt(value.slice(1), 10);
    return Number.isNaN(index) ? value : legendValues[index];
  };
  const resolvePhotoData = (photoWrapper: any) => {
    const resolvedWrapper = resolveLegendValue(photoWrapper);
    const wrapperData = resolvedWrapper?.data || resolvedWrapper;
    const resolvedData = resolveLegendValue(wrapperData);
    const nestedData = resolvedData?.data ? resolveLegendValue(resolvedData.data) : resolvedData;
    return nestedData;
  };

  const albumInfo = setModels[0].data;
  const title = albumInfo.title || "Untitled Album";
  const description = albumInfo.description || "";
  const owner = albumInfo.owner?.data || {};
  const photoPageListData = albumInfo.photoPageList?.data?._data;
  const rawEntries = isArray(photoPageListData) ? photoPageListData : (photoPageListData ? values(photoPageListData) : []);
  const photoPageList = rawEntries
    .map(resolvePhotoData)
    .filter((data: any) => data && (data.id || data.secret || data.server));

  debugLog("extractModelExportData: found", rawEntries.length, "raw entries,", photoPageList.length, "with photo data");

  const photoModelsData = modelExport?.main?.["photo-models"];
  const photoModelsEntries = isArray(photoModelsData) ? photoModelsData : (photoModelsData ? values(photoModelsData) : []);
  const photoModels = photoModelsEntries
    .map(resolvePhotoData)
    .filter((photoData: any) => photoData && photoData.id);

  const photoCandidates = [...photoPageList, ...photoModels]
    .map(resolvePhotoData)
    .filter((photoData: any) => photoData && photoData.id);

  const photos: FlickrScrapedPhotoData[] = photoCandidates
    .reduce((acc: FlickrScrapedPhotoData[], photoData: any) => {
      if (acc.some(photo => photo.id === photoData.id)) {
        return acc;
      }

      const sizes: Record<string, { url: string }> = {};
      if (photoData.sizes?.data) {
        entries(photoData.sizes.data).forEach(([key, sizeData]: [string, any]) => {
          const urlData = sizeData.data || sizeData;
          const rawUrl = urlData.url || urlData.displayUrl;
          if (rawUrl) {
            sizes[key] = {url: rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl};
          }
        });
      }

      const photoEntry: FlickrScrapedPhotoData = {
        id: photoData.id,
        title: photoData.title || "",
        server: photoData.server,
        secret: photoData.secret,
        sizes,
        dateTaken: photoData.dateTaken,
        description: photoData.description
      };
      return acc.concat(photoEntry);
    }, [] as FlickrScrapedPhotoData[])
    .filter(Boolean) as FlickrScrapedPhotoData[];

  const totalCandidates = [
    albumInfo.photoCount,
    albumInfo.publicPhotosCount,
    albumInfo.photoPageList?.data?.totalItems
  ]
    .map(value => {
      if (isNumber(value)) return value;
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    })
    .filter(value => value !== null) as number[];

  const totalPhotos = totalCandidates.length > 0 ? totalCandidates[0] : photos.length;

  debugLog("extractModelExportData: extracted", photos.length, "photos from", title);
  return {
    title,
    description,
    owner: {
      username: owner.username,
      id: owner.id || owner.nsid
    },
    photos,
    totalPhotos
  };
}

function extractModelExportFromHtml(html: string): FlickrScrapedAlbumData | null {
  const startMarker = "modelExport:";
  const startIndex = html.indexOf(startMarker);
  if (startIndex === -1) {
    debugLog("extractModelExportFromHtml: no modelExport marker found");
    return null;
  }

  const jsonStart = html.indexOf("{", startIndex + startMarker.length);
  if (jsonStart === -1) {
    debugLog("extractModelExportFromHtml: no modelExport JSON found");
    return null;
  }
  let braceCount = 0;
  let jsonEnd = jsonStart;

  html.slice(jsonStart).split("").some((char, i) => {
    if (char === "{") braceCount++;
    if (char === "}") braceCount--;
    jsonEnd = jsonStart + i + 1;
    return braceCount === 0;
  });

  const jsonStr = html.slice(jsonStart, jsonEnd);
  debugLog("extractModelExportFromHtml: extracted JSON of length", jsonStr.length);

  try {
    const modelExport = JSON.parse(jsonStr);
    return extractModelExportData(modelExport);
  } catch (e) {
    debugLog("extractModelExportFromHtml: parse error:", e);
    return null;
  }
}

async function fetchAlbumPageViaHttp(
  url: string,
  expectedPhotoCount?: number,
  onProgress?: ProviderProgressCallback
): Promise<FlickrScrapedAlbumData> {
  debugLog("fetchAlbumPageViaHttp: fetching", url, "expected:", expectedPhotoCount || "unknown");

  const baseUrl = url.replace(/\/with\/\d+\/?$/, "").replace(/\/page\d+\/?$/, "");
  const allPhotos: FlickrScrapedPhotoData[] = [];
  let albumTitle = "";
  let albumDescription = "";
  let albumOwner: { username?: string; id?: string } | undefined;
  let albumTotalPhotos: number | null = null;
  let pageOneChunkSize = 0;

  const fetchPage = async (page: number): Promise<FlickrScrapedAlbumData | null> => {
    const pageUrl = page === 1 ? baseUrl : `${baseUrl}/page${page}`;
    debugLog("fetchAlbumPageViaHttp: fetching page", page, pageUrl);

    if (onProgress) {
      onProgress(`Fetching page ${page}...`);
    }

    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      }
    });

    if (!response.ok) {
      if (page === 1) {
        throw new Error(`Failed to fetch album page: ${response.status} ${response.statusText}`);
      }
      return null;
    }

    const html = await response.text();
    await saveHtmlSnapshot(`page-${page}`, pageUrl, html);
    let pageData = extractModelExportFromHtml(html);

    if (!pageData || pageData.photos.length === 0) {
      debugLog("fetchAlbumPageViaHttp: no more photos on page", page);
      return null;
    }

    if (page === 1) {
      albumTitle = pageData.title;
      albumDescription = pageData.description || "";
      albumOwner = pageData.owner;
      if (isNumber(pageData.totalPhotos)) {
        albumTotalPhotos = pageData.totalPhotos;
      }
      const shouldTryWith = (albumTotalPhotos && albumTotalPhotos > pageData.photos.length)
        || (expectedPhotoCount && expectedPhotoCount > pageData.photos.length);
      if (shouldTryWith) {
        const firstPhotoId = pageData.photos[0]?.id;
        if (firstPhotoId) {
          const withUrl = `${baseUrl}/with/${firstPhotoId}`;
          debugLog("fetchAlbumPageViaHttp: fetching /with page", withUrl);
          if (onProgress) {
            onProgress("Fetching full album page...");
          }
          const withResponse = await fetch(withUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5"
            }
          });

          if (withResponse.ok) {
            const withHtml = await withResponse.text();
            await saveHtmlSnapshot(`with-${firstPhotoId}`, withUrl, withHtml);
            const withData = extractModelExportFromHtml(withHtml);
            if (withData && withData.photos.length > pageData.photos.length) {
              debugLog("fetchAlbumPageViaHttp: /with page returned", withData.photos.length, "photos");
              pageData = withData;
            }
          }
        }
      }
      pageOneChunkSize = pageData.photos.length;
    }

    if (page === 1) {
      const targetTotal = expectedPhotoCount || albumTotalPhotos;
      const hasMoreThanFirstChunk = targetTotal && targetTotal > pageData.photos.length;
      const withChunkAdded = pageOneChunkSize > 0 && pageData.photos.length >= pageOneChunkSize;
      if (hasMoreThanFirstChunk && withChunkAdded) {
        debugLog("fetchAlbumPageViaHttp: switching to /with chunk pagination for", targetTotal, "photos");
        return fetchAlbumChunksViaWithPages(baseUrl, pageData, pageOneChunkSize, targetTotal, onProgress);
      }
    }

    debugLog("fetchAlbumPageViaHttp: page", page, "returned", pageData.photos.length, "photos, first IDs:", pageData.photos.slice(0, 3).map(p => p.id));

    const newPhotos = pageData.photos.filter(p => !allPhotos.find(existing => existing.id === p.id));
    allPhotos.push(...newPhotos);

    debugLog("fetchAlbumPageViaHttp: page", page, "added", newPhotos.length, "new photos, total:", allPhotos.length);

    if (onProgress) {
      const percent = expectedPhotoCount ? Math.round((allPhotos.length / expectedPhotoCount) * 100) : 0;
      onProgress(`Loaded ${allPhotos.length}${expectedPhotoCount ? ` of ${expectedPhotoCount}` : ""} photos (${percent}%)`);
    }

    if (expectedPhotoCount && allPhotos.length >= expectedPhotoCount * 0.95) {
      debugLog("fetchAlbumPageViaHttp: reached expected count");
      return null;
    }

    if (newPhotos.length === 0) {
      debugLog("fetchAlbumPageViaHttp: no new photos on page", page);
      return null;
    }

    return fetchPage(page + 1);
  };

  const chunkResult = await fetchPage(1);

  if (chunkResult && chunkResult.title && chunkResult.photos) {
    return chunkResult;
  }

  if (allPhotos.length === 0) {
    throw new Error("Failed to extract album data from page HTML");
  }

  return {
    title: albumTitle,
    description: albumDescription,
    owner: albumOwner,
    photos: allPhotos,
    totalPhotos: albumTotalPhotos ?? allPhotos.length
  };
}

async function scrapeAlbumPage(
  url: string,
  expectedPhotoCount?: number,
  onProgress?: ProviderProgressCallback
): Promise<FlickrScrapedAlbumData> {
  if (onProgress) onProgress("Fetching album page...");
  return fetchAlbumPageViaHttp(url, expectedPhotoCount, onProgress);
}

async function scrapeUserAlbumsPage(userId: string): Promise<FlickrScrapedUserAlbumsData> {
  const url = `https://www.flickr.com/photos/${userId}/albums`;
  debugLog("scrapeUserAlbumsPage: launching browser for", url);
  let browser: WebdriverIO.Browser | null = null;

  try {
    browser = await launchBrowser();
    debugLog("scrapeUserAlbumsPage: navigating to", url);
    await browser.url(url);

    await browser.waitUntil(async () => {
      const state = await browser!.execute(() => document.readyState);
      return state === "complete" || state === "interactive";
    }, { timeout: 60000, timeoutMsg: "Page did not load within 60 seconds" });

    await browser.waitUntil(async () => {
      const hasAlbums = await browser!.execute(() =>
        document.querySelectorAll("a[href*='/albums/'], a[href*='/sets/']").length > 0 ||
        document.querySelectorAll("script").length > 5
      );
      return hasAlbums;
    }, { timeout: 10000 });

    await dismissCookieConsent(browser);

    await browser.waitUntil(async () => {
      const hasAlbums = await browser!.execute(() =>
        document.querySelectorAll("a[href*='/albums/'], a[href*='/sets/']").length > 0 ||
        document.querySelectorAll("script").length > 5
      );
      return hasAlbums;
    }, { timeout: 10000 }).catch(() => {
      debugLog("scrapeUserAlbumsPage: albums not detected after consent");
    });

    const pageHtml = await browser.getPageSource();
    await saveHtmlSnapshot("user-albums", url, pageHtml);

    const userAlbumsData = await browser.execute((userIdParam: string): FlickrScrapedUserAlbumsData | null => {
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
                  const albumsData = collections[0].data?.photosets?.data?._data ||
                                    collections[0].data?.sets?.data?._data ||
                                    collections[0].data?._data || [];

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
      } catch (err) {
        return null;
      }
    }, userId);

    if (!userAlbumsData) {
      throw new Error("Failed to extract user albums from page");
    }

    debugLog("scrapeUserAlbumsPage: extracted", userAlbumsData.albums.length, "albums for", userAlbumsData.username);
    return userAlbumsData;

  } finally {
    if (browser) {
      try {
        await browser.deleteSession();
        debugLog("scrapeUserAlbumsPage: browser session closed");
      } catch (e) {
        debugLog("scrapeUserAlbumsPage: failed to close browser:", e);
      }
    }
  }
}

async function fetchAlbumCoverPhoto(userId: string, albumId: string): Promise<string | undefined> {
  try {
    const url = `https://www.flickr.com/photos/${userId}/albums/${albumId}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html"
      }
    });
    if (!response.ok) return undefined;

    const html = await response.text();

    const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                         html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
    if (ogImageMatch && ogImageMatch[1].includes("staticflickr.com")) {
      return ogImageMatch[1];
    }

    const coverMatch = html.match(/https:\/\/live\.staticflickr\.com\/\d+\/\d+_[a-z0-9]+(?:_[a-z])?\.jpg/i);
    if (coverMatch) {
      return coverMatch[0].replace(/_[a-z]\.jpg$/i, "_q.jpg");
    }

    return undefined;
  } catch (e) {
    debugLog("fetchAlbumCoverPhoto: failed for album", albumId, e);
    return undefined;
  }
}

async function resolveShortUrl(shortCode: string): Promise<string> {
  const shortUrl = `https://flic.kr/s/${shortCode}`;
  debugLog("resolveShortUrl: resolving", shortUrl);
  const response = await fetch(shortUrl, { redirect: "follow" });
  const finalUrl = response.url;
  debugLog("resolveShortUrl: resolved to", finalUrl);
  return finalUrl;
}

export async function fetchUserAlbums(
  config: AlbumProviderConfig,
  userId: string
): Promise<ExternalUserAlbumsMetadata> {
  debugLog("fetchUserAlbums:", userId);

  const scrapedData = await scrapeUserAlbumsPage(userId);

  const albums: ExternalAlbumSummary[] = scrapedData.albums.map(album => ({
    id: album.id,
    title: album.title,
    description: album.description || "",
    photoCount: album.photoCount,
    coverPhotoUrl: album.coverPhotoUrl || (album.primaryPhotoServer && album.primaryPhotoId && album.primaryPhotoSecret
      ? `https://live.staticflickr.com/${album.primaryPhotoServer}/${album.primaryPhotoId}_${album.primaryPhotoSecret}_q.jpg`
      : undefined),
    selected: false,
    targetPath: ""
  }));

  const albumsWithoutCovers = albums.filter(a => !a.coverPhotoUrl);
  if (albumsWithoutCovers.length > 0) {
    debugLog("fetchUserAlbums: fetching cover photos for", albumsWithoutCovers.length, "albums");
    await Promise.all(albumsWithoutCovers.map(async album => {
      const coverUrl = await fetchAlbumCoverPhoto(scrapedData.userId, album.id);
      if (coverUrl) {
        album.coverPhotoUrl = coverUrl;
      }
    }));
  }

  return {
    source: ExternalAlbumSource.FLICKR,
    userId: scrapedData.userId,
    username: scrapedData.username,
    albums,
    totalAlbums: albums.length
  };
}

export function parseUserAlbumsUrl(url: string): string | null {
  const match = url.match(FLICKR_USER_ALBUMS_URL_PATTERN);
  if (match) {
    return match[1];
  }
  return null;
}

export const flickrProvider: ExternalAlbumProvider = {
  source: ExternalAlbumSource.FLICKR,

  parseAlbumUrl(url: string): ParsedAlbumUrl | null {
    const shortMatch = url.match(FLICKR_SHORT_URL_PATTERN);
    if (shortMatch) {
      return {
        userId: "",
        albumId: shortMatch[1],
        originalUrl: url,
        isShortUrl: true
      };
    }

    const match = url.match(FLICKR_ALBUM_URL_PATTERN);
    if (match) {
      return {
        userId: match[1],
        albumId: match[2],
        originalUrl: url
      };
    }
    return null;
  },

  async fetchAlbumMetadata(
    config: AlbumProviderConfig,
    parsedUrl: ParsedAlbumUrl,
    onProgress?: ProviderProgressCallback
  ): Promise<ExternalAlbumMetadata> {
    debugLog("fetchAlbumMetadata:", parsedUrl, "apiKey configured:", !!config.apiKey);

    let albumUrl = parsedUrl.originalUrl ||
      (parsedUrl.userId && parsedUrl.albumId
        ? `https://www.flickr.com/photos/${parsedUrl.userId}/albums/${parsedUrl.albumId}`
        : "");

    if ((parsedUrl as any).isShortUrl) {
      albumUrl = await resolveShortUrl(parsedUrl.albumId);
      const fullMatch = albumUrl.match(FLICKR_ALBUM_URL_PATTERN);
      if (fullMatch) {
        parsedUrl.userId = fullMatch[1];
        parsedUrl.albumId = fullMatch[2];
      }
    }

    const expectedPhotoCount = parsedUrl.expectedPhotoCount;
    const scrapedData = await scrapeAlbumPage(albumUrl, expectedPhotoCount, onProgress);

    const photos = scrapedData.photos.map(transformScrapedPhoto);
    const coverPhoto = photos[0];

    return {
      source: ExternalAlbumSource.FLICKR,
      id: parsedUrl.albumId,
      title: scrapedData.title,
      description: scrapedData.description || "",
      photoCount: photos.length,
      photos,
      coverPhotoUrl: coverPhoto?.url
    };
  }
};
