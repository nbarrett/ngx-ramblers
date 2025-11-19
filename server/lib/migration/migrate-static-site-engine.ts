import { Browser, Page } from "puppeteer";
import { launchBrowser as sharedLaunchBrowser } from "./puppeteer-utils";
import { PutObjectCommand, S3 } from "@aws-sdk/client-s3";
import {
  AlbumView,
  ContentText,
  PageContent,
  PageContentRow,
  PageContentType
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import * as mongooseClient from "../mongo/mongoose-client";
import { pageContent as pageContentModel } from "../mongo/models/page-content";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { first, isString } from "es-toolkit/compat";
import { toKebabCase } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { generateUid, humaniseFileStemFromUrl, pluraliseWithCount, titleCase } from "../shared/string-utils";
import { AWSConfig } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { queryAWSConfig } from "../aws/aws-controllers";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { contentTypeFrom, extensionFrom } from "../aws/aws-utils";
import { contentMetadata } from "../mongo/models/content-metadata";
import { progress } from "./migration-progress";
import * as exclusions from "./text-exclusions";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { ContentMetadata } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import {
  PageLink,
  ParentPageConfig,
  SiteMigrationConfig
} from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import {
  MigratedAlbum,
  MigrationResult,
  ScrapedImage,
  ScrapedPage,
  ScrapedSegment
} from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { PageTransformationEngine } from "./page-transformation-engine";
import { createTurndownService } from "./turndown-service-factory";

const debugLog = debug(envConfig.logNamespace("static-html-site-migrator"));
debugLog.enabled = true;
const turndownService = createTurndownService();
const s3 = new S3({});
const awsConfig: AWSConfig = queryAWSConfig();

type Ctx = {
  config: SiteMigrationConfig;
  browser: Browser;
};

function withDefaults(config: SiteMigrationConfig): SiteMigrationConfig {
  return {
    persistData: false,
    uploadTos3: false,
    ...config
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

function configurePageDiagnostics(page: Page): void {
  page.on("response", async res => {
    try {
      const status = res.status();
      if (status >= 400) {
        const url = res.url();
        debugLog(`❌ Subresource ${status}: ${url}`);
        if (status !== 404) {
          progress(`Resource load error ${status}: ${url}`);
        }
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
      progress(`Resource failed: ${url} -> ${failure}`);
    } catch (error) {
      debugLog("requestfailed diagnostics handler failed", error);
    }
  });
}

async function createPage(ctx: Ctx): Promise<Page> {
  const browser = await launchBrowser(ctx);
  const page = await browser.newPage();
  configurePageDiagnostics(page);
  return page;
}

function toContentPath(path: string): string {
  const url = new URL(path);
  const contentPath = toKebabCase(...first(url.pathname.split(".")).split("/").filter(item => !["index"].includes(item.toLowerCase())));
  debugLog("✅ toContentPath:path:", path, "contentPath:", contentPath);
  return contentPath;
}

function isExcludedImage(ctx: Ctx, url: string): boolean {
  const excludes = exclusions.coerceList(ctx.config.excludeImageUrls).map(u => u.toLowerCase());
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
    const response = await page.goto(ctx.config.baseUrl, {waitUntil: "networkidle2", timeout: 30000});
    if (response && !response.ok()) {
      debugLog(`❌ Failed to load ${ctx.config.baseUrl}: Status ${response.status()}`);
      return [];
    }
    const pageLinks: PageLink[] = await page.evaluate(function pageLinksEval(baseUrl: string, menuSelector: string) {
      const links = Array.from(document.querySelectorAll(menuSelector))
        .filter((a: HTMLAnchorElement) => a.href.startsWith(baseUrl))
        .map((a: HTMLAnchorElement) => ({path: a.href, title: a.textContent!.trim()}));
      return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
    }, ctx.config.baseUrl, ctx.config.menuSelector);
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

async function scrapePageContent(ctx: Ctx, pageLink: PageLink): Promise<ScrapedPage> {
  const page = await createPage(ctx);
  try {
    debugLog(`✅ Scraping ${pageLink.path}`);
    const response = await page.goto(pageLink.path, {waitUntil: "networkidle2", timeout: 30000});
    if (response && !response.ok()) {
      debugLog(`❌ Failed to load ${pageLink.path}: Status ${response.status()}`);
      return {path: pageLink.path, title: pageLink.title, segments: []};
    }
    const {
      html,
      images
    } = await page.evaluate(function scrapeContentEval(contentSelector: string, excludeSelectors: string[]) {
      const node = document.querySelector(contentSelector) || document.body;
      const selectors = Array.isArray(excludeSelectors) ? excludeSelectors : [];
      selectors.forEach(sel => {
        try {
          node.querySelectorAll(sel).forEach(n => n.remove());
        } catch (e) {
          debugLog(`   Invalid selector:`, sel, "error:", e);
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
      return {html, images};
    }, ctx.config.contentSelector, exclusions.coerceList(ctx.config.excludeSelectors));
    let markdown = turndownService.turndown(html);
    markdown = exclusions.applyTextExclusions(markdown, {
      excludeTextPatterns: ctx.config.excludeTextPatterns,
      excludeMarkdownBlocks: ctx.config.excludeMarkdownBlocks,
      excludeImageUrls: ctx.config.excludeImageUrls
    });
    const segments: ScrapedSegment[] = [];
    let remainingText = markdown;
    debugLog(`✅ Segmenting page ${pageLink.path}: found ${pluraliseWithCount(images.length, "image")}`);
    debugLog(`   First 500 chars of markdown:`, markdown.substring(0, 500));
    for (const img of images) {
      const url = new URL(img.src);
      const absoluteMarker = `![${img.alt}](${img.src})`;
      const pathMarker = `![${img.alt}](${url.pathname})`;
      const fileMarker = `![${img.alt}](${url.pathname.split("/").pop()})`;
      debugLog(` Trying markers for img.alt="${img.alt}", img.src="${img.src}"`);
      debugLog(` absoluteMarker: ${absoluteMarker}`);
      debugLog(` pathMarker: ${pathMarker}`);
      debugLog(` fileMarker: ${fileMarker}`);
      let split = remainingText.split(absoluteMarker);
      let markerUsed = absoluteMarker;
      if (split.length === 1) {
        split = remainingText.split(pathMarker);
        markerUsed = pathMarker;
      }
      if (split.length === 1) {
        split = remainingText.split(fileMarker);
        markerUsed = fileMarker;
      }
      if (split.length > 1) {
        const [before, ...after] = split;
        if (before.trim()) segments.push({text: before.trim()});
        segments.push({text: img.alt || "Image", image: img});
        remainingText = after.join(markerUsed);
        debugLog(`✅ Split on marker: ${markerUsed}, split.length=${split.length}`);
      } else {
        debugLog(`⚠️ No match found! Checking if marker exists in remainingText...`);
        debugLog(`   Contains absoluteMarker: ${remainingText.includes(absoluteMarker)}`);
        debugLog(`   Contains pathMarker: ${remainingText.includes(pathMarker)}`);
        debugLog(`   Contains fileMarker: ${remainingText.includes(fileMarker)}`);
      }
    }
    if (remainingText.trim()) segments.push({text: remainingText.trim()});
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

async function uploadImageToS3(ctx: Ctx, img: ScrapedImage): Promise<string> {
  if (!ctx.config.uploadTos3) {
    return img.src;
  }
  try {
    const response = await fetch(img.src);
    if (!response.ok) {
      debugLog(`❌ Failed to fetch image ${img.src}: Status ${response.status}`);
      return img.src;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = generateUid() + extensionFrom(img.src);
    const awsFileName = `${RootFolder.siteContent}/${fileName}`;
    debugLog(`✅ Uploading image ${img.src} to S3 as ${awsFileName}`);
    await s3.send(new PutObjectCommand({
      Bucket: awsConfig.bucket,
      Key: fileName,
      Body: buffer,
      ContentType: contentTypeFrom(img.src),
      ACL: "public-read"
    }));
    return awsFileName;
  } catch (error) {
    debugLog(`❌ Error uploading image ${img.src}:`, error);
    return img.src;
  }
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
  const pageContent: PageContent = {
    path: pagePath || "home",
    rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, rows: nestedRows}]}]
  };
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
  if (ctx.config.persistData) {
    const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pagePath || "home"}, pageContent);
    progress(`Page migrated: ${pagePath || "home"} with ${pluraliseWithCount(textCount, "text block")} and ${pluraliseWithCount(imageCount, "image")}`);
    return saved;
  }
  progress(`Page prepared (dry run): ${pagePath || "home"} with ${pluraliseWithCount(textCount, "text block")} and ${pluraliseWithCount(imageCount, "image")}`);
  return pageContent;
}

function albumFrom(title: string): string {
  const yearMatch = title.match(/\b(\d{4})\b/);
  const monthMatch = title.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
  const year = yearMatch ? yearMatch[1] : "unknown-year";
  const month = monthMatch ? toKebabCase(monthMatch[1]) : "unknown-month";
  const baseName = toKebabCase(title.replace(/\b\d{4}\b/g, "").replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, "").trim());
  let name = "gallery";
  if (year === "unknown-year" && month === "unknown-month") name += `/${baseName}`;
  else if (year === "unknown-year") name += `/${month}/${baseName}`;
  else if (month === "unknown-month") name += `/${year}/${baseName}`;
  else name += `/${year}/${month}/${baseName}`;
  debugLog("albumFrom:", title, "albumName:", name);
  return name;
}

async function scrapeGalleryLinks(ctx: Ctx): Promise<PageLink[]> {
  if (!ctx.config.galleryPath || !ctx.config.gallerySelector || !ctx.config.galleryImagePath) {
    debugLog("⚠️ Gallery configuration incomplete, skipping gallery scraping");
    progress("Skipping album migration: gallery configuration incomplete");
    return [];
  }
  const page = await createPage(ctx);
  const pageUrl = `${ctx.config.baseUrl}/${ctx.config.galleryPath}`;
  debugLog(`✅ Scraping gallery index at ${pageUrl}`);
  try {
    const response = await page.goto(pageUrl, {waitUntil: "networkidle2", timeout: 30000});
    if (response && !response.ok()) {
      debugLog(`❌ Failed to load ${pageUrl}: Status ${response.status()}`);
      return [];
    }
    const galleryLinks = await page.evaluate(function galleryLinksEval(gallerySelector: string, imagePath: string) {
      const links = Array.from(document.querySelectorAll(gallerySelector))
        .filter((a: HTMLAnchorElement) => a.href.startsWith(`${location.origin}/${imagePath}/`) && a.textContent?.trim())
        .map((a: HTMLAnchorElement) => ({path: a.href, title: a.textContent!.trim()}));
      return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
    }, ctx.config.gallerySelector, ctx.config.galleryImagePath);
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
}

async function scrapeAlbum(ctx: Ctx, albumLink: PageLink): Promise<MigratedAlbum> {
  const page = await createPage(ctx);
  debugLog(`✅ Scraping gallery ${albumLink.path}`);
  try {
    const response = await page.goto(albumLink.path, {waitUntil: "networkidle2", timeout: 60000});
    if (response && !response.ok()) {
      debugLog(`❌ Failed to load ${albumLink.path}: Status ${response.status()}`);
      return null;
    }
    const images = await page.evaluate(function imagesEval(contentSelector: string) {
      const contentNode = document.querySelector(contentSelector) || document.body;
      const imageNodes = contentNode.querySelectorAll("img");
      return Array.from(imageNodes).map((img: HTMLImageElement) => ({
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
        columns: [{columns: 12, accessLevel: AccessLevel.public}],
        carousel: {
          name,
          createdAt: null,
          createdBy: null,
          eventType: "walks",
          title: albumLink.title,
          subtitle: `Photos from ${titleCase(albumLink.title)}`,
          showTitle: true,
          introductoryText: "To be completed",
          coverImageHeight: 400,
          coverImageBorderRadius: 6,
          showCoverImageAndText: false,
          showPreAlbumText: true,
          preAlbumText: null,
          albumView: AlbumView.GRID,
          gridViewOptions: {showTitles: true, showDates: true},
          galleryViewOptions: {
            thumbPosition: "left",
            imageSize: "cover",
            thumbImageSize: "cover",
            loadingStrategy: "lazy",
            dotsPosition: "bottom"
          },
          allowSwitchView: true,
          showStoryNavigator: true,
          showIndicators: true,
          slideInterval: 5000,
          height: null,
          eventId: null,
          eventDate: null
        } as any
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

async function migrateAlbums(ctx: Ctx): Promise<MigratedAlbum[]> {
  const rawLinks = ctx.config.specificAlbums && ctx.config.specificAlbums.length > 0 ? ctx.config.specificAlbums : await scrapeGalleryLinks(ctx);
  const galleryLinks = (rawLinks || []).filter(l => l && isString(l.path) && /^https?:\/\//i.test(l.path));
  if (!galleryLinks.length) {
    debugLog("⚠️ No gallery links found");
    progress("No gallery links found; skipping album migration");
    return [];
  }
  progress(`Processing ${pluraliseWithCount(galleryLinks.length, "album")}`);
  const albums: MigratedAlbum[] = [];
  for (const [index, galleryLink] of galleryLinks.entries()) {
    progress(`Migrating album ${index + 1}/${galleryLinks.length}: ${galleryLink.title}`);
    const album = await scrapeAlbum(ctx, galleryLink);
    if (album) {
      albums.push(album);
      progress(`Completed album ${index + 1}/${galleryLinks.length}: ${galleryLink.title}`);
    } else {
      progress(`Skipped album ${index + 1}/${galleryLinks.length}: ${galleryLink.title}`);
    }
  }
  return albums;
}

async function scrapeParentPageLinks(ctx: Ctx, parentPageConfig: ParentPageConfig): Promise<PageLink[]> {
  const page = await createPage(ctx);
  const parentUrl = parentPageConfig.url.startsWith("http") ? parentPageConfig.url : `${ctx.config.baseUrl}/${parentPageConfig.url}`;
  debugLog(`✅ Scraping parent page links from ${parentUrl}`);
  progress(`Scraping parent page links from ${parentUrl}`);
  try {
    const response = await page.goto(parentUrl, {waitUntil: "networkidle2", timeout: 30000});
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
    const childLinks: PageLink[] = await page.evaluate(function childLinksEval(selector: string, base: string, prefix: string, contentSelectorString: string, parentPath: string) {
      const collectedAnchors: Element[] = [];
      if (selector && selector.length > 0) {
        collectedAnchors.push(...Array.from(document.querySelectorAll(selector)));
      } else {
        const containers = contentSelectorString ? Array.from(document.querySelectorAll(contentSelectorString)) : [document.body];
        containers.forEach(container => collectedAnchors.push(...Array.from(container.querySelectorAll("a"))));
      }
      let anchors: HTMLAnchorElement[] = collectedAnchors.filter((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement);
      if (anchors.length === 0 && parentPath) {
        anchors = Array.from(document.querySelectorAll("a")).filter((a: HTMLAnchorElement) => a.href.startsWith(location.origin) && new URL(a.href).pathname.startsWith(`/${parentPath}`));
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
    }, linkSelector, baseUrl, pathPrefix, contentSelector, parentPathPrefix);
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

async function migrateChildPage(ctx: Ctx, childLink: PageLink, pageTransformationConfig?: any): Promise<PageContent> {
  const scrapedPage = await scrapePageContent(ctx, childLink);
  if (!scrapedPage.segments || scrapedPage.segments.length === 0) {
    debugLog(`⚠️ No content found for ${childLink.path}`);
    return null;
  }
  const pagePath = childLink.contentPath || toContentPath(childLink.path);

  if (pageTransformationConfig && pageTransformationConfig.enabled) {
    debugLog(`✅ Using page transformation: ${pageTransformationConfig.name}`);
    const engine = new PageTransformationEngine();
    const transformedPage = await engine.transform(scrapedPage, pageTransformationConfig, (img: ScrapedImage) => uploadImageToS3(ctx, img));
    transformedPage.path = pagePath;
    if (ctx.config.persistData) {
      const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pagePath}, transformedPage);
      progress(`✅ Migrated ${childLink.title} to [${pagePath}](${pagePath}) using transformation: ${pageTransformationConfig.name}`);
      return saved;
    }
    progress(`✅ Migrated ${childLink.title} to [${pagePath}](${pagePath}) (dry run) using transformation: ${pageTransformationConfig.name}`);
    return transformedPage;
  }
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
          columns: [{columns: 12, imageSource, alt: imageAlt, imageBorderRadius: 6}]
        });
      }
    }
    const pageContent: PageContent = {
      path: pagePath,
      rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, rows: nestedRows}]}]
    };
    if (ctx.config.persistData) {
      const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pagePath}, pageContent);
      progress(`✅ Migrated ${childLink.title} to [${pagePath}](${pagePath})`);
      return saved;
    }
    progress(`✅ Migrated ${childLink.title} to [${pagePath}](${pagePath}) (dry run)`);
    return pageContent;
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
          columns: [{columns: 12, imageSource, alt: imageAlt, imageBorderRadius: 6}]
        });
      }
    }
  }
  const pageContent: PageContent = {path: pagePath, rows: pageContentRows};
  if (ctx.config.persistData) {
    const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pagePath}, pageContent);
    progress(`✅ Migrated ${childLink.title} to ${pagePath}`);
    return saved;
  }
  progress(`✅ Migrated ${childLink.title} to ${pagePath} (dry run)`);
  return pageContent;
}

