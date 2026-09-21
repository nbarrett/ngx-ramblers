import { fetchPublicSiteHtml } from "../site-registration/public-site-fetch";
import { HttpError } from "../shared/http-error";
import { Browser, Page } from "playwright";
import { launchBrowser as sharedLaunchBrowser } from "./browser-utils";
import {
  AlbumView,
  ContentText,
  IndexContentType,
  IndexRenderMode,
  PageContent,
  PageContentColumn,
  PageContentRow,
  AlbumData,
  PageContentType,
  StringMatch
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import * as mongooseClient from "../mongo/mongoose-client";
import { pageContent as pageContentModel } from "../mongo/models/page-content";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { first, isArray, isString, omit } from "es-toolkit/compat";
import { toKebabCase } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { fullMonthName, galleryDateFrom, MONTH_NAME_PATTERN } from "../../../projects/ngx-ramblers/src/app/functions/gallery-date";
import { generateUid, humaniseFileStemFromUrl, pluraliseWithCount, titleCase } from "../shared/string-utils";
import { ExternalAlbumMetadata, ExternalAlbumSource, RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { contentMetadata } from "../mongo/models/content-metadata";
import { assertMigrationNotCancelled, progress } from "./migration-progress";
import * as exclusions from "./text-exclusions";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { ContentMetadata } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import {
  PageLink,
  ParentPageConfig,
  ParentPageMode,
  SiteMigrationConfig
} from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import {
  FlickrAlbumLink,
  FlickrGroupLink,
  MigratedAlbum,
  MigrationResult,
  ScrapedImage,
  ScrapedPage,
  ScrapedSegment
} from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { PageTransformationEngine } from "./page-transformation-engine";
import { htmlToMarkdown } from "./turndown-service-factory";
import mongoose from "mongoose";
import { fetchFlickrGroupPool, fetchUserAlbums, flickrAlbumUrlsIn, flickrGroupAsAlbum, flickrGroupNamesIn, flickrProvider, flickrUserAlbumsUrlsIn, parseUserAlbumsUrl } from "../external-album/flickr-provider";
import { externalAlbumDocuments, importExternalAlbum } from "../external-album/external-album-import-service";
import { SourceSiteUnavailableError, sourceSiteLimiter } from "../site-registration/source-site-limiter";
import { registrationCommitteeCandidatesFromMarkdown } from "../site-registration/registration-committee";
import { RegistrationNavbarPath } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";

const debugLog = debug(envConfig.logNamespace("static-html-site-migrator"));
debugLog.enabled = true;

const MIN_IMAGES_FOR_PAGE_ALBUM = 4;
const MIN_IMAGES_FOR_GALLERY_ALBUM = 1;
const MIN_IMAGES_FOR_HOME_CAROUSEL = 2;
const MIGRATED_CAROUSEL_HEIGHT = 400;
const REPEATED_BLOCK_PAGE_SHARE = 0.2;
const MIN_PAGES_FOR_REPEATED_BLOCK = 3;

type Ctx = {
  config: SiteMigrationConfig;
  browser: Browser | null;
  imageMappings: Map<string, string>;
  templateCache: Map<string, PageContent | null>;
  sourceSiteStopped: SourceSiteUnavailableError | null;
};

function withDefaults(config: SiteMigrationConfig): SiteMigrationConfig {
  return {
    persistData: false,
    ...config,
    uploadTos3: false
  };
}

async function launchBrowser(ctx: Ctx): Promise<Browser> {
  if (!ctx.browser) {
    ctx.browser = await sharedLaunchBrowser();
  }
  return ctx.browser;
}

async function closeBrowser(ctx: Ctx): Promise<void> {
  if (ctx.browser) {
    await ctx.browser.close();
    ctx.browser = null;
  }
}

async function loadTemplate(ctx: Ctx, identifier?: string): Promise<PageContent | null> {
  if (!identifier) {
    return null;
  } else if (ctx.templateCache.has(identifier)) {
    return ctx.templateCache.get(identifier) || null;
  } else if (ctx.config.templatePages) {
    debugLog(`❌ Template not supplied with the job for identifier ${identifier}`);
    ctx.templateCache.set(identifier, null);
    return null;
  } else {
    const byId = mongoose.isValidObjectId(identifier) ? await pageContentModel.findById(identifier).lean<PageContent>().exec() : null;
    const template = byId || await pageContentModel.findOne({path: identifier}).lean<PageContent>().exec();
    if (!template) {
      debugLog(`❌ Template not found for identifier ${identifier}`);
    } else {
      debugLog(`✅ Loaded template ${template.path || identifier}`);
    }
    ctx.templateCache.set(identifier, template);
    return template;
  }
}

async function templateForParent(ctx: Ctx, parentPageConfig?: ParentPageConfig): Promise<PageContent | null> {
  if (parentPageConfig?.templateFragmentId) {
    return loadTemplate(ctx, parentPageConfig.templateFragmentId);
  }
  return loadTemplate(ctx, ctx.config.templateFragmentId);
}

function configurePageDiagnostics(page: Page): void {
  page.on("response", async res => {
    try {
      const status = res.status();
      if (status >= 400) {
        const url = res.url();
        debugLog(`❌ Subresource ${status}: ${url}`);
      }
    } catch (error) {
      debugLog("response diagnostics handler failed", error);
    }
  });
  page.on("requestfailed", req => {
    try {
      const url = req.url();
      const failure = req.failure()?.errorText || "request failed";
      debugLog(`❌ Subresource failed: ${url} -> ${failure}`);
    } catch (error) {
      debugLog("requestfailed diagnostics handler failed", error);
    }
  });
}

function pageContentToPersist(page: PageContent): PageContent {
  return omit(page, ["debugLogs"]) as PageContent;
}

export function skippedPageReason(error: unknown): string {
  const status = error instanceof HttpError ? error.status : null;
  if (status === 404 || status === 410) {
    return "the old site no longer has this page";
  } else if (status) {
    return `the old site answered with HTTP ${status}`;
  } else {
    return error instanceof Error ? error.message : String(error);
  }
}

async function createPage(ctx: Ctx): Promise<Page> {
  assertMigrationNotCancelled();
  assertSourceSiteResponding(ctx);
  const browser = await launchBrowser(ctx);
  const page = await browser.newPage({javaScriptEnabled: !ctx.config.publicHtmlOnly});
  if (ctx.config.publicHtmlOnly) {
    await page.route("**/*", async route => {
      if (route.request().isNavigationRequest() && route.request().frame() === page.mainFrame()) {
        try {
          await route.fulfill({status: 200, contentType: "text/html", body: await fetchPublicSiteHtml(route.request().url())});
        } catch (error) {
          if (error instanceof SourceSiteUnavailableError) {
            ctx.sourceSiteStopped = error;
          }
          progress(`Skipped ${route.request().url()}: ${skippedPageReason(error)}`);
          await route.fulfill({status: 404, contentType: "text/html", body: "<html><body></body></html>"});
        }
      } else {
        await route.abort();
      }
    });
  }
  if (!ctx.config.publicHtmlOnly) {
    configurePageDiagnostics(page);
  }
  return page;
}

function toContentPath(path: string): string {
  const url = new URL(path);
  const contentPath = toKebabCase(...first(url.pathname.split(".")).split("/").filter(item => !["index"].includes(item.toLowerCase())));
  debugLog("✅ toContentPath:path:", path, "contentPath:", contentPath);
  return contentPath;
}

function fidelityText(value: string): string {
  return exclusions.cleanMarkdown(value || "").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "").replace(/\s+/g, " ").trim();
}

function contentColumns(rows: PageContentRow[]): PageContentColumn[] {
  return rows.flatMap(row => row.columns || []).flatMap(column => [column, ...contentColumns(column.rows || [])]);
}

function isContactUsPage(target: PageContent): boolean {
  const path = (target.path || "").replace(/^\/+|\/+$/g, "");
  return path === RegistrationNavbarPath.CONTACT_US || path.endsWith(`/${RegistrationNavbarPath.CONTACT_US}`);
}

export function sourceFidelityGaps(source: ScrapedPage, target: PageContent, imageMappings: Map<string, string> = new Map()): string[] {
  const columns = contentColumns(target.rows || []);
  const targetText = fidelityText(columns.flatMap(column => [column.contentText || "", column.alt || ""]).join("\n"));
  const targetImages = new Set(columns.map(column => column.imageSource).filter(Boolean));
  const markdown = (source.segments || []).map(segment => segment.text || "").join("\n");
  const contacts = isContactUsPage(target) ? registrationCommitteeCandidatesFromMarkdown(markdown) : [];
  if (contacts.length > 0) {
    return contacts.filter(candidate => !targetText.includes(fidelityText(candidate.name))).map(candidate => `contact ${candidate.name}`);
  } else {
    const missingText = source.segments.map(segment => fidelityText(segment.text)).filter(Boolean)
      .filter(text => !targetText.includes(text)).map((text, index) => `text block ${index + 1}: ${text.slice(0, 80)}`);
    const sourceImages = source.segments.filter(segment => segment.image).map(segment => segment.image.src);
    const allowedTargetImages = new Set(sourceImages.map(imageSource => imageMappings.get(imageSource) || imageSource));
    const missingImages = sourceImages
      .filter(imageSource => !targetImages.has(imageMappings.get(imageSource) || imageSource)).map(imageSource => `image: ${imageSource}`);
    const nonSourceImages = [...targetImages].filter(imageSource => !allowedTargetImages.has(imageSource)).map(imageSource => `non-source image: ${imageSource}`);
    return [...missingText, ...missingImages, ...nonSourceImages];
  }
}

function assertSourceSiteResponding(ctx: Ctx): void {
  if (ctx.sourceSiteStopped) {
    throw ctx.sourceSiteStopped;
  }
}

function assertSourceFidelity(ctx: Ctx, source: ScrapedPage, target: PageContent): void {
  assertSourceSiteResponding(ctx);
  if (ctx.config.requireSourceFidelity) {
    const gaps = sourceFidelityGaps(source, target, ctx.imageMappings);
    if (gaps.length > 0) {
      throw new Error(`Source fidelity validation failed for ${source.path}: ${gaps.join("; ")}`);
    }
  }
}

function isExcludedImage(ctx: Ctx, url: string): boolean {
  return excludedImage(url, ctx.config.excludeImageUrls);
}

export function excludedImage(url: string, excludeImageUrls: string[] | string): boolean {
  const excludes = exclusions.coerceList(excludeImageUrls).map(u => u.toLowerCase());
  const u = url.toLowerCase();
  try {
    const parsed = new URL(u);
    const pathOnly = parsed.pathname + (parsed.search || "");
    return excludes.some(ex => {
      const e = ex.trim();
      if (!e) return false;
      const el = e.toLowerCase();
      if (u === el) return true;
      if (u.endsWith(el)) return true;
      if (el.startsWith("/")) return pathOnly.endsWith(el);
      if (!el.includes("://") && el.indexOf("/") === -1) {
        return pathOnly.toLowerCase().endsWith(`/${el}`);
      }
      return false;
    });
  } catch (error) {
    return excludes.some(ex => u === ex || u.endsWith(ex));
  }
}

async function scrapePageLinks(ctx: Ctx): Promise<PageLink[]> {
  debugLog(`✅ Scraping page links from ${ctx.config.baseUrl}`);
  const page = await createPage(ctx);
  try {
    const response = await page.goto(ctx.config.baseUrl, {waitUntil: "networkidle", timeout: 30000});
    if (response && !response.ok()) {
      debugLog(`❌ Failed to load ${ctx.config.baseUrl}: Status ${response.status()}`);
      return [];
    }
    const pageLinks: PageLink[] = await page.evaluate(({baseUrl, menuSelector}: {baseUrl: string; menuSelector: string}): PageLink[] => {
      const links = Array.from(document.querySelectorAll(menuSelector))
        .filter((a): a is HTMLAnchorElement => a instanceof HTMLAnchorElement && a.href.startsWith(baseUrl))
        .map((a) => ({path: a.href, title: a.textContent!.trim()}));
      return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
    }, {baseUrl: ctx.config.baseUrl, menuSelector: ctx.config.menuSelector});
    if (!pageLinks.some(link => link.path === ctx.config.baseUrl)) {
      pageLinks.unshift({path: ctx.config.baseUrl, title: "Home"});
    }
    debugLog(`✅ Scraped ${pluraliseWithCount(pageLinks.length, "page link")}:`, pageLinks);
    return pageLinks;
  } catch (error) {
    debugLog(`❌ Error scraping page links:`, error);
    return [];
  } finally {
    await page.close();
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function imageMarkers(img: ScrapedImage): string[] {
  const url = new URL(img.src);
  return [
    `![${img.alt}](${img.src})`,
    `![${img.alt}](${url.pathname})`,
    `![${img.alt}](${url.pathname.split("/").pop()})`
  ];
}

function imageMarkerIn(text: string, img: ScrapedImage): string | null {
  return imageMarkers(img).reduce((found: string | null, marker) => {
    if (found) {
      return found;
    } else {
      const linked = text.match(new RegExp(`\\[${escapeRegex(marker)}\\]\\([^)]*\\)`));
      return linked ? linked[0] : text.includes(marker) ? marker : null;
    }
  }, null);
}

export function markdownSegments(markdown: string, images: ScrapedImage[]): ScrapedSegment[] {
  const state = images.reduce((current, img) => {
    const marker = imageMarkerIn(current.remainingText, img);
    if (marker) {
      const [before, ...after] = current.remainingText.split(marker);
      return {
        segments: [...current.segments, ...(before.trim() ? [{text: before.trim()}] : []), {text: img.alt || "", image: img}],
        matched: [...current.matched, img],
        remainingText: after.join(marker)
      };
    } else {
      debugLog(`⚠️ No image marker found for ${img.src}`);
      return current;
    }
  }, {segments: [] as ScrapedSegment[], matched: [] as ScrapedImage[], remainingText: markdown});
  return [
    ...state.segments,
    ...(state.remainingText.trim() ? [{text: state.remainingText.trim()}] : []),
    ...images.filter(image => !state.matched.includes(image)).map(image => ({text: image.alt || "", image}))
  ];
}

async function scrapePageContent(ctx: Ctx, pageLink: PageLink): Promise<ScrapedPage> {
  const page = await createPage(ctx);
  try {
    debugLog(`✅ Scraping ${pageLink.path}`);
    const response = await page.goto(pageLink.path, {waitUntil: "networkidle", timeout: 30000});
    if (response && !response.ok()) {
      debugLog(`❌ Failed to load ${pageLink.path}: Status ${response.status()}`);
      return {path: pageLink.path, title: pageLink.title, segments: []};
    }
    const {
      html,
      images
    } = await page.evaluate(({contentSelector, excludeSelectors}: {contentSelector: string; excludeSelectors: string[]}): {html: string; images: ScrapedImage[]} => {
      const node = document.querySelector(contentSelector) || document.body;
      // eslint-disable-next-line no-restricted-syntax -- page.evaluate runs in the browser; es-toolkit is not available
      const selectors = Array.isArray(excludeSelectors) ? excludeSelectors : [];
      selectors.forEach(sel => {
        try {
          node.querySelectorAll(sel).forEach(n => n.remove());
        } catch (e) {
          console.warn("Invalid selector:", sel, e);
        }
      });
      Array.from(node.querySelectorAll("img")).forEach(img => {
        const src = img.getAttribute("src");
        if (src) img.setAttribute("src", new URL(src, location.href).href);
      });
      Array.from(node.querySelectorAll("select")).forEach(select => {
        const values = Array.from(select.querySelectorAll("option")).map(option => (option.textContent || "").trim()).filter(Boolean);
        const list = document.createElement("ul");
        values.forEach(value => {
          const item = document.createElement("li");
          item.textContent = value;
          list.appendChild(item);
        });
        select.replaceWith(list);
      });
      Array.from(node.querySelectorAll("input, button, textarea")).forEach(element => element.remove());
      const html = node.innerHTML;
      const fromImg = Array.from(node.querySelectorAll("img, input[type=image]")).map(img => ({
        src: (img as HTMLImageElement).src || new URL(img.getAttribute("src") || "", location.href).href,
        alt: (img as HTMLImageElement).alt || img.getAttribute("alt") || ""
      }));
      const fromBackground = Array.from(node.querySelectorAll("[background]")).map(element => ({
        src: new URL(element.getAttribute("background") || "", location.href).href,
        alt: ""
      }));
      const images = [...fromImg, ...fromBackground].filter(image => image.src && !image.src.startsWith("data:"));
      return {html, images};
    }, {contentSelector: ctx.config.contentSelector, excludeSelectors: exclusions.coerceList(ctx.config.excludeSelectors)});
    let markdown = htmlToMarkdown(html, pageLink.path);
    markdown = exclusions.applyTextExclusions(markdown, {
      excludeTextPatterns: ctx.config.excludeTextPatterns,
      excludeMarkdownBlocks: ctx.config.excludeMarkdownBlocks,
      excludeImageUrls: ctx.config.excludeImageUrls
    });
    const segments = markdownSegments(markdown, images.filter(image => !isExcludedImage(ctx, image.src)));
    debugLog(`✅ Created ${pluraliseWithCount(segments.length, "segment")} for ${pageLink.path}`);
    debugLog(`   First segment preview:`, segments[0] ? {
      hasText: !!segments[0].text,
      hasImage: !!segments[0].image,
      textPreview: segments[0].text ? segments[0].text.substring(0, 100) : null,
      imageSrc: segments[0].image ? segments[0].image.src : null
    } : "no segments");
    const firstImage = (images || []).find(img => !isExcludedImage(ctx, img.src)) || images?.[0];
    return {path: pageLink.path, title: pageLink.title, segments, firstImage};
  } catch (error) {
    debugLog(`❌ Error scraping ${pageLink.path}:`, error);
    progress(`Error scraping ${pageLink.path}: ${error?.message || error}`);
    return {path: pageLink.path, title: pageLink.title, segments: [], firstImage: undefined};
  } finally {
    await page.close();
  }
}

async function scrapeAllPages(ctx: Ctx): Promise<ScrapedPage[]> {
  const pageLinks = await scrapePageLinks(ctx);
  const scrapedPages: ScrapedPage[] = [];
  for (const pageLink of pageLinks) {
    scrapedPages.push(await scrapePageContent(ctx, pageLink));
  }
  return scrapedPages;
}

async function uploadImageToS3(ctx: Ctx, img: ScrapedImage): Promise<string | null> {
  ctx.imageMappings.set(img.src, img.src);
  return img.src;
}

async function createPageContentWithNestedRows(ctx: Ctx, content: ScrapedPage, contentTextItems: ContentText[]): Promise<PageContent> {
  const pagePath = toContentPath(content.path);
  const nestedRows: PageContentRow[] = [];
  let textCount = 0;
  let imageCount = 0;
  let lastRowHasText = false;
  let lastRowIsHeading = false;
  let pendingImageSource: {src: string, alt: string} = null;
  if (content.segments) {
    for (const segment of content.segments) {
      if (segment.text && !segment.image) {
        const markdown = exclusions.cleanMarkdown(segment.text);
        textCount++;
        const isHeading = /^\s*#+\s+/.test(markdown);
        if (pendingImageSource) {
          nestedRows.push({
            type: PageContentType.TEXT, maxColumns: 2, showSwiper: false,
            columns: [{columns: 9, contentText: markdown}, {
              columns: 3,
              imageSource: pendingImageSource.src,
              alt: pendingImageSource.alt,
              imageBorderRadius: 6
            }]
          });
          pendingImageSource = null;
        } else {
          nestedRows.push({
            type: PageContentType.TEXT, maxColumns: 1, showSwiper: false,
            columns: [{columns: 12, contentText: markdown}]
          });
        }
        lastRowHasText = true;
        lastRowIsHeading = isHeading;
      } else if (segment.image) {
        const imageSource = await uploadImageToS3(ctx, segment.image);
        if (imageSource) {
          const imageAlt = segment.image.alt || segment.text || "Image";
          imageCount++;
          if (lastRowHasText && !lastRowIsHeading && !pendingImageSource) {
            const prev = nestedRows[nestedRows.length - 1];
            prev.maxColumns = 2;
            prev.columns = [prev.columns[0], {columns: 3, imageSource, alt: imageAlt, imageBorderRadius: 6}];
          } else {
            pendingImageSource = {src: imageSource, alt: imageAlt};
          }
        }
      }
    }
  }
  const pageContent: PageContent = {
    path: pagePath || "home",
    rows: nestedRows
  };
  assertSourceFidelity(ctx, content, pageContent);
  if (ctx.config.persistData) {
    const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pagePath}, pageContent);
    progress(`Page migrated: ${pagePath || "home"} with ${pluraliseWithCount(textCount, "text block")} and ${pluraliseWithCount(imageCount, "image")}`);
    return saved;
  }
  progress(`Page prepared (dry run): ${pagePath || "home"} with ${pluraliseWithCount(textCount, "text block")} and ${pluraliseWithCount(imageCount, "image")}`);
  return pageContent;
}

async function createPageContent(ctx: Ctx, content: ScrapedPage, contentTextItems: ContentText[]): Promise<PageContent> {
  const pagePath = toContentPath(content.path);
  const pageContentRows: PageContentRow[] = [];
  let textCount = 0;
  let imageCount = 0;
  let lastRowHasText = false;
  let lastRowIsHeading = false;
  let pendingImageSource: {src: string, alt: string} = null;
  if (content.segments) {
    for (const segment of content.segments) {
      if (segment.text && !segment.image) {
        const markdown = exclusions.cleanMarkdown(segment.text);
        textCount++;
        const isHeading = /^\s*#+\s+/.test(markdown);
        if (pendingImageSource) {
          pageContentRows.push({
            type: PageContentType.TEXT,
            maxColumns: 2,
            showSwiper: false,
            columns: [{columns: 9, contentText: markdown}, {
              columns: 3,
              imageSource: pendingImageSource.src,
              alt: pendingImageSource.alt,
              imageBorderRadius: 6
            }]
          });
          pendingImageSource = null;
        } else {
          pageContentRows.push({
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [{columns: 12, contentText: markdown}]
          });
        }
        lastRowHasText = true;
        lastRowIsHeading = isHeading;
      } else if (segment.image) {
        const imageSource = await uploadImageToS3(ctx, segment.image);
        const imageAlt = segment.image.alt || segment.text || "Image";
        if (segment.text) {
          const markdown = exclusions.cleanMarkdown(segment.text);
          textCount++;
          imageCount++;
          pageContentRows.push({
            type: PageContentType.TEXT,
            maxColumns: 2,
            showSwiper: false,
            columns: [{columns: 9, contentText: markdown}, {columns: 3, imageSource, alt: imageAlt, imageBorderRadius: 6}]
          });
        } else {
          imageCount++;
          if (lastRowHasText && !lastRowIsHeading && !pendingImageSource) {
            const prev = pageContentRows[pageContentRows.length - 1];
            prev.maxColumns = 2;
            prev.columns = [prev.columns[0], {columns: 3, imageSource, alt: imageAlt, imageBorderRadius: 6}];
          } else {
            pendingImageSource = {src: imageSource, alt: imageAlt};
          }
        }
      }
    }
  }
  const pageContent: PageContent = {path: pagePath || "home", rows: pageContentRows};
  assertSourceFidelity(ctx, content, pageContent);
  if (ctx.config.persistData) {
    const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pagePath || "home"}, pageContent);
    progress(`Page migrated: ${pagePath || "home"} with ${pluraliseWithCount(textCount, "text block")} and ${pluraliseWithCount(imageCount, "image")}`);
    return saved;
  }
  progress(`Page prepared (dry run): ${pagePath || "home"} with ${pluraliseWithCount(textCount, "text block")} and ${pluraliseWithCount(imageCount, "image")}`);
  return pageContent;
}

