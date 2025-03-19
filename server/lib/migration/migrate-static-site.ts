import puppeteer from "puppeteer";
import TurndownService from "turndown";
import AWS from "aws-sdk";
import {
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

const debugLog = debug(envConfig.logNamespace("static-html-site-migrator"));
const turndown = new TurndownService();
const s3 = new AWS.S3();
const SOURCE_URL = "https://www.kentramblers.org.uk";
const persistData = false;
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
      .filter((a: HTMLAnchorElement) => a.href.startsWith("https://www.kentramblers.org.uk"))
      .map((a: HTMLAnchorElement) => ({path: a.href, title: a.textContent!.trim()}));
    return [...new Set(links.map(l => JSON.stringify(l)))].map(l => JSON.parse(l));
  });
  // Ensure Home is included
  if (!pageLinks.some(link => link.path === SOURCE_URL)) {
    pageLinks.unshift({path: SOURCE_URL, title: "Home"});
  }
  console.log(`✅ Scraped page links:`, pageLinks);

  const pageContents: ScrapedPage[] = [];
  for (const { path, title } of pageLinks) {
    console.log(`✅ Scraping ${path}`);
    await page.goto(path, {waitUntil: "networkidle2"});

    // Extract raw HTML and images separately
    const {html, images} = await page.evaluate(() => {
      const contentNode = document.querySelector('table[width="1015px"] td') || document.body;
      const html = contentNode.innerHTML;
      const images = Array.from(contentNode.querySelectorAll("img")).map((img: HTMLImageElement) => ({
        src: img.src,
        alt: img.alt || "Image"
      }));
      return {html, images};
    });

    // Convert to Markdown and split at images
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
    console.log(`❌ Error uploading image ${img.src}:`, error);
    return img.src;
  }
}

async function createContentText(text: string, nameSuffix: string): Promise<ContentText> {
  const markdown = turndown.turndown(text);
  const contentText: ContentText = {
    category: "migrated-content",
    name: toKebabCase("migrated-content", nameSuffix),
    text: markdown,
    // styles: {list: ListStyle.NO_IMAGE, class: "unknown"}
  };

  if (persistData) {
    console.log("✅ Saving content text:", contentText);
    return mongooseClient.create<ContentText>(contentTextModel, contentText);
  } else {
    console.log("✅ Creating content text (dry run):", contentText);
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
    console.log("✅ Saving page content:", pageContent);
    return mongooseClient.create(pageContentModel, pageContent);
  } else {
    console.log("✅ Creating page content (dry run):", pageContent);
    return pageContent;
  }
}

export async function migrateKentRamblers(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    debugLog("✅ Kent Ramblers migration complete!");
    res.json({
      type: MessageType.COMPLETE,
      data: {
        action: ApiAction.UPDATE,
        response: `✅ Kent Ramblers migration complete: ${pluraliseWithCount(pageContents.length, "page")} and ${pluraliseWithCount(contentTextItems.length, "content text item")} were migrated`,
        pageContents,
        contentTextItems
      }
    });
  } catch (error) {
    debugLog("❌ Error: migration failed:", error);
    res.status(500).json({ error: error.toString() });
  }
}
