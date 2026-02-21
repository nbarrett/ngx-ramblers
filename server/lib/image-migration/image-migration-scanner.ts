import debug from "debug";
import { envConfig } from "../env-config/env-config";
import {
  ExternalImageReference,
  ImageMigrationGroup,
  ImageMigrationScanRequest,
  ImageMigrationScanResult,
  ImageMigrationSourceType,
  ImageMigrationStatus
} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { contentMetadata } from "../mongo/models/content-metadata";
import { pageContent } from "../mongo/models/page-content";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { ContentMetadata, ContentMetadataItem } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { PageContent, PageContentColumn, PageContentRow } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { Media, MediaStyle, RamblersEventType } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import * as transforms from "../mongo/controllers/transforms";
import * as mongooseClient from "../mongo/mongoose-client";
import { isArray } from "es-toolkit/compat";
import { createProcessTimer } from "../shared/process-timer";
import { dateTimeNowAsValue } from "../shared/dates";
import { pluraliseWithCount } from "../shared/string-utils";

const debugLog = debug(envConfig.logNamespace("image-migration-scanner"));
debugLog.enabled = true;

function generateId(): string {
  return `${dateTimeNowAsValue()}-${Math.random().toString(36).slice(2, 11)}`;
}

function urlMatchesHost(url: string, hostPattern: string): boolean {
  if (!url || !hostPattern) {
    return false;
  }
  try {
    const urlHost = new URL(url).hostname.toLowerCase();
    const pattern = hostPattern.toLowerCase();
    return urlHost.includes(pattern) || urlHost === pattern;
  } catch {
    return url.toLowerCase().includes(hostPattern.toLowerCase());
  }
}

function generateThumbnailUrl(url: string): string {
  return url;
}

function extractImageUrlsFromMarkdown(text: string, hostPattern: string): string[] {
  if (!text) {
    return [];
  }
  const markdownImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  return [
    ...Array.from(text.matchAll(markdownImageRegex)).map(m => m[1]).filter(url => urlMatchesHost(url, hostPattern)),
    ...Array.from(text.matchAll(htmlImgRegex)).map(m => m[1]).filter(url => urlMatchesHost(url, hostPattern))
  ];
}

function extractHostsFromMarkdown(text: string, hosts: Set<string>): void {
  if (!text) {
    return;
  }
  const markdownImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  Array.from(text.matchAll(markdownImageRegex)).forEach(m => extractHost(m[1], hosts));
  Array.from(text.matchAll(htmlImgRegex)).forEach(m => extractHost(m[1], hosts));
}

async function scanContentMetadata(hostPattern: string): Promise<ImageMigrationGroup[]> {
  const timer = createProcessTimer("scanContentMetadata", debugLog);
  await mongooseClient.connect(debugLog);
  const allMetadata = await contentMetadata.find({}).exec();
  timer.log(`queried ${pluraliseWithCount(allMetadata.length, "album")}`);
  const groups: ImageMigrationGroup[] = [];

  allMetadata.forEach((doc: any) => {
    const metadata: ContentMetadata = transforms.toObjectWithId(doc);
    const matchingImages: ExternalImageReference[] = [];

    if (metadata.coverImage && urlMatchesHost(metadata.coverImage, hostPattern)) {
      matchingImages.push({
        id: generateId(),
        sourceType: ImageMigrationSourceType.CONTENT_METADATA,
        sourceId: metadata.id,
        sourcePath: `${metadata.rootFolder}/${metadata.name}`,
        sourceTitle: `${metadata.name || "Unnamed Album"} (cover)`,
        currentUrl: metadata.coverImage,
        thumbnailUrl: generateThumbnailUrl(metadata.coverImage),
        fileSize: null,
        status: ImageMigrationStatus.PENDING,
        selected: true,
        newS3Url: null,
        errorMessage: null
      });
    }

    (metadata.files || []).forEach((file: ContentMetadataItem) => {
      if (file.image && urlMatchesHost(file.image, hostPattern)) {
        matchingImages.push({
          id: generateId(),
          sourceType: ImageMigrationSourceType.CONTENT_METADATA,
          sourceId: metadata.id,
          sourcePath: `${metadata.rootFolder}/${metadata.name}`,
          sourceTitle: metadata.name || "Unnamed Album",
          currentUrl: file.image,
          thumbnailUrl: generateThumbnailUrl(file.image),
          fileSize: null,
          status: ImageMigrationStatus.PENDING,
          selected: true,
          newS3Url: null,
          errorMessage: null
        });
      }
    });

    if (matchingImages.length > 0) {
      groups.push({
        sourcePath: `${metadata.rootFolder}/${metadata.name}`,
        sourceType: ImageMigrationSourceType.CONTENT_METADATA,
        sourceTitle: metadata.name || "Unnamed Album",
        expanded: false,
        selectAll: true,
        images: matchingImages
      });
    }
  });

  timer.complete(`found ${pluraliseWithCount(groups.length, "group")} with matching images`);
  return groups;
}

