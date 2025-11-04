import { launchBrowser as sharedLaunchBrowser, deriveBaseUrl, createActor } from "./serenity-migration-utils";
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
import { first } from "es-toolkit/compat";
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
import { Actor, Duration } from "@serenity-js/core";
import { NavigateAndWait } from "./screenplay/tasks/navigate-and-wait";
import { ExecutePageScript, ScrapeResult } from "./screenplay/interactions/execute-page-script";

const debugLog = debug(envConfig.logNamespace("static-html-site-migrator-serenity"));
debugLog.enabled = true;
const turndownService = createTurndownService();
const s3 = new S3({});
const awsConfig: AWSConfig = queryAWSConfig();

type Ctx = {
  config: SiteMigrationConfig;
  browser: WebdriverIO.Browser;
  actor: Actor;
};

function withDefaults(config: SiteMigrationConfig): SiteMigrationConfig {
  return {
    persistData: false,
    uploadTos3: false,
    ...config
  };
}

async function launchBrowser(ctx: Ctx): Promise<WebdriverIO.Browser> {
  if (!ctx.browser) {
    ctx.browser = await sharedLaunchBrowser();
    ctx.actor = await createActor(ctx.browser, "MigrationAgent");
  }
  return ctx.browser;
}

async function closeBrowser(ctx: Ctx): Promise<void> {
  if (ctx.browser) {
    await ctx.browser.deleteSession();
    ctx.browser = null;
  }
}

async function configureBrowserDiagnostics(browser: WebdriverIO.Browser): Promise<void> {
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
  await launchBrowser(ctx);

  try {
    await ctx.actor.attemptsTo(
      NavigateAndWait.to(ctx.config.baseUrl, Duration.ofSeconds(30)),
      ExecutePageScript.scrapeLinks(ctx.config.baseUrl, ctx.config.menuSelector)
    );

    const pageLinks: PageLink[] = await ctx.browser.execute(
      (base: string, selector: string): PageLink[] => {
        const links = Array.from(document.querySelectorAll(selector))
          .filter((a: HTMLAnchorElement) => a.href.startsWith(base))
          .map((a: HTMLAnchorElement) => ({ path: a.href, title: a.textContent!.trim() }));
        return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
      },
      ctx.config.baseUrl,
      ctx.config.menuSelector
    );

    if (!pageLinks.some(link => link.path === ctx.config.baseUrl)) {
      pageLinks.unshift({path: ctx.config.baseUrl, title: "Home"});
    }

    debugLog(`✅ Scraped ${pluraliseWithCount(pageLinks.length, "page link")}:`, pageLinks);
    return pageLinks;
  } catch (error) {
    debugLog(`❌ Error scraping page links:`, error);
    return [];
  }
}

async function scrapePageContent(ctx: Ctx, pageLink: PageLink): Promise<ScrapedPage> {
  await launchBrowser(ctx);

  try {
    debugLog(`✅ Scraping ${pageLink.path}`);

    await ctx.actor.attemptsTo(
      NavigateAndWait.to(pageLink.path, Duration.ofSeconds(30))
    );

    const {html, images, selectorErrors}: ScrapeResult & {selectorErrors?: {selector: string; error: string}[]} = await ctx.browser.execute(
      (selector: string, excludes: string[]): ScrapeResult & {selectorErrors?: {selector: string; error: string}[]} => {
        const node = document.querySelector(selector) || document.body;
        const selectors = Array.isArray(excludes) ? excludes : [];
        const selectorErrors: {selector: string; error: string}[] = [];

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

        return { html, images, selectorErrors: selectorErrors.length > 0 ? selectorErrors : undefined };
      },
      ctx.config.contentSelector,
      exclusions.coerceList(ctx.config.excludeSelectors)
    );

    if (selectorErrors && selectorErrors.length > 0) {
      debugLog(`⚠️ Selector errors on ${pageLink.path}:`, selectorErrors);
    }

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

async function scrapeAlbum(ctx: Ctx, albumLink: PageLink): Promise<MigratedAlbum> {
  await launchBrowser(ctx);
  debugLog(`✅ Scraping gallery ${albumLink.path}`);

  try {
    await ctx.actor.attemptsTo(
      NavigateAndWait.to(albumLink.path, Duration.ofSeconds(60))
    );

    const {images: rawImages}: ScrapeResult = await ctx.browser.execute(
      (selector: string): ScrapeResult => {
        const contentNode = document.querySelector(selector) || document.body;
        const imageNodes = contentNode.querySelectorAll("img");
        const html = "";
        const images = Array.from(imageNodes).map((img: HTMLImageElement) => ({
          src: img.src,
          alt: img.alt
        }));
        return { html, images };
      },
      ctx.config.contentSelector
    );

    const images = rawImages.filter(item => item.alt !== "logo");

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
  }
}

async function migrateAlbums(ctx: Ctx): Promise<MigratedAlbum[]> {
  const albums: MigratedAlbum[] = [];

  if (!ctx.config.galleryPath || !ctx.config.gallerySelector || !ctx.config.galleryImagePath) {
    debugLog("⚠️ Gallery configuration incomplete, skipping gallery scraping");
    progress("Skipping album migration: gallery configuration incomplete");
    return albums;
  }

  const rawLinks = ctx.config.specificAlbums && ctx.config.specificAlbums.length > 0
    ? ctx.config.specificAlbums
    : [];

  const galleryLinks = (rawLinks || []).filter(l => l && typeof l.path === "string" && /^https?:\/\//i.test(l.path));

  if (!galleryLinks.length) {
    debugLog("⚠️ No gallery links found");
    progress("No gallery links found; skipping album migration");
    return [];
  }

  progress(`Processing ${pluraliseWithCount(galleryLinks.length, "album")}`);

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

export async function migrateStaticSite(configInput: SiteMigrationConfig): Promise<MigrationResult> {
  const config: SiteMigrationConfig = withDefaults(configInput);
  const ctx: Ctx = {config, browser: null, actor: null};

  try {
    debugLog(`✅ Starting migration for ${config.siteIdentifier}`);

    const pageContents: PageContent[] = [];
    const contentTextItems: ContentText[] = [];

    const pages = await scrapeAllPages(ctx);

    for (const content of pages) {
      const pageContent = await createPageContent(ctx, content, contentTextItems);
      pageContents.push(pageContent);
      debugLog(`✅ Migrated ${content.title} to ${pageContent.path}`);
      progress(`✅ Migrated ${content.title} to ${pageContent.path}`);
    }

    const albums = await migrateAlbums(ctx);

    debugLog(`✅ ${config.siteIdentifier} migration complete!`);

    return {pageContents, contentTextItems, albums};
  } finally {
    await closeBrowser(ctx);
  }
}
