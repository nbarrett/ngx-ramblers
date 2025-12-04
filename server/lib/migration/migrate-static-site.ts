import { Request, Response } from "express";
import { launchBrowser } from "./puppeteer-utils";
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
import { contentText as contentTextModel } from "../mongo/models/content-text";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { first } from "es-toolkit/compat";
import { toKebabCase } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { AWSConfig } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { queryAWSConfig } from "../aws/aws-controllers";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { generateUid, pluraliseWithCount } from "../shared/string-utils";
import { contentTypeFrom, extensionFrom } from "../aws/aws-utils";
import { contentMetadata } from "../mongo/models/content-metadata";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { ContentMetadata } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { createTurndownService } from "./turndown-service-factory";

const debugLog = debug(envConfig.logNamespace("migrate-static-site"));
debugLog.enabled = true;
const turndownService = createTurndownService();
const s3 = new S3({});
const persistData = false;
const uploadTos3 = false;
const config: AWSConfig = queryAWSConfig();
const baseUrl = "https://nwkramblers.chessck.co.uk";

interface ScrapedPage {
  path: string;
  title: string;
  segments: ScrapedSegment[];
}

interface ScrapedSegment {
  text: string;
  image?: ScrapedImage;
}

interface ScrapedImage {
  src: string;
  alt: string;
}

interface PageLink {
  path: string;
  title: string;
}

interface MigratedAlbum {
  album: ContentMetadata;
  pageContent: PageContent;
}

async function scrapeStaticSite(baseUrl: string): Promise<ScrapedPage[]> {
  debugLog(`✅ Scraping page links from ${baseUrl}`);
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    const response = await page.goto(baseUrl, {waitUntil: "networkidle2", timeout: 30000});
    if (response && !response.ok()) {
      debugLog(`❌ Failed to load ${baseUrl}: Status ${response.status()}`);
      return [];
    }

    const pageLinks: PageLink[] = await page.evaluate(function pageLinksEval(baseUrl: string) {
      const links = Array.from(document.querySelectorAll(".BMenu a"))
        .filter((a: HTMLAnchorElement) => a.href.startsWith(baseUrl))
        .map((a: HTMLAnchorElement) => ({path: a.href, title: a.textContent!.trim()}));
      return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
    }, baseUrl);
    if (!pageLinks.some(link => link.path === baseUrl)) {
      pageLinks.unshift({path: baseUrl, title: "Home"});
    }
    debugLog(`✅ Scraped page links:`, pageLinks);

    const pageContents: ScrapedPage[] = [];
    for (const {path, title} of pageLinks) {
      debugLog(`✅ Scraping ${path}`);
      try {
        const response = await page.goto(path, {waitUntil: "networkidle2", timeout: 30000});
        if (response && !response.ok()) {
          debugLog(`❌ Failed to load ${path}: Status ${response.status()}`);
          continue;
        }

        const {html, images} = await page.evaluate(function scrapeEval() {
          const contentNode = document.querySelector("table[width=\"1015px\"] td") || document.body;
          const html = contentNode.innerHTML;
          const images = Array.from(contentNode.querySelectorAll("img")).map((img: HTMLImageElement) => ({
            src: img.src,
            alt: img.alt || "Image"
          }));
          return {html, images};
        });

        const markdown = turndownService.turndown(html);
        const segments: ScrapedSegment[] = [];
        let remainingText = markdown;

        for (const img of images) {
          const marker = `![${img.alt}](${img.src})`;
          const [before, ...after] = remainingText.split(marker);
          if (before.trim()) segments.push({text: before.trim()});
          segments.push({text: img.alt, image: img});
          remainingText = after.join(marker);
        }
        if (remainingText.trim()) segments.push({text: remainingText.trim()});

        pageContents.push({path, title, segments});
      } catch (error) {
        debugLog(`❌ Error scraping ${path}:`, error);
      }
    }

    return pageContents;
  } catch (error) {
    debugLog(`❌ Error scraping ${baseUrl}:`, error);
    return [];
  } finally {
    await browser.close();
  }
}