function migratedAlbumCarousel(name: string, title: string, introductoryText: string, showPreAlbumText: boolean, albumView: AlbumView = AlbumView.GALLERY): AlbumData {
  return {
    name,
    createdAt: null,
    createdBy: null,
    eventType: "walks",
    title,
    subtitle: `Photos from ${titleCase(title)}`,
    showTitle: true,
    introductoryText,
    coverImageHeight: 400,
    coverImageVerticalPosition: 50,
    coverImageBorderRadius: 6,
    showCoverImageAndText: false,
    showPreAlbumText,
    preAlbumText: null,
    albumView,
    gridViewOptions: {showTitles: true, showDates: true},
    galleryViewOptions: {
      thumbPosition: "left",
      imageSize: "cover",
      thumbImageSize: "cover",
      loadingStrategy: "lazy",
      dotsPosition: "bottom"
    },
    allowSwitchView: false,
    showStoryNavigator: true,
    showIndicators: true,
    slideInterval: 5000,
    height: albumView === AlbumView.CAROUSEL ? MIGRATED_CAROUSEL_HEIGHT : null,
    eventId: null,
    eventDate: null
  } as AlbumData;
}

export function albumFrom(title: string): string {
  const date = galleryDateFrom(title);
  const year = date ? String(date.year) : "unknown-year";
  const month = date?.month ? fullMonthName(date.month) : "unknown-month";
  const baseName = toKebabCase(title.replace(/\b\d{4}\b/g, "").replace(MONTH_NAME_PATTERN, "").trim());
  let name = "gallery";
  if (year === "unknown-year" && month === "unknown-month") name += `/${baseName}`;
  else if (year === "unknown-year") name += `/${month}/${baseName}`;
  else if (month === "unknown-month") name += `/${year}/${baseName}`;
  else name += `/${year}/${month}/${baseName}`;
  debugLog("albumFrom:", title, "albumName:", name);
  return name;
}