function extractImagesFromColumn(column: PageContentColumn, hostPattern: string): string[] {
  const images: string[] = [];

  if (column.imageSource && urlMatchesHost(column.imageSource, hostPattern)) {
    images.push(column.imageSource);
  }

  if (column.contentText) {
    images.push(...extractImageUrlsFromMarkdown(column.contentText, hostPattern));
  }

  if (column.rows && isArray(column.rows)) {
    column.rows.forEach((nestedRow: PageContentRow) => {
      (nestedRow.columns || []).forEach((nestedColumn: PageContentColumn) => {
        images.push(...extractImagesFromColumn(nestedColumn, hostPattern));
      });
    });
  }

  return images;
}

async function scanPageContent(hostPattern: string): Promise<ImageMigrationGroup[]> {
  const timer = createProcessTimer("scanPageContent", debugLog);
  await mongooseClient.connect(debugLog);
  const allPages = await pageContent.find({}).exec();
  timer.log(`queried ${pluraliseWithCount(allPages.length, "page")}`);
  const groups: ImageMigrationGroup[] = [];

  allPages.forEach((doc: any) => {
    const page: PageContent = transforms.toObjectWithId(doc);
    const matchingImages: ExternalImageReference[] = [];

    (page.rows || []).forEach((row: PageContentRow) => {
      (row.columns || []).forEach((column: PageContentColumn) => {
        const imageUrls = extractImagesFromColumn(column, hostPattern);
        imageUrls.forEach(url => {
          matchingImages.push({
            id: generateId(),
            sourceType: ImageMigrationSourceType.PAGE_CONTENT,
            sourceId: page.id,
            sourcePath: page.path || "unknown",
            sourceTitle: page.path || "Unnamed Page",
            currentUrl: url,
            thumbnailUrl: generateThumbnailUrl(url),
            fileSize: null,
            status: ImageMigrationStatus.PENDING,
            selected: true,
            newS3Url: null,
            errorMessage: null
          });
        });
      });
    });

    if (matchingImages.length > 0) {
      groups.push({
        sourcePath: page.path || "unknown",
        sourceType: ImageMigrationSourceType.PAGE_CONTENT,
        sourceTitle: page.path || "Unnamed Page",
        expanded: false,
        selectAll: true,
        images: matchingImages
      });
    }
  });

  timer.complete(`found ${pluraliseWithCount(groups.length, "group")} with matching images`);
  return groups;
}

async function scanGroupEvents(hostPattern: string, eventType?: RamblersEventType): Promise<ImageMigrationGroup[]> {
  const timer = createProcessTimer(`scanGroupEvents:${eventType}`, debugLog);
  await mongooseClient.connect(debugLog);

  const query: any = {};
  if (eventType) {
    query["groupEvent.item_type"] = eventType;
  }

  const allEvents = await extendedGroupEvent.find(query).exec();
  timer.log(`queried ${pluraliseWithCount(allEvents.length, "event")}`);
  const groups: ImageMigrationGroup[] = [];
  const sourceType = eventType === RamblersEventType.GROUP_EVENT
    ? ImageMigrationSourceType.SOCIAL_EVENT
    : ImageMigrationSourceType.GROUP_EVENT;

  allEvents.forEach((doc: any) => {
    const event: ExtendedGroupEvent = transforms.toObjectWithId(doc);
    const matchingImages: ExternalImageReference[] = [];
    const media: Media[] = event.groupEvent?.media || [];

    media.forEach((mediaItem: Media) => {
      (mediaItem.styles || []).forEach((style: MediaStyle) => {
        if (style.url && urlMatchesHost(style.url, hostPattern)) {
          matchingImages.push({
            id: generateId(),
            sourceType,
            sourceId: event.id,
            sourcePath: event.groupEvent?.url || event.id,
            sourceTitle: event.groupEvent?.title || "Unnamed Event",
            currentUrl: style.url,
            thumbnailUrl: generateThumbnailUrl(style.url),
            fileSize: null,
            status: ImageMigrationStatus.PENDING,
            selected: true,
            newS3Url: null,
            errorMessage: null
          });
        }
      });
    });

    [event.groupEvent?.description, event.groupEvent?.additional_details].forEach(textField => {
      if (textField) {
        extractImageUrlsFromMarkdown(textField, hostPattern).forEach(url => {
          matchingImages.push({
            id: generateId(),
            sourceType,
            sourceId: event.id,
            sourcePath: event.groupEvent?.url || event.id,
            sourceTitle: event.groupEvent?.title || "Unnamed Event",
            currentUrl: url,
            thumbnailUrl: generateThumbnailUrl(url),
            fileSize: null,
            status: ImageMigrationStatus.PENDING,
            selected: true,
            newS3Url: null,
            errorMessage: null
          });
        });
      }
    });

    if (matchingImages.length > 0) {
      groups.push({
        sourcePath: event.groupEvent?.url || event.id,
        sourceType,
        sourceTitle: event.groupEvent?.title || "Unnamed Event",
        expanded: false,
        selectAll: true,
        images: matchingImages
      });
    }
  });

  timer.complete(`found ${pluraliseWithCount(groups.length, "group")} with matching images`);
  return groups;
}

