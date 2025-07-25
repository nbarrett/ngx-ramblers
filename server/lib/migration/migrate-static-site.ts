import puppeteer from "puppeteer";
import TurndownService from "turndown";
import AWS from "aws-sdk";
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
import { NextFunction, Request, Response } from "express";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { ApiAction } from "../../../projects/ngx-ramblers/src/app/models/api-response.model";
import first from "lodash/first";
import { toKebabCase } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { AWSConfig } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import { queryAWSConfig } from "../aws/aws-controllers";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { generateUid, pluraliseWithCount } from "../shared/string-utils";
import { contentTypeFrom, extensionFrom } from "../aws/aws-utils";
import { contentMetadata } from "../mongo/models/content-metadata";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";

const debugLog = debug(envConfig.logNamespace("static-html-site-migrator"));
const turndown = new TurndownService();
const s3 = new AWS.S3();
const SOURCE_URL = "https://nwkramblers.chessck.co.uk";
const persistData = true;
const uploadTos3 = false;
const config: AWSConfig = queryAWSConfig();
debugLog.enabled = true;

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

async function scrapeKentRamblers(): Promise<ScrapedPage[]> {
  debugLog(`✅ Scraping page links from`, SOURCE_URL);
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.goto(SOURCE_URL, {waitUntil: "networkidle2"});

  const pageLinks: { path: string; title: string }[] = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll(".BMenu a"))
      .filter((a: HTMLAnchorElement) => a.href.startsWith(SOURCE_URL))
      .map((a: HTMLAnchorElement) => ({path: a.href, title: a.textContent!.trim()}));
    return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
  });
  if (!pageLinks.some(link => link.path === SOURCE_URL)) {
    pageLinks.unshift({path: SOURCE_URL, title: "Home"});
  }
  debugLog(`✅ Scraped page links:`, pageLinks);

  const pageContents: ScrapedPage[] = [];
  for (const { path, title } of pageLinks) {
    debugLog(`✅ Scraping ${path}`);
    await page.goto(path, {waitUntil: "networkidle2"});

    const {html, images} = await page.evaluate(() => {
      const contentNode = document.querySelector('table[width="1015px"] td') || document.body;
      const html = contentNode.innerHTML;
      const images = Array.from(contentNode.querySelectorAll("img")).map((img: HTMLImageElement) => ({
        src: img.src,
        alt: img.alt || "Image"
      }));
      return {html, images};
    });

    const markdown = turndown.turndown(html);
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
  }

  await browser.close();
  return pageContents;
}

async function uploadImageToS3(img: ScrapedImage): Promise<string> {
  try {
    const response = await fetch(img.src);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = generateUid() + extensionFrom(img.src);
    const awsFileName = `${RootFolder.siteContent}/${fileName}`;
    debugLog(`✅ Uploading image ${img.src} to S3 as ${awsFileName}`);
    await s3.putObject({
      Bucket: config.bucket,
      Key: fileName,
      Body: buffer,
      ContentType: contentTypeFrom(img.src),
      ACL: "public-read"
    }).promise();
    return awsFileName;
  } catch (error) {
    debugLog(`❌ Error uploading image ${img.src}:`, error);
    return img.src;
  }
}

async function createContentText(text: string, nameSuffix: string): Promise<ContentText> {
  const markdown = turndown.turndown(text);
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
          columns: [{columns: 12, contentTextId: contentText.id}]
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
              {columns: 9, contentTextId: contentText.id},
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
    return mongooseClient.create(pageContentModel, pageContent);
  } else {
    debugLog("✅ Creating page content (dry run):", pageContent);
    return pageContent;
  }
}

function albumFrom(title: string) {
  const yearMatch = title.match(/\b(\d{4})\b/);
  const monthMatch = title.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i); // Extract month
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

async function createPhotoGalleryAlbums(): Promise<void> {
  debugLog(`✅ Scraping photo gallery links from ${SOURCE_URL}/PhotoGallery`);
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.goto(`${SOURCE_URL}/PhotoGallery`, {waitUntil: "networkidle2"});

  const galleryLinks: { path: string; title: string }[] = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("#ctl00_phLeftNavigation_divLeftNavigation ul li ul li a"))
      .filter((a: HTMLAnchorElement) => {
        const matched = a.href.startsWith(`${location.origin}/PhotoGallery/`) && a.textContent?.trim();
        console.info("✅ Scraping link:", a.href, "text:", a.textContent, "matched:", matched);
        return matched;
      })
      .map((a: HTMLAnchorElement) => ({path: a.href, title: a.textContent!.trim()}));
    return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
  });
  console.info(`✅ Found ${pluraliseWithCount(galleryLinks.length, "gallery link")}:`, galleryLinks);

  for (const {path, title} of galleryLinks) {
    console.info(`✅ Scraping gallery ${path}`);
    await page.goto(path, {waitUntil: "networkidle2"});

    const images = await page.evaluate(() => {
      const contentNode = document.querySelector('#ctl00_phContent_divContent table[width="1015px"] td') || document.body;
      return Array.from(contentNode.querySelectorAll("img")).map((img: HTMLImageElement) => ({
        src: img.src,
        alt: img.alt
      })).filter(item => item.alt !== "logo");
    });

    const files = images.map((img, index) => ({
      image: decodeURIComponent(img.src),
      originalFileName: decodeURIComponent(img.src.split("/").pop() || `image-${index + 1}.jpg`),
      text: img.alt,
      tags: []
    }));

    const albumName = albumFrom(title);

    const album: any = {
      rootFolder: RootFolder.siteContent,
      name: albumName,
      baseUrl: path,
      aspectRatio: null,
      contentMetaDataType: "gallery",
      files,
      coverImage: files.length > 0 ? files[0].image : "",
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
      const savedAlbum = await mongooseClient.create(contentMetadata, album);
      debugLog(`✅ Created album for ${title} at /${albumName} with ${pluraliseWithCount(files.length, "image")}:`, savedAlbum);

      debugLog("✅ Saving page content:", pageContent);
      const savedPageContent = await mongooseClient.create(pageContentModel, pageContent);
      debugLog(`✅ Created page content for ${title} at /${pageContent.path}:`, savedPageContent);
    } else {
      debugLog(`✅ Created album for ${title} at /${albumName} with ${pluraliseWithCount(files.length, "image")} (dry run):`, album);
      debugLog(`✅ Created page content for ${title} at /${pageContent.path} (dry run):`, pageContent);
    }
  }

  await browser.close();
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

export async function migrateNorthWestKentRamblers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pages = await scrapeKentRamblers();
    const pageContents: PageContent[] = [];
    const contentTextItems: ContentText[] = [];

    for (const content of pages) {
      debugLog(`✅ Migrating ${content.title} calling createPageContent()`);
      const pageContent = await createPageContent(content, contentTextItems);
      pageContents.push(pageContent);
      debugLog(`✅ Migrated ${content.title} to /${pageContent.path}`);
    }

    await createPhotoGalleryAlbums();

    debugLog("✅ North West Kent Ramblers migration complete!");
    res.json({
      type: MessageType.COMPLETE,
      data: {
        action: ApiAction.UPDATE,
        response: `✅ North West Kent Ramblers migration complete: ${pluraliseWithCount(pageContents.length, "page")} and ${pluraliseWithCount(contentTextItems.length, "content text item")} were migrated, plus photo gallery albums`,
        pageContents,
        contentTextItems
      }
    });
  } catch (error) {
    debugLog("❌ Error: migration failed:", error);
    res.status(500).json({ error: error.toString() });
  }
}