export async function discoverPhotoClusters(ctx: Ctx, pageUrl: string, pageTitle: string): Promise<{title: string; images: ScrapedImage[]}[]> {
  const page = await createPage(ctx);
  try {
    const response = await page.goto(pageUrl, {waitUntil: "domcontentloaded", timeout: 30000});
    if (!response || response.ok()) {
    return await page.evaluate(({contentSelector}: {contentSelector: string}): {title: string; images: ScrapedImage[]}[] => {
      const root = document.querySelector(contentSelector) || document.body;
      const chrome = /previous|pause|next|play|logo|icon|btn|button|spacer|bullet|nav/i;
      const photoSrc = (src: string) => /\.(jpe?g|png|webp)(\?|$)/i.test(src) && !chrome.test(src.split("/").pop() || "");
      const clusters = Array.from(root.querySelectorAll("*")).map(node => {
        const images = Array.from(node.querySelectorAll("img")).map(img => ({
          src: (img as HTMLImageElement).src,
          alt: (img as HTMLImageElement).alt || ""
        })).filter(image => image.src && photoSrc(image.src));
        return {node, images};
      }).filter(cluster => cluster.images.length >= 3);
      const nested = new Set(clusters.flatMap(cluster => clusters.filter(other => other !== cluster && cluster.node.contains(other.node)).map(other => other.node)));
      return clusters.filter(cluster => !nested.has(cluster.node)).map((cluster, index) => ({
        title: index === 0 ? "Photos" : `Photos ${index + 1}`,
        images: cluster.images.filter((image, imageIndex, list) => list.findIndex(item => item.src === image.src) === imageIndex)
      }));
    }, {contentSelector: ctx.config.contentSelector}).then(clusters => clusters.map(cluster => ({
      title: cluster.title === "Photos" ? `${pageTitle} photos` : cluster.title,
      images: cluster.images
    })));
    } else {
      return [];
    }
  } catch (error) {
    debugLog("discoverPhotoClusters %s: %s", pageUrl, (error as Error).message);
    return [];
  } finally {
    await page.close();
  }
}