async function migrateParentPages(ctx: Ctx, contentTextItems: ContentText[]): Promise<PageContent[]> {
  if (!ctx.config.parentPages || ctx.config.parentPages.length === 0) {
    debugLog("⚠️ No parent pages configured");
    return [];
  }
  const pageContents: PageContent[] = [];
  for (const parentPageConfig of ctx.config.parentPages) {
    debugLog(`✅ Processing parent page: ${parentPageConfig.url}`);
    const mode = parentPageConfig.parentPageMode || (parentPageConfig.migrateParent ? "as-is" : undefined);
    const transformationConfig = parentPageConfig.pageTransformation || ctx.config.defaultPageTransformation;
    if (mode === "as-is") {
      const parentLink: PageLink = {
        path: parentPageConfig.url.startsWith("http") ? parentPageConfig.url : `${ctx.config.baseUrl}/${parentPageConfig.url}`,
        title: parentPageConfig.pathPrefix
      };
      const parentContentPath = (parentPageConfig.pathPrefix || "").replace(/^\/+|\/+$/g, "");
      const parentPageContent = await migrateChildPage(ctx, {
        ...parentLink,
        contentPath: parentContentPath
      }, transformationConfig);
      if (parentPageContent) pageContents.push(parentPageContent);
    } else if (mode === "action-buttons") {
      const parentContentPath = (parentPageConfig.pathPrefix || "").replace(/^\/+|\/+$/g, "");
      const allChildLinks = await scrapeParentPageLinks(ctx, parentPageConfig);
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
        const scraped = await scrapePageContent(ctx, link);
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
          accessLevel: AccessLevel.public
        });
      }
      const pageContent: PageContent = {
        path: parentContentPath || "home",
        rows: [{type: PageContentType.ACTION_BUTTONS, maxColumns: 1, showSwiper: false, columns: buttons}]
      };
      if (ctx.config.persistData) {
        const saved = await mongooseClient.upsert<PageContent>(pageContentModel, {path: pageContent.path}, pageContent);
        pageContents.push(saved);
        progress(`Created action buttons on ${pageContent.path} with ${pluraliseWithCount(buttons.length, "button")}`);
      } else {
        pageContents.push(pageContent);
        progress(`Prepared action buttons (dry run) on ${pageContent.path} with ${pluraliseWithCount(buttons.length, "button")}`);
      }
    }
    const allChildLinksForPages = await scrapeParentPageLinks(ctx, parentPageConfig);
    const childLinks = parentPageConfig.maxChildren && parentPageConfig.maxChildren > 0
      ? allChildLinksForPages.slice(0, parentPageConfig.maxChildren)
      : allChildLinksForPages;
    if (parentPageConfig.maxChildren && parentPageConfig.maxChildren > 0 && mode !== "action-buttons") {
      debugLog(`✅ Limiting to ${parentPageConfig.maxChildren} child pages`);
      progress(`Limiting to ${pluraliseWithCount(parentPageConfig.maxChildren, "child page")}`);
    }
    for (const childLink of childLinks) {
      const pageContent = await migrateChildPage(ctx, childLink, transformationConfig);
      if (pageContent) {
        pageContents.push(pageContent);
        debugLog(`✅ Migrated ${childLink.title} to /${pageContent.path}`);
      }
    }
  }
  return pageContents;
}

export async function migrateStaticSite(configInput: SiteMigrationConfig): Promise<MigrationResult> {
  const config: SiteMigrationConfig = withDefaults(configInput);
  const ctx: Ctx = {config, browser: null};
  try {
    debugLog(`✅ Starting migration for ${config.siteIdentifier}`);
    const pageContents: PageContent[] = [];
    const contentTextItems: ContentText[] = [];
    if (config.parentPages && config.parentPages.length > 0) {
      const parentPageContents = await migrateParentPages(ctx, contentTextItems);
      pageContents.push(...parentPageContents);
    } else {
      const pages = await scrapeAllPages(ctx);
      for (const content of pages) {
        const pageContent = config.useNestedRows ? await createPageContentWithNestedRows(ctx, content, contentTextItems) : await createPageContent(ctx, content, contentTextItems);
        pageContents.push(pageContent);
        debugLog(`✅ Migrated ${content.title} to ${pageContent.path}`);
        progress(`✅ Migrated ${content.title} to ${pageContent.path}`);
      }
    }
    const albums = await migrateAlbums(ctx);
    debugLog(`✅ ${config.siteIdentifier} migration complete!`);
    return {pageContents, contentTextItems, albums};
  } finally {
    await closeBrowser(ctx);
  }
}