async function uploadImageToS3(img: ScrapedImage): Promise<string> {
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
      Bucket: config.bucket,
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

async function createContentText(text: string, nameSuffix: string): Promise<ContentText> {
  const markdown = turndownService.turndown(text);
  const contentText: ContentText = {
    category: "migrated-content",
    name: toKebabCase("migrated-content", nameSuffix),
    text: markdown,
  };

  if (persistData) {
    debugLog("✅ Saving content text:", contentText);
    return mongooseClient.create<ContentText>(contentTextModel, contentText);
  } else {
    debugLog("✅ Creating content text (dry run):", contentText);
    return {...contentText, id: toKebabCase("dry-run-id", nameSuffix)};
  }
}

function toContentPath(path: string) {
  const url = new URL(path);
  const contentPath = toKebabCase(...first(url.pathname.split(".")).split("/").filter(item => !["index"].includes(item.toLowerCase())));
  debugLog("✅ toContentPath:path:", path, "contentPath:", contentPath);
  return contentPath;
}

async function createPageContent(content: ScrapedPage, contentTextItems: ContentText[]): Promise<PageContent> {
  const pagePath = toContentPath(content.path);
  debugLog("✅ createPageContent:content:", content, "content.segments:", content.segments, "pagePath:", pagePath);
  const pageContentRows: PageContentRow[] = [];

  if (content.segments) {
    for (const [index, segment] of content.segments.entries()) {
      const nameSuffix = `${pagePath}-${index}`;
      if (segment.text && !segment.image) {
        const contentText: ContentText = await createContentText(segment.text, nameSuffix);
        contentTextItems.push(contentText);
        pageContentRows.push({
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          columns: [{columns: 12, contentText: contentText.text}]
        });
      } else if (segment.image) {
        const imageSource = uploadTos3 ? await uploadImageToS3(segment.image) : segment.image.src;
        if (segment.text) {
          const contentText: ContentText = await createContentText(segment.text, nameSuffix);
          contentTextItems.push(contentText);
          pageContentRows.push({
            type: PageContentType.TEXT,
            maxColumns: 2,
            showSwiper: false,
            columns: [
              {columns: 9, contentText: contentText.text},
              {columns: 3, imageSource, imageBorderRadius: 6}
            ]
          });
        } else {
          pageContentRows.push({
            type: PageContentType.TEXT,
            maxColumns: 1,
            showSwiper: false,
            columns: [{columns: 12, imageSource, imageBorderRadius: 6}]
          });
        }
      }
    }
  } else {
    debugLog("❌ No segments found for", content.title);
  }

  const pageContent: PageContent = {path: pagePath || "home", rows: pageContentRows};
  if (persistData) {
    debugLog("✅ Saving page content:", pageContent);
    return mongooseClient.create<PageContent>(pageContentModel, pageContent);
  } else {
    debugLog("✅ Creating page content (dry run):", pageContent);
    return pageContent;
  }
}

function albumFrom(title: string) {
  const yearMatch = title.match(/\b(\d{4})\b/);
  const monthMatch = title.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
  const year = yearMatch ? yearMatch[1] : "unknown-year";
  const month = monthMatch ? toKebabCase(monthMatch[1]) : "unknown-month";
  const baseName = toKebabCase(title.replace(/\b\d{4}\b/g, "").replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, "").trim());
  let albumName = "gallery";
  if (year === "unknown-year" && month === "unknown-month") {
    albumName += `/${baseName}`;
  } else if (year === "unknown-year") {
    albumName += `/${month}/${baseName}`;
  } else if (month === "unknown-month") {
    albumName += `/${year}/${baseName}`;
  } else {
    albumName += `/${year}/${month}/${baseName}`;
  }
  debugLog("albumFrom:", title, "albumName:", albumName);
  return albumName;
}