async function scrapeGalleryLinks(ctx: Ctx): Promise<PageLink[]> {
  if (ctx.config.galleryPath && ctx.config.gallerySelector && ctx.config.galleryImagePath) {
  const page = await createPage(ctx);
  const pageUrl = `${ctx.config.baseUrl}/${ctx.config.galleryPath}`;
  debugLog(`✅ Scraping gallery index at ${pageUrl}`);
  try {
    const response = await page.goto(pageUrl, {waitUntil: "networkidle", timeout: 30000});
    if (response && !response.ok()) {
      debugLog(`❌ Failed to load ${pageUrl}: Status ${response.status()}`);
      return [];
    }
    const galleryLinks: PageLink[] = await page.evaluate(({gallerySelector, imagePath}: {gallerySelector: string; imagePath: string}): PageLink[] => {
      const links = Array.from(document.querySelectorAll(gallerySelector))
        .filter((a): a is HTMLAnchorElement => a instanceof HTMLAnchorElement && a.href.startsWith(`${location.origin}/${imagePath}/`) && !!a.textContent?.trim())
        .map((a) => ({path: a.href, title: a.textContent!.trim()}));
      return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
    }, {gallerySelector: ctx.config.gallerySelector, imagePath: ctx.config.galleryImagePath});
    debugLog(`✅ Found ${pluraliseWithCount(galleryLinks.length, "gallery link")}:`, galleryLinks);
    progress(`Found ${pluraliseWithCount(galleryLinks.length, "gallery link")}`);
    return galleryLinks;
  } catch (error) {
    debugLog(`❌ Error scraping ${pageUrl}:`, error);
    progress(`Error scraping gallery index at ${pageUrl}`);
    return [];
  } finally {
    await page.close();
  }
  } else {
    return [];
  }
}

async function scrapeAlbum(ctx: Ctx, albumLink: PageLink): Promise<MigratedAlbum> {
  const page = await createPage(ctx);
  debugLog(`✅ Scraping gallery ${albumLink.path}`);
  try {
    const response = await page.goto(albumLink.path, {waitUntil: "networkidle", timeout: 60000});
    if (response && !response.ok()) {
      debugLog(`❌ Failed to load ${albumLink.path}: Status ${response.status()}`);
      return null;
    }
    const images: ScrapedImage[] = await page.evaluate((contentSelector: string): ScrapedImage[] => {
      const contentNode = document.querySelector(contentSelector) || document.body;
      const imageNodes = contentNode.querySelectorAll("img");
      return Array.from(imageNodes).map((img) => ({
        src: img.src,
        alt: img.alt
      })).filter(item => item.alt !== "logo");
    }, ctx.config.contentSelector);
    const files = images.map((img, index) => ({
      image: decodeURIComponent(img.src),
      originalFileName: decodeURIComponent(img.src.split("/").pop() || `image-${index + 1}.jpg`),
      text: (() => {
        const a = (img.alt || "").trim();
        if (a) return a;
        const base = decodeURIComponent((img.src || "")
          .split("/").pop() || "").replace(/\.[^.]+$/, "");
        return base.replace(/[\-_]+/g, " ").replace(/\s+/g, " ").trim();
      })(),
      tags: []
    }));
    const name = albumFrom(albumLink.title);
    const album: ContentMetadata = {
      rootFolder: RootFolder.siteContent,
      name,
      aspectRatio: null,
      files,
      coverImage: null,
      imageTags: [],
      maxImageSize: 1024
    } as any;
    const pageContent: PageContent = {
      path: name,
      rows: [{
        maxColumns: 1,
        showSwiper: false,
        type: PageContentType.ALBUM,
        columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC}],
        carousel: migratedAlbumCarousel(name, albumLink.title, "To be completed", true)
      }]
    };
    if (ctx.config.persistData) {
      const savedAlbum = await mongooseClient.upsert<ContentMetadata>(contentMetadata, {name}, album);
      const savedPageContent = await mongooseClient.upsert<PageContent>(pageContentModel, {path: name}, pageContent);
      return {album: savedAlbum, pageContent: savedPageContent};
    }
    return {album, pageContent};
  } catch (error) {
    debugLog(`❌ Error scraping ${albumLink.path}:`, error);
    return null;
  } finally {
    await page.close();
  }
}

function albumFileFromSource(img: ScrapedImage, index: number, image: string) {
  return {
    image,
    originalFileName: decodeURIComponent(img.src.split("/").pop() || `image-${index + 1}.jpg`),
    text: (img.alt || "").trim() || humaniseFileStemFromUrl(img.src),
    tags: []
  };
}

async function albumFromImages(ctx: Ctx, title: string, images: ScrapedImage[], albumView: AlbumView = AlbumView.GALLERY): Promise<MigratedAlbum | null> {
  const files = ctx.config.uploadTos3
    ? (await Promise.all(images.map(async (img, index) => {
      const uploaded = await uploadImageToS3(ctx, img);
      return uploaded ? albumFileFromSource(img, index, uploaded) : null;
    }))).filter(Boolean)
    : images.map((img, index) => albumFileFromSource(img, index, img.src));
  if (files.length) {
  const name = albumFrom(title);
  const album: ContentMetadata = {
    rootFolder: RootFolder.siteContent,
    name,
    aspectRatio: null,
    files,
    coverImage: null,
    imageTags: [],
    maxImageSize: 1024
  } as any;
  const pageContent: PageContent = {
    path: name,
    rows: [{
      maxColumns: 1,
      showSwiper: false,
      type: PageContentType.ALBUM,
      columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC}],
      carousel: migratedAlbumCarousel(name, title, "", false, albumView)
    }]
  };
  if (ctx.config.persistData) {
    const savedAlbum = await mongooseClient.upsert<ContentMetadata>(contentMetadata, {name}, album);
    const savedPageContent = await mongooseClient.upsert<PageContent>(pageContentModel, {path: name}, pageContent);
    return {album: savedAlbum, pageContent: savedPageContent};
  } else {
    return {album, pageContent};
  }
  } else {
    return null;
  }
}