export async function scanForExternalImages(request: ImageMigrationScanRequest): Promise<ImageMigrationScanResult> {
  const timer = createProcessTimer("scanForExternalImages", debugLog);
  debugLog("scanForExternalImages:scan request:", request);

  const scanPromises: Promise<ImageMigrationGroup[]>[] = [];

  if (request.scanAlbums) {
    scanPromises.push(scanContentMetadata(request.hostPattern));
  }
  if (request.scanPageContent) {
    scanPromises.push(scanPageContent(request.hostPattern));
  }
  if (request.scanGroupEvents) {
    scanPromises.push(scanGroupEvents(request.hostPattern, RamblersEventType.GROUP_WALK));
  }
  if (request.scanSocialEvents) {
    scanPromises.push(scanGroupEvents(request.hostPattern, RamblersEventType.GROUP_EVENT));
  }

  const results = await Promise.all(scanPromises);
  const allGroups = results.flat();

  const totalImages = allGroups.reduce((sum, group) => sum + group.images.length, 0);
  const scanDurationMs = timer.elapsed();

  timer.complete(`found ${pluraliseWithCount(totalImages, "image")} in ${pluraliseWithCount(allGroups.length, "group")}`);

  return {
    hostPattern: request.hostPattern,
    groups: allGroups,
    totalImages,
    totalPages: allGroups.length,
    scanDurationMs
  };
}

function extractHost(url: string, hosts: Set<string>): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      if (!parsed.hostname.includes("amazonaws.com") && !parsed.hostname.includes("localhost")) {
        hosts.add(parsed.hostname);
      }
    }
  } catch {
    // Not a valid URL, skip
  }
}

function extractHostsFromColumn(column: PageContentColumn, hosts: Set<string>): void {
  if (column.imageSource) {
    extractHost(column.imageSource, hosts);
  }
  if (column.contentText) {
    extractHostsFromMarkdown(column.contentText, hosts);
  }
  if (column.rows && isArray(column.rows)) {
    column.rows.forEach((nestedRow: PageContentRow) => {
      (nestedRow.columns || []).forEach((nestedColumn: PageContentColumn) => {
        extractHostsFromColumn(nestedColumn, hosts);
      });
    });
  }
}

export async function scanForUniqueHosts(): Promise<string[]> {
  const timer = createProcessTimer("scanForUniqueHosts", debugLog);
  await mongooseClient.connect(debugLog);

  const hosts = new Set<string>();

  const [allMetadata, allPages] = await Promise.all([
    contentMetadata.find({}).exec(),
    pageContent.find({}).exec()
  ]);
  timer.log(`queried ${pluraliseWithCount(allMetadata.length, "album")}, ${pluraliseWithCount(allPages.length, "page")}`);

  allMetadata.forEach((doc: any) => {
    const metadata: ContentMetadata = transforms.toObjectWithId(doc);
    if (metadata.coverImage) {
      extractHost(metadata.coverImage, hosts);
    }
    (metadata.files || []).forEach((file: ContentMetadataItem) => {
      if (file.image) {
        extractHost(file.image, hosts);
      }
    });
  });

  allPages.forEach((doc: any) => {
    const page: PageContent = transforms.toObjectWithId(doc);
    (page.rows || []).forEach((row: PageContentRow) => {
      (row.columns || []).forEach((column: PageContentColumn) => {
        extractHostsFromColumn(column, hosts);
      });
    });
  });

  const uniqueHosts = Array.from(hosts).sort();
  timer.complete(`found ${pluraliseWithCount(uniqueHosts.length, "unique host")}: ${JSON.stringify(uniqueHosts)}`);
  return uniqueHosts;
}