async function createPhotoGalleryAlbums(baseUrl: string, specificAlbums: PageLink[] = []): Promise<MigratedAlbum[]> {
  debugLog(`✅ Scraping photo gallery albums from ${baseUrl}`);
  const browser = await launchBrowser();
  const page = await browser.newPage();
  let galleryLinks: PageLink[] = specificAlbums;
  if (!specificAlbums.length) {
    const pageUrl = `${baseUrl}/PhotoGallery`;
    debugLog(`✅ Scraping gallery index at ${pageUrl}`);
    try {
      const response = await page.goto(pageUrl, {waitUntil: "networkidle2", timeout: 30000});
      if (response && !response.ok()) {
        debugLog(`❌ Failed to load ${pageUrl}: Status ${response.status()}`);
      } else {
        const evalResult = await page.evaluate(function galleryEval(pageUrl: string, imagePath: string) {
          const logs: string[] = [];
          logs.push(`Evaluating gallery page ${pageUrl}`);
          const raw = Array.from(document.querySelectorAll("#ctl00_phLeftNavigation_divLeftNavigation ul li ul li a"))
            .filter((a: HTMLAnchorElement) => a.href.startsWith(`${location.origin}/${imagePath}/`) && a.textContent?.trim())
            .map((a: HTMLAnchorElement) => ({path: a.href, title: a.textContent!.trim()}));
          const links = [...new Set(raw.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
          logs.push(`Matched ${links.length} gallery links`);
          return { links, logs };
        }, pageUrl, "PhotoGallery");
        if (Array.isArray(evalResult.logs)) {
          evalResult.logs.forEach(m => debugLog(m));
        }
        galleryLinks = evalResult.links as PageLink[];
      }
    } catch (error) {
      debugLog(`❌ Error scraping ${pageUrl}:`, error);
    }
    debugLog(`✅ Found ${pluraliseWithCount(galleryLinks.length, "gallery link")}:`, galleryLinks);
  } else {
    debugLog(`✅ Processing specific albums:`, galleryLinks);
  }

  const albums: MigratedAlbum[] = [];
  for (const {path, title} of galleryLinks) {
    debugLog(`✅ Scraping gallery ${path}`);
    try {
      const response = await page.goto(path, {waitUntil: "networkidle2", timeout: 60000});
      if (response && !response.ok()) {
        debugLog(`❌ Failed to load ${path}: Status ${response.status()}`);
        continue;
      }

      debugLog(`Response status for ${path}: ${response.status()}`);
      debugLog(`Response headers:`, response.headers());
      debugLog(`Redirect chain:`, response.request().redirectChain().map(r => r.url()));
      const html = await page.content();
      require("fs").writeFileSync(`debug-${toKebabCase(title)}.html`, html);
      debugLog(`Saved HTML for ${path} to debug-${toKebabCase(title)}.html`);
      const imageEval = await page.evaluate(function imageEvalFn() {
        const logs: string[] = [];
        const contentNode = document.querySelector("#ctl00_phContent_divContent table[width=\"1015px\"] td") || document.body;
        logs.push(`Album content node: ${contentNode.tagName}`);
        const imageNodes = contentNode.querySelectorAll("img");
        logs.push(`Album images found: ${imageNodes.length}`);
        const images = Array.from(imageNodes).map((img: HTMLImageElement) => ({
          src: img.src,
          alt: img.alt
        })).filter(item => item.alt !== "logo");
        return { images, logs };
      });
      if (Array.isArray(imageEval.logs)) {
        imageEval.logs.forEach(m => debugLog(m));
      }
      const images = imageEval.images as { src: string; alt: string }[];

      const files = images.map((img, index) => ({
        image: decodeURIComponent(img.src),
        originalFileName: decodeURIComponent(img.src.split("/").pop() || `image-${index + 1}.jpg`),
        text: img.alt,
        tags: []
      }));

      const albumName = albumFrom(title);

      const album: ContentMetadata = {
        rootFolder: RootFolder.siteContent,
        name: albumName,
        aspectRatio: null,
        files,
        coverImage: null,
        imageTags: [],
        maxImageSize: 1024
      };

      const pageContent: PageContent = {
        path: albumName,
        rows: [
          {
            maxColumns: 1,
            showSwiper: false,
            type: PageContentType.ALBUM,
            columns: [
              {
                columns: 12,
                accessLevel: AccessLevel.public,
              }
            ],
            carousel: {
              name: albumName,
              createdAt: null,
              createdBy: null,
              eventType: "walks",
              title,
              subtitle: `Photos from ${toTitleCase(title)}`,
              showTitle: true,
              introductoryText: "To be completed",
              coverImageHeight: 400,
              coverImageBorderRadius: 6,
              showCoverImageAndText: false,
              showPreAlbumText: true,
              preAlbumText: null,
              albumView: AlbumView.GRID,
              gridViewOptions: {
                showTitles: true,
                showDates: true
              },
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
            }
          }
        ]
      };

      if (persistData) {
        debugLog("✅ Saving album:", album);
        const savedAlbum = await mongooseClient.create<ContentMetadata>(contentMetadata, album);
        debugLog(`✅ Created album for ${title} at /${albumName} with ${pluraliseWithCount(files.length, "image")}:`, savedAlbum);

        debugLog("✅ Saving page content:", pageContent);
        const savedPageContent = await mongooseClient.create<PageContent>(pageContentModel, pageContent);
        debugLog(`✅ Created page content for ${title} at /${pageContent.path}:`, savedPageContent);
        albums.push({album: savedAlbum, pageContent: savedPageContent});
      } else {
        debugLog(`✅ Created album for ${title} at /${albumName} with ${pluraliseWithCount(files.length, "image")} (dry run):`, album);
        debugLog(`✅ Created page content for ${title} at /${pageContent.path} (dry run):`, pageContent);
        albums.push({album, pageContent});
      }
    } catch (error) {
      debugLog(`❌ Error scraping ${path}:`, error);
    }
  }

  await browser.close();
  return albums;
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

const specificAlbums: PageLink[] = [
  {path: `${baseUrl}/WhiteCliffsofDoverMay2025`, title: "White Cliffs of Dover May 2025"},
  {path: `${baseUrl}/Eastbourne-SevenSisters082022`, title: "Eastbourne - Seven Sisters 08/2022"}
];

export async function migrateAlbums(req: Request, res: Response): Promise<void> {
  try {
    const response: MigratedAlbum[] = await createPhotoGalleryAlbums(baseUrl, specificAlbums);
    res.json({
      type: MessageType.COMPLETE,
      data: {
        action: ApiAction.UPDATE,
        response: `✅ Migrated ${pluraliseWithCount(response.length, "album")}`,
        albums: response
      }
    });
  } catch (error) {
    handleError(error, res);
  }
}

export async function migrateNorthWestKentRamblers(req: Request, res: Response): Promise<void> {
  try {
    const pages: ScrapedPage[] = await scrapeStaticSite(baseUrl);
    const pageContents: PageContent[] = [];
    const contentTextItems: ContentText[] = [];

    for (const content of pages) {
      debugLog(`✅ Migrating ${content.title} calling createPageContent()`);
      const pageContent = await createPageContent(content, contentTextItems);
      pageContents.push(pageContent);
      debugLog(`✅ Migrated ${content.title} to /${pageContent.path}`);
    }

    const albums = await createPhotoGalleryAlbums(baseUrl, specificAlbums);

    debugLog("✅ North West Kent Ramblers migration complete!");
    res.json({
      type: MessageType.COMPLETE,
      data: {
        action: ApiAction.UPDATE,
        response: `✅ North West Kent Ramblers migration complete: ${pluraliseWithCount(pageContents.length, "page")} and ${pluraliseWithCount(contentTextItems.length, "content text item")} were migrated, plus ${pluraliseWithCount(albums.length, "album")}`,
        pageContents,
        contentTextItems,
        albums
      }
    });
  } catch (error) {
    handleError(error, res);
  }
}

function handleError(error: Error, res: Response<any, Record<string, any>>) {
  debugLog("❌ Error: migration failed:", error);
  res.status(500).json({error: error.message, stack: error.stack});
}