function meaningfulText(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text || "");
}

export function pageImageRuns(page: PageContent, minimumImages = MIN_IMAGES_FOR_PAGE_ALBUM): {rows: PageContentRow[]; images: ScrapedImage[]} {
  const imageOnly = (row: PageContentRow) => (row.columns || []).length > 0
    && (row.columns || []).every(column => !!column.imageSource && !meaningfulText(column.contentText) && !column.rows?.length);
  const imagesOf = (rows: PageContentRow[]) => rows.flatMap(row => (row.columns || []).map(column => ({src: column.imageSource, alt: column.alt && column.alt !== "Image" ? column.alt : ""})));
  const nestedImageRows = (row: PageContentRow) => (row.columns || []).length > 0
    && (row.columns || []).every(column => !meaningfulText(column.contentText) && !column.imageSource && (column.rows || []).length > 0 && column.rows.every(imageOnly))
    ? (row.columns || []).flatMap(column => column.rows)
    : [];
  const runs = (page.rows || []).reduce((found, row) => {
    const nestedImages = imagesOf(nestedImageRows(row));
    if (nestedImages.length >= minimumImages) {
      return {rows: found.rows, images: [...found.images, ...nestedImages]};
    } else {
      return {rows: [...found.rows, row], images: found.images};
    }
  }, {rows: [] as PageContentRow[], images: [] as ScrapedImage[]});
  const albumSources = runs.images.map(image => image.src);
  const withoutAlbumImages = (rows: PageContentRow[]): PageContentRow[] => rows.map(row => ({
    ...row,
    columns: (row.columns || []).map(column => ({
      ...column,
      contentText: column.contentText ? exclusions.collapseExcessBlankLines(exclusions.removeExcludedImages(column.contentText, albumSources)).trim() : column.contentText,
      rows: column.rows ? withoutAlbumImages(column.rows) : column.rows
    }))
  }));
  return {rows: albumSources.length ? withoutAlbumImages(runs.rows) : runs.rows, images: runs.images};
}

export function homePage(page: PageContent): boolean {
  return ["home", "index", "#home-content"].includes(page.path || "home");
}

export function withoutRepeatedBlocks(pageContents: PageContent[]): PageContent[] {
  const blockKey = (block: string) => block.replace(/\s+/g, " ").trim().toLowerCase();
  const blocksOf = (page: PageContent) => new Set((page.rows || []).flatMap(row => (row.columns || []).flatMap(column => (column.contentText || "").split(/\n\s*\n/).map(blockKey).filter(block => block.length > 0))));
  const threshold = Math.max(MIN_PAGES_FOR_REPEATED_BLOCK, Math.ceil(pageContents.length * REPEATED_BLOCK_PAGE_SHARE));
  const counts = pageContents.reduce((found, page) => {
    blocksOf(page).forEach(block => found.set(block, (found.get(block) || 0) + 1));
    return found;
  }, new Map<string, number>());
  const homeBlocks = new Set(pageContents.filter(homePage).flatMap(page => [...blocksOf(page)]));
  const repeated = new Set([...counts.entries()].filter(([block, count]) => count >= threshold || (homeBlocks.has(block) && count >= MIN_PAGES_FOR_REPEATED_BLOCK)).map(([block]) => block));
  const cleanText = (text: string) => text.split(/\n\s*\n/).filter(block => !repeated.has(blockKey(block))).join("\n\n").trim();
  return repeated.size === 0 ? pageContents : pageContents.map(page => ({
    ...page,
    rows: (page.rows || []).map(row => ({
      ...row,
      columns: (row.columns || []).map(column => column.contentText ? {...column, contentText: cleanText(column.contentText)} : column)
    }))
  }));
}

async function pageAlbums(ctx: Ctx, pageContents: PageContent[]): Promise<{pages: PageContent[]; albums: MigratedAlbum[]}> {
  return pageContents.reduce(async (previous, page) => {
    const collected = await previous;
    const home = homePage(page);
    const gallery = (ctx.config.galleryPathPrefixes || []).some(prefix => (page.path || "").startsWith(prefix));
    const runs = pageImageRuns(page, home ? MIN_IMAGES_FOR_HOME_CAROUSEL : gallery ? MIN_IMAGES_FOR_GALLERY_ALBUM : MIN_IMAGES_FOR_PAGE_ALBUM);
    if (runs.images.length === 0) {
      return {pages: [...collected.pages, page], albums: collected.albums};
    } else {
      const title = `${titleCase((page.path || "home").split("/").pop().replace(/-/g, " "))} photos`;
      const album = await albumFromImages(ctx, title, runs.images, home ? AlbumView.CAROUSEL : AlbumView.GALLERY);
      if (album) {
        progress(`Collected ${pluraliseWithCount(runs.images.length, "photo")} from ${page.path} into the album ${title}`);
        return {pages: [...collected.pages, {...page, rows: runs.rows}], albums: [...collected.albums, {...album, sourcePagePath: page.path, sourceImageUrls: runs.images.map(image => image.src)}]};
      } else {
        return {pages: [...collected.pages, page], albums: collected.albums};
      }
    }
  }, Promise.resolve({pages: [] as PageContent[], albums: [] as MigratedAlbum[]}));
}

export function flickrAlbumLinks(pageContents: PageContent[]): FlickrAlbumLink[] {
  const galleryPage = (page: PageContent) => /photo|gallery|album/i.test(page.path || "") ? 0 : 1;
  return [...pageContents].sort((left, right) => galleryPage(left) - galleryPage(right))
    .flatMap(page => [...flickrAlbumUrlsIn(JSON.stringify(page.rows || [])), ...flickrUserAlbumsUrlsIn(JSON.stringify(page.rows || []))]
      .map(url => ({url, pagePath: page.path})))
    .filter((link, index, links) => {
      const albumId = flickrProvider.parseAlbumUrl(link.url)?.albumId || parseUserAlbumsUrl(link.url) || link.url;
      return links.findIndex(item => (flickrProvider.parseAlbumUrl(item.url)?.albumId || parseUserAlbumsUrl(item.url) || item.url) === albumId) === index;
    });
}

export function flickrGroupLinks(pageContents: PageContent[]): FlickrGroupLink[] {
  const galleryPage = (page: PageContent) => /photo|gallery|album/i.test(page.path || "") ? 0 : 1;
  return [...pageContents].sort((left, right) => galleryPage(left) - galleryPage(right))
    .flatMap(page => flickrGroupNamesIn(JSON.stringify(page.rows || [])).map(groupName => ({groupName, pagePath: page.path})))
    .filter((link, index, links) => links.findIndex(item => item.groupName === link.groupName) === index);
}

export function repeatsAnAlbum(images: ScrapedImage[], albums: MigratedAlbum[]): boolean {
  const collected = new Set(albums.flatMap(album => album.sourceImageUrls || []));
  const repeated = images.filter(image => collected.has(image.src)).length;
  return images.length > 0 && repeated * 2 >= images.length;
}

async function addImportedFlickrAlbum(ctx: Ctx, metadata: ExternalAlbumMetadata, pagePath: string, albums: MigratedAlbum[]): Promise<void> {
  const title = metadata.title || "Flickr album";
  const images = metadata.photos.map(photo => ({src: photo.url, alt: photo.title || ""}));
  if (images.length && !repeatsAnAlbum(images, albums)) {
    const request = {
      source: ExternalAlbumSource.FLICKR,
      albumUrl: metadata.id,
      targetPath: albumFrom(title),
      albumTitle: title
    };
    const documents = externalAlbumDocuments(request, metadata, "site-migration");
    const saved = ctx.config.persistData
      ? await importExternalAlbum(request, metadata, "site-migration")
      : {success: true, errorMessage: ""};
    if (saved.success) {
      albums.push({album: documents.metadata, pageContent: documents.page, sourcePagePath: pagePath, sourceImageUrls: images.map(image => image.src)});
      progress(`Completed album ${title} with ${pluraliseWithCount(images.length, "photo")} from Flickr`);
    } else {
      progress(`Skipped the Flickr album ${title}: ${saved.errorMessage}`);
    }
  }
}

async function albumFromFlickr(ctx: Ctx, url: string, pagePath: string, albums: MigratedAlbum[]): Promise<void> {
  const parsed = flickrProvider.parseAlbumUrl(url);
  if (parsed) {
    progress(`Fetching the Flickr album ${parsed.albumId || url}`);
    const metadata = await flickrProvider.fetchAlbumMetadata({}, parsed, message => progress(message)).catch(error => {
      progress(`Skipped the Flickr album ${url}: ${(error as Error).message}`);
      return null;
    });
    if (metadata) {
      await addImportedFlickrAlbum(ctx, metadata, pagePath, albums);
    }
  } else {
    const userId = parseUserAlbumsUrl(url);
    if (userId) {
      progress(`Fetching Flickr albums for ${userId}`);
      const listed = await fetchUserAlbums({}, userId).catch(error => {
        progress(`Skipped Flickr albums for ${userId}: ${(error as Error).message}`);
        return null;
      });
      const discovered = listed?.albums || [];
      const owner = listed?.userId || userId;
      await discovered.reduce(async (previous, summary) => {
        await previous;
        await albumFromFlickr(ctx, `https://www.flickr.com/photos/${owner}/albums/${summary.id}`, pagePath, albums);
      }, Promise.resolve());
    }
  }
}

async function migrateAlbums(ctx: Ctx, flickrGroups: FlickrGroupLink[] = [], flickrAlbums: FlickrAlbumLink[] = [], pageAlbumsCollected: MigratedAlbum[] = []): Promise<MigratedAlbum[]> {
  const rawLinks = ctx.config.specificAlbums && ctx.config.specificAlbums.length > 0 ? ctx.config.specificAlbums : await scrapeGalleryLinks(ctx);
  const galleryLinks = (rawLinks || []).filter(l => l && isString(l.path) && /^https?:\/\//i.test(l.path));
  const albums: MigratedAlbum[] = [];
  if (galleryLinks.length) {
    progress(`Processing ${pluraliseWithCount(galleryLinks.length, "album")}`);
    await galleryLinks.reduce(async (previous, galleryLink, index) => {
      await previous;
      progress(`Migrating album ${index + 1}/${galleryLinks.length}: ${galleryLink.title}`);
      const album = await scrapeAlbum(ctx, galleryLink);
      if (album) {
        albums.push(album);
        progress(`Completed album ${index + 1}/${galleryLinks.length}: ${galleryLink.title}`);
      } else {
        progress(`Skipped album ${index + 1}/${galleryLinks.length}: ${galleryLink.title}`);
      }
    }, Promise.resolve());
  }
  const pagesToScan = [
    {path: ctx.config.baseUrl, title: "Home", pagePath: "home"},
    ...(ctx.config.parentPages || []).filter(page => page.url).map(page => ({
      path: page.url.startsWith("http") ? page.url : `${ctx.config.baseUrl}/${page.url}`,
      title: page.pathPrefix || "Photos",
      pagePath: (page.pathPrefix || "").replace(/^\/+|\/+$/g, "") || null
    }))
  ];
  await pagesToScan.reduce(async (previous, pageLink) => {
    await previous;
    const clusters = await discoverPhotoClusters(ctx, pageLink.path, pageLink.title);
    await clusters.reduce(async (inner, cluster) => {
      await inner;
      if (repeatsAnAlbum(cluster.images, [...pageAlbumsCollected, ...albums])) {
        progress(`Skipped ${pluraliseWithCount(cluster.images.length, "photo")} on ${pageLink.title}, already collected into its album`);
      } else {
        progress(`Found ${pluraliseWithCount(cluster.images.length, "photo")} on ${pageLink.title}`);
        const album = await albumFromImages(ctx, cluster.title, cluster.images);
        if (album) {
          albums.push({...album, sourcePagePath: pageLink.pagePath || undefined, sourceImageUrls: cluster.images.map(image => image.src)});
          progress(`Completed album ${cluster.title}`);
        }
      }
    }, Promise.resolve());
  }, Promise.resolve());
  await flickrGroups.reduce(async (previous, {groupName, pagePath}) => {
    await previous;
    progress(`Fetching photos from the Flickr group ${groupName}`);
    const pool = await fetchFlickrGroupPool(groupName).catch(error => {
      progress(`Skipped the Flickr group ${groupName}: ${(error as Error).message}`);
      return {title: "", photos: [] as ScrapedImage[]};
    });
    if (pool.photos.length) {
      await addImportedFlickrAlbum(ctx, flickrGroupAsAlbum(groupName, pool), pagePath, albums);
    }
  }, Promise.resolve());
  await flickrAlbums.reduce(async (previous, link) => {
    await previous;
    await albumFromFlickr(ctx, link.url, link.pagePath, albums);
  }, Promise.resolve());
  if (!albums.length) {
    progress("No photo albums were found on the source pages");
  }
  return albums;
}

async function scrapeParentPageLinks(ctx: Ctx, parentPageConfig: ParentPageConfig): Promise<PageLink[]> {
  const page = await createPage(ctx);
  const parentUrl = parentPageConfig.url.startsWith("http") ? parentPageConfig.url : `${ctx.config.baseUrl}/${parentPageConfig.url}`;
  debugLog(`✅ Scraping parent page links from ${parentUrl}`);
  progress(`Scraping parent page links from ${parentUrl}`);
  try {
    const response = await page.goto(parentUrl, {waitUntil: "networkidle", timeout: 30000});
    if (response && !response.ok()) {
      debugLog(`❌ Failed to load ${parentUrl}: Status ${response.status()}`);
      progress(`Failed to load ${parentUrl}: Status ${response.status()}`);
      return [];
    }
    const linkSelector = parentPageConfig.linkSelector?.trim() || null;
    const baseUrl = ctx.config.baseUrl;
    const pathPrefix = (parentPageConfig.pathPrefix || "").replace(/^\/+|\/+$/g, "");
    const contentSelector = ctx.config.contentSelector;
    const parentPathPrefix = new URL(parentUrl).pathname.replace(/\/index\.[a-zA-Z0-9]+$/, "").replace(/^\/+|\/+$/g, "");
    const childLinks: PageLink[] = await page.evaluate(
      ({selector, base, prefix, contentSelectorString, parentPath}: {selector: string | null; base: string; prefix: string; contentSelectorString: string; parentPath: string}): PageLink[] => {
        const collectedAnchors: Element[] = [];
        if (selector && selector.length > 0) {
          collectedAnchors.push(...Array.from(document.querySelectorAll(selector)));
        } else {
          const containers = contentSelectorString ? Array.from(document.querySelectorAll(contentSelectorString)) : [document.body];
          containers.forEach(container => collectedAnchors.push(...Array.from(container.querySelectorAll("a"))));
        }
        let anchors: HTMLAnchorElement[] = collectedAnchors.filter((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement);
        if (anchors.length === 0 && parentPath) {
          anchors = Array.from(document.querySelectorAll("a")).filter((a): a is HTMLAnchorElement => a instanceof HTMLAnchorElement && a.href.startsWith(location.origin) && new URL(a.href).pathname.startsWith(`/${parentPath}`));
        }
        const unique = new Map<string, { path: string; title: string; contentPath: string }>();
        anchors.forEach(element => {
          const href = element.href;
          const text = element.textContent ? element.textContent.trim() : "";
          if (!href || !text) return;
          if (!href.startsWith(base)) return;
          if (href.includes("#")) return;
          const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          if (!slug) return;
          const contentPath = prefix ? `${prefix}/${slug}` : slug;
          const key = `${href}|${contentPath}`;
          if (!unique.has(key)) unique.set(key, {path: href, title: text, contentPath});
        });
        return Array.from(unique.values());
      },
      {selector: linkSelector, base: baseUrl, prefix: pathPrefix, contentSelectorString: contentSelector, parentPath: parentPathPrefix}
    );
    debugLog(`✅ Scraped ${pluraliseWithCount(childLinks.length, "child link")} from ${parentUrl}:`, childLinks);
    if (childLinks.length === 0) progress(`No child links found at ${parentUrl}`);
    else progress(`Found ${pluraliseWithCount(childLinks.length, "child link")} at ${parentUrl}`);
    return childLinks;
  } catch (error) {
    debugLog(`❌ Error scraping parent page links:`, error);
    progress(`Error scraping parent page links at ${parentUrl}`);
    return [];
  } finally {
    await page.close();
  }
}

async function migrateUsingTemplate(
  ctx: Ctx,
  scrapedPage: ScrapedPage,
  template: PageContent,
  pagePath: string,
  pageTitle: string
): Promise<PageContent> {
  const engine = new PageTransformationEngine();
  const transformedPage = await engine.transformWithTemplate(scrapedPage, template, (img: ScrapedImage) => uploadImageToS3(ctx, img));
  transformedPage.path = pagePath;
  assertSourceFidelity(ctx, scrapedPage, transformedPage);
  const templateLabel = template.path || template.migrationTemplate?.templateName || "template";
  if (ctx.config.persistData) {
    const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pagePath}, pageContentToPersist(transformedPage));
    progress(`✅ Migrated ${pageTitle} to [${pagePath}](${pagePath}) using template ${templateLabel}`);
    return saved;
  } else {
    progress(`✅ Migrated ${pageTitle} to [${pagePath}](${pagePath}) (dry run) using template ${templateLabel}`);
    return transformedPage;
  }
}

async function migrateUsingTransformation(
  ctx: Ctx,
  scrapedPage: ScrapedPage,
  pageTransformationConfig: any,
  pagePath: string,
  pageTitle: string
): Promise<PageContent> {
  debugLog(`✅ Using page transformation: ${pageTransformationConfig.name}`);
  const engine = new PageTransformationEngine();
  const transformedPage = await engine.transform(scrapedPage, pageTransformationConfig, (img: ScrapedImage) => uploadImageToS3(ctx, img));
  transformedPage.path = pagePath;
  assertSourceFidelity(ctx, scrapedPage, transformedPage);
  if (ctx.config.persistData) {
    const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pagePath}, pageContentToPersist(transformedPage));
    progress(`✅ Migrated ${pageTitle} to [${pagePath}](${pagePath}) using transformation: ${pageTransformationConfig.name}`);
    return saved;
  } else {
    progress(`✅ Migrated ${pageTitle} to [${pagePath}](${pagePath}) (dry run) using transformation: ${pageTransformationConfig.name}`);
    return transformedPage;
  }
}

async function migrateChildPage(
  ctx: Ctx,
  childLink: PageLink,
  pageTransformationConfig?: any,
  template?: PageContent
): Promise<PageContent> {
  const scrapedPage = await scrapePageContent(ctx, childLink);
  if (!scrapedPage.segments || scrapedPage.segments.length === 0) {
    debugLog(`⚠️ No content found for ${childLink.path}`);
    return null;
  }
  const pagePath = childLink.contentPath || toContentPath(childLink.path);
  if (template) {
    try {
      return await migrateUsingTemplate(ctx, scrapedPage, template, pagePath, childLink.title);
    } catch (error) {
      if (ctx.config.requireSourceFidelity && pageTransformationConfig?.enabled && !isContactUsPage({path: pagePath, rows: []}) &&
        (error as Error).message.startsWith("Source fidelity validation failed")) {
        progress(`The ${template.path} template missed source content on ${childLink.title}; trying the page transformation`);
        return migrateUsingTransformation(ctx, scrapedPage, pageTransformationConfig, pagePath, childLink.title);
      } else {
        throw error;
      }
    }
  } else if (pageTransformationConfig && pageTransformationConfig.enabled) {
    return migrateUsingTransformation(ctx, scrapedPage, pageTransformationConfig, pagePath, childLink.title);
  } else {
  const pageContentRows: PageContentRow[] = [];
  if (ctx.config.useNestedRows) {
    const nestedRows: PageContentRow[] = [];
    for (const segment of scrapedPage.segments) {
      if (segment.text && !segment.image) {
        nestedRows.push({
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          columns: [{columns: 12, contentText: exclusions.cleanMarkdown(segment.text)}]
        });
      } else if (segment.image) {
        const imageSource = await uploadImageToS3(ctx, segment.image);
        const imageAlt = (() => {
          const a = (segment.image.alt || "").trim() || (segment.text || "").trim();
          return a || humaniseFileStemFromUrl(segment.image.src);
        })();
        nestedRows.push({
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          columns: [{columns: 12, imageSource, alt: imageAlt, imageBorderRadius: 6, imageHeight: MIGRATED_CAROUSEL_HEIGHT}]
        });
      }
    }
    const pageContent: PageContent = {
      path: pagePath,
      rows: nestedRows
    };
    assertSourceFidelity(ctx, scrapedPage, pageContent);
    if (ctx.config.persistData) {
      const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pagePath}, pageContent);
      progress(`✅ Migrated ${childLink.title} to [${pagePath}](${pagePath})`);
      return saved;
    } else {
      progress(`✅ Migrated ${childLink.title} to [${pagePath}](${pagePath}) (dry run)`);
      return pageContent;
    }
  }
  for (const segment of scrapedPage.segments) {
    if (segment.text && !segment.image) {
      pageContentRows.push({
        type: PageContentType.TEXT,
        maxColumns: 1,
        showSwiper: false,
        columns: [{columns: 12, contentText: exclusions.cleanMarkdown(segment.text)}]
      });
    } else if (segment.image) {
      const imageSource = await uploadImageToS3(ctx, segment.image);
      const imageAlt = (() => {
        const a = (segment.image.alt || "").trim() || (segment.text || "").trim();
        return a || humaniseFileStemFromUrl(segment.image.src);
      })();
      if (segment.text) {
        pageContentRows.push({
          type: PageContentType.TEXT,
          maxColumns: 2,
          showSwiper: false,
          columns: [{columns: 9, contentText: exclusions.cleanMarkdown(segment.text)}, {
            columns: 3,
            imageSource,
            alt: imageAlt,
            imageBorderRadius: 6
          }]
        });
      } else {
        pageContentRows.push({
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          columns: [{columns: 12, imageSource, alt: imageAlt, imageBorderRadius: 6, imageHeight: MIGRATED_CAROUSEL_HEIGHT}]
        });
      }
    }
  }
  const pageContent: PageContent = {path: pagePath, rows: pageContentRows};
  assertSourceFidelity(ctx, scrapedPage, pageContent);
  if (ctx.config.persistData) {
    const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pagePath}, pageContent);
    progress(`✅ Migrated ${childLink.title} to ${pagePath}`);
    return saved;
  }
  progress(`✅ Migrated ${childLink.title} to ${pagePath} (dry run)`);
  return pageContent;
  }
}

async function migrateParentPages(ctx: Ctx, contentTextItems: ContentText[]): Promise<PageContent[]> {
  if (!ctx.config.parentPages || ctx.config.parentPages.length === 0) {
    debugLog("⚠️ No parent pages configured");
    return [];
  }
  const pageContents: PageContent[] = [];
  for (const parentPageConfig of ctx.config.parentPages) {
    debugLog(`✅ Processing parent page: ${parentPageConfig.url}`);
    const mode = parentPageConfig.parentPageMode || (parentPageConfig.migrateParent ? ParentPageMode.AS_IS : undefined);
    const transformationConfig = parentPageConfig.pageTransformation || ctx.config.defaultPageTransformation;
    const parentTemplate = await templateForParent(ctx, parentPageConfig);
    if (mode === ParentPageMode.AS_IS) {
      const parentLink: PageLink = {
        path: parentPageConfig.url.startsWith("http") ? parentPageConfig.url : `${ctx.config.baseUrl}/${parentPageConfig.url}`,
        title: parentPageConfig.pathPrefix
      };
      const parentContentPath = (parentPageConfig.pathPrefix || "").replace(/^\/+|\/+$/g, "");
      const parentPageContent = await migrateChildPage(ctx, {
        ...parentLink,
        contentPath: parentContentPath
      }, transformationConfig, parentTemplate);
      if (parentPageContent) pageContents.push(parentPageContent);
    } else if (mode === ParentPageMode.ACTION_BUTTONS) {
      const parentContentPath = (parentPageConfig.pathPrefix || "").replace(/^\/+|\/+$/g, "");
      const allChildLinks = parentPageConfig.selectedChildren ?? await scrapeParentPageLinks(ctx, parentPageConfig);
      const childLinks = parentPageConfig.maxChildren && parentPageConfig.maxChildren > 0
        ? allChildLinks.slice(0, parentPageConfig.maxChildren)
        : allChildLinks;
      if (parentPageConfig.maxChildren && parentPageConfig.maxChildren > 0) {
        debugLog(`✅ Limiting to ${parentPageConfig.maxChildren} child pages`);
        progress(`Limiting to ${pluraliseWithCount(parentPageConfig.maxChildren, "child page")}`);
      }
      const buttons: any[] = [];
      for (const link of childLinks) {
        const cleanedTitle = (link.title || "").replace(/\s+/g, " ").trim();
        const childPath = link.contentPath || toContentPath(link.path);
        const scraped: ScrapedPage = ctx.config.publicHtmlOnly ? {path: link.path, title: cleanedTitle, segments: []} : await scrapePageContent(ctx, link);
        const segments = scraped.segments || [];
        const textSegments = segments.filter(s => s.text && !s.image);
        const nonHeading = textSegments.find(s => !/^\s*#+\s+/.test(exclusions.cleanMarkdown(s.text)));
        const textCandidate = (nonHeading?.text || textSegments[0]?.text || "").trim();
        const firstSentence = exclusions.firstSentenceFrom(textCandidate);
        let firstImage = segments.find(s => s.image && !isExcludedImage(ctx, s.image.src))?.image;
        if (!firstImage && scraped.firstImage && !isExcludedImage(ctx, scraped.firstImage.src)) firstImage = scraped.firstImage;
        const imageSource = firstImage ? await uploadImageToS3(ctx, firstImage) : undefined;
        const imageAlt = firstImage ? (() => {
          const a = (firstImage.alt || "").trim() || cleanedTitle;
          return a || humaniseFileStemFromUrl(firstImage.src);
        })() : undefined;
        const contentTextValue = firstSentence || cleanedTitle;
        debugLog("Action button text for", cleanedTitle, "->", contentTextValue, "image:", imageSource);
        buttons.push({
          columns: 12,
          href: childPath,
          title: cleanedTitle,
          contentText: contentTextValue,
          imageSource,
          alt: imageAlt,
          imageBorderRadius: imageSource ? 6 : undefined,
          showPlaceholderImage: !imageSource,
          accessLevel: AccessLevel.PUBLIC
        });
      }
      const actionButtonsTemplate = parentTemplate?.rows?.find(row => row.type === PageContentType.ACTION_BUTTONS);
      const pageContent: PageContent = {
        path: parentContentPath || "home",
        rows: [{...(actionButtonsTemplate ? JSON.parse(JSON.stringify(actionButtonsTemplate)) : {type: PageContentType.ACTION_BUTTONS, maxColumns: 1, showSwiper: true}), showSwiper: true, columns: buttons}]
      };
      if (ctx.config.persistData) {
        const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pageContent.path}, pageContent);
        pageContents.push(saved);
        progress(`Created action buttons on ${pageContent.path} with ${pluraliseWithCount(buttons.length, "button")}`);
      } else {
        pageContents.push(pageContent);
        progress(`Prepared action buttons (dry run) on ${pageContent.path} with ${pluraliseWithCount(buttons.length, "button")}`);
      }
    } else if (mode === ParentPageMode.INDEX) {
      const parentContentPath = (parentPageConfig.pathPrefix || "").replace(/^\/+|\/+$/g, "");
      const title = (parentContentPath.split("/").pop() || "Index").replace(/[-_]/g, " ").replace(/\b\w/g, value => value.toUpperCase());
      const indexTemplate = parentTemplate?.rows?.find(row => row.type === PageContentType.ALBUM_INDEX);
      const pageContent: PageContent = {
        path: parentContentPath,
        rows: [{
          ...(indexTemplate ? JSON.parse(JSON.stringify(indexTemplate)) : {type: PageContentType.ALBUM_INDEX, maxColumns: 4, minColumns: 2, showSwiper: true}),
          showSwiper: true,
          columns: [],
          albumIndex: {
            ...indexTemplate?.albumIndex,
            contentPaths: [{contentPath: `${parentContentPath}/`, stringMatch: StringMatch.STARTS_WITH, maxPathSegments: parentContentPath.split("/").length + 1}],
            contentTypes: [IndexContentType.PAGES, IndexContentType.INDEX_PAGES],
            renderModes: [IndexRenderMode.ACTION_BUTTONS],
            indexMarkdown: `# ${title}`,
            autoTitle: false,
            showInParentIndex: true,
            minCols: 2,
            maxCols: 4
          }
        }]
      };
      if (ctx.config.persistData) {
        const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pageContent.path}, pageContent);
        pageContents.push(saved);
        progress(`Created child index on ${pageContent.path}`);
      } else {
        pageContents.push(pageContent);
        progress(`Prepared child index (dry run) on ${pageContent.path}`);
      }
    }
    const allChildLinksForPages = parentPageConfig.selectedChildren ?? await scrapeParentPageLinks(ctx, parentPageConfig);
    const childLinks = parentPageConfig.maxChildren && parentPageConfig.maxChildren > 0
      ? allChildLinksForPages.slice(0, parentPageConfig.maxChildren)
      : allChildLinksForPages;
    if (parentPageConfig.maxChildren && parentPageConfig.maxChildren > 0 && mode !== "action-buttons") {
      debugLog(`✅ Limiting to ${parentPageConfig.maxChildren} child pages`);
      progress(`Limiting to ${pluraliseWithCount(parentPageConfig.maxChildren, "child page")}`);
    }
    for (const childLink of parentPageConfig.migrateChildren === false ? [] : childLinks) {
      const pageContent = await migrateChildPage(ctx, childLink, transformationConfig, parentTemplate);
      if (pageContent) {
        pageContents.push(pageContent);
        debugLog(`✅ Migrated ${childLink.title} to /${pageContent.path}`);
      }
    }
  }
  return pageContents;
}

export async function migrateStaticSite(configInput: SiteMigrationConfig, browser: Browser | null = null): Promise<MigrationResult> {
  const config: SiteMigrationConfig = withDefaults(configInput);
  const ctx: Ctx = {config, browser, imageMappings: new Map(), templateCache: new Map((config.templatePages || []).map(page => [page.path, page])), sourceSiteStopped: null};
  try {
    debugLog(`✅ Starting migration for ${config.siteIdentifier}`);
    const pageContents: PageContent[] = [];
    const contentTextItems: ContentText[] = [];
    if (config.parentPages && config.parentPages.length > 0) {
      const parentPageContents = await migrateParentPages(ctx, contentTextItems);
      pageContents.push(...parentPageContents);
    } else {
      const siteTemplate = await loadTemplate(ctx, config.templateFragmentId);
      const pages = await scrapeAllPages(ctx);
      for (const content of pages) {
        let pageContent: PageContent;
        if (siteTemplate) {
          const pagePath = toContentPath(content.path);
          pageContent = await migrateUsingTemplate(ctx, content, siteTemplate, pagePath, content.title);
        } else {
          pageContent = config.useNestedRows ? await createPageContentWithNestedRows(ctx, content, contentTextItems) : await createPageContent(ctx, content, contentTextItems);
        }
        pageContents.push(pageContent);
        debugLog(`✅ Migrated ${content.title} to ${pageContent.path}`);
        progress(`✅ Migrated ${content.title} to ${pageContent.path}`);
      }
    }
    const collected = await pageAlbums(ctx, withoutRepeatedBlocks(pageContents));
    const albums = [...collected.albums, ...await migrateAlbums(ctx, flickrGroupLinks(collected.pages), flickrAlbumLinks(collected.pages), collected.albums)];
    assertSourceSiteResponding(ctx);
    if (config.publicHtmlOnly) {
      const requests = sourceSiteLimiter.summary(config.baseUrl);
      progress(`Read ${pluraliseWithCount(requests.requests, "page")} from ${requests.host}, averaging ${requests.averageResponseMs}ms, with ${pluraliseWithCount(requests.retries, "retry", "retries")}`);
    }
    debugLog(`✅ ${config.siteIdentifier} migration complete!`);
    return {pageContents: collected.pages, contentTextItems, albums};
  } finally {
    await closeBrowser(ctx);
  }
}
