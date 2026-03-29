import debug from "debug";
import { envConfig } from "../env-config/env-config";
import {
  ContentMigrationDocumentType,
  ContentMigrationGroup,
  ContentMigrationScanRequest,
  ContentMigrationScanResult,
  ContentMigrationSourceType,
  ContentMigrationStatus,
  ExternalContentReference
} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { contentMetadata } from "../mongo/models/content-metadata";
import { pageContent } from "../mongo/models/page-content";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import committeeFile from "../mongo/models/committee-file";
import { ContentMetadata, ContentMetadataItem } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import { PageContent, PageContentColumn, PageContentRow } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { CommitteeFile } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { Media, MediaStyle, RamblersEventType } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import * as transforms from "../mongo/controllers/transforms";
import * as mongooseClient from "../mongo/mongoose-client";
import { isArray } from "es-toolkit/compat";
import { createProcessTimer } from "../shared/process-timer";
import { dateTimeNowAsValue } from "../shared/dates";
import { pluraliseWithCount } from "../shared/string-utils";
import { sortBy } from "../../../projects/ngx-ramblers/src/app/functions/arrays";

const debugLog = debug(envConfig.logNamespace("content-migration-scanner"));
debugLog.enabled = true;

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)$/i;
const DOCUMENT_EXTENSIONS = /\.(pdf|doc|docx|dot|xls|xlsx|csv|ppt|pptx|odt|ods|odp|rtf|txt|gpx|zip|json|geojson|xml)$/i;

function generateId(): string {
  return `${dateTimeNowAsValue()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function documentTypeFromUrl(url: string): ContentMigrationDocumentType {
  if (!url) {
    return ContentMigrationDocumentType.OTHER;
  }
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)$/.test(pathname)) {
      return ContentMigrationDocumentType.IMAGE;
    } else if (/\.pdf$/.test(pathname)) {
      return ContentMigrationDocumentType.PDF;
    } else if (/\.(xls|xlsx|csv|ods)$/.test(pathname)) {
      return ContentMigrationDocumentType.SPREADSHEET;
    } else if (/\.(doc|docx|dot|odt|rtf|ppt|pptx|odp|txt)$/.test(pathname)) {
      return ContentMigrationDocumentType.DOCUMENT;
    } else {
      return ContentMigrationDocumentType.OTHER;
    }
  } catch {
    return ContentMigrationDocumentType.OTHER;
  }
}

function isExternalDocumentUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return IMAGE_EXTENSIONS.test(pathname) || DOCUMENT_EXTENSIONS.test(pathname);
  } catch {
    return false;
  }
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

function extractExternalUrlsFromText(text: string, hostPattern: string): string[] {
  if (!text) {
    return [];
  }
  const markdownImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const markdownLinkRegex = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
  const htmlLinkRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi;
  const allUrls = [
    ...Array.from(text.matchAll(markdownImageRegex)).map(m => m[1]),
    ...Array.from(text.matchAll(htmlImgRegex)).map(m => m[1]),
    ...Array.from(text.matchAll(markdownLinkRegex)).map(m => m[1]).filter(isExternalDocumentUrl),
    ...Array.from(text.matchAll(htmlLinkRegex)).map(m => m[1]).filter(isExternalDocumentUrl)
  ];
  return allUrls.filter(url => urlMatchesHost(url, hostPattern));
}

function extractHostsFromText(text: string, hosts: Set<string>): void {
  if (!text) {
    return;
  }
  const markdownImageRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const markdownLinkRegex = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g;
  const htmlLinkRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi;
  Array.from(text.matchAll(markdownImageRegex)).forEach(m => extractHost(m[1], hosts));
  Array.from(text.matchAll(htmlImgRegex)).forEach(m => extractHost(m[1], hosts));
  Array.from(text.matchAll(markdownLinkRegex)).filter(m => isExternalDocumentUrl(m[1])).forEach(m => extractHost(m[1], hosts));
  Array.from(text.matchAll(htmlLinkRegex)).filter(m => isExternalDocumentUrl(m[1])).forEach(m => extractHost(m[1], hosts));
}

async function scanContentMetadata(hostPattern: string): Promise<ContentMigrationGroup[]> {
  const timer = createProcessTimer("scanContentMetadata", debugLog);
  await mongooseClient.connect(debugLog);
  const allMetadata = await contentMetadata.find({}).exec();
  timer.log(`queried ${pluraliseWithCount(allMetadata.length, "album")}`);
  const groups: ContentMigrationGroup[] = [];

  allMetadata.forEach((doc: any) => {
    const metadata: ContentMetadata = transforms.toObjectWithId(doc);
    const matchingItems: ExternalContentReference[] = [];

    if (metadata.coverImage && urlMatchesHost(metadata.coverImage, hostPattern)) {
      matchingItems.push({
        id: generateId(),
        sourceType: ContentMigrationSourceType.CONTENT_METADATA,
        sourceId: metadata.id,
        sourcePath: `${metadata.rootFolder}/${metadata.name}`,
        sourceTitle: `${metadata.name || "Unnamed Album"} (cover)`,
        currentUrl: metadata.coverImage,
        thumbnailUrl: generateThumbnailUrl(metadata.coverImage),
        documentType: documentTypeFromUrl(metadata.coverImage),
        fileSize: null,
        status: ContentMigrationStatus.PENDING,
        selected: true,
        newS3Url: null,
        errorMessage: null
      });
    }

    (metadata.files || []).forEach((file: ContentMetadataItem) => {
      if (file.image && urlMatchesHost(file.image, hostPattern)) {
        matchingItems.push({
          id: generateId(),
          sourceType: ContentMigrationSourceType.CONTENT_METADATA,
          sourceId: metadata.id,
          sourcePath: `${metadata.rootFolder}/${metadata.name}`,
          sourceTitle: metadata.name || "Unnamed Album",
          currentUrl: file.image,
          thumbnailUrl: generateThumbnailUrl(file.image),
          documentType: documentTypeFromUrl(file.image),
          fileSize: null,
          status: ContentMigrationStatus.PENDING,
          selected: true,
          newS3Url: null,
          errorMessage: null
        });
      }
    });

    if (matchingItems.length > 0) {
      groups.push({
        sourcePath: `${metadata.rootFolder}/${metadata.name}`,
        sourceType: ContentMigrationSourceType.CONTENT_METADATA,
        sourceTitle: metadata.name || "Unnamed Album",
        expanded: false,
        selectAll: true,
        items: matchingItems
      });
    }
  });

  timer.complete(`found ${pluraliseWithCount(groups.length, "group")} with matching content`);
  return groups;
}

function extractUrlsFromColumn(column: PageContentColumn, hostPattern: string): string[] {
  const urls: string[] = [];

  if (column.imageSource && urlMatchesHost(column.imageSource, hostPattern)) {
    urls.push(column.imageSource);
  }

  if (column.href && urlMatchesHost(column.href, hostPattern) && isExternalDocumentUrl(column.href)) {
    urls.push(column.href);
  }

  if (column.contentText) {
    urls.push(...extractExternalUrlsFromText(column.contentText, hostPattern));
  }

  if (column.rows && isArray(column.rows)) {
    column.rows.forEach((nestedRow: PageContentRow) => {
      (nestedRow.columns || []).forEach((nestedColumn: PageContentColumn) => {
        urls.push(...extractUrlsFromColumn(nestedColumn, hostPattern));
      });
    });
  }

  return urls;
}

async function scanPageContent(hostPattern: string): Promise<ContentMigrationGroup[]> {
  const timer = createProcessTimer("scanPageContent", debugLog);
  await mongooseClient.connect(debugLog);
  const allPages = await pageContent.find({}).exec();
  timer.log(`queried ${pluraliseWithCount(allPages.length, "page")}`);
  const groups: ContentMigrationGroup[] = [];

  allPages.forEach((doc: any) => {
    const page: PageContent = transforms.toObjectWithId(doc);
    const matchingItems: ExternalContentReference[] = [];

    (page.rows || []).forEach((row: PageContentRow) => {
      (row.columns || []).forEach((column: PageContentColumn) => {
        const contentUrls = extractUrlsFromColumn(column, hostPattern);
        contentUrls.forEach(url => {
          matchingItems.push({
            id: generateId(),
            sourceType: ContentMigrationSourceType.PAGE_CONTENT,
            sourceId: page.id,
            sourcePath: page.path || "unknown",
            sourceTitle: page.path || "Unnamed Page",
            currentUrl: url,
            thumbnailUrl: generateThumbnailUrl(url),
            documentType: documentTypeFromUrl(url),
            fileSize: null,
            status: ContentMigrationStatus.PENDING,
            selected: true,
            newS3Url: null,
            errorMessage: null
          });
        });
      });
    });

    if (matchingItems.length > 0) {
      groups.push({
        sourcePath: page.path || "unknown",
        sourceType: ContentMigrationSourceType.PAGE_CONTENT,
        sourceTitle: page.path || "Unnamed Page",
        expanded: false,
        selectAll: true,
        items: matchingItems
      });
    }
  });

  timer.complete(`found ${pluraliseWithCount(groups.length, "group")} with matching content`);
  return groups;
}

async function scanGroupEvents(hostPattern: string, eventType?: RamblersEventType): Promise<ContentMigrationGroup[]> {
  const timer = createProcessTimer(`scanGroupEvents:${eventType}`, debugLog);
  await mongooseClient.connect(debugLog);

  const query: any = {};
  if (eventType) {
    query["groupEvent.item_type"] = eventType;
  }

  const allEvents = await extendedGroupEvent.find(query).exec();
  timer.log(`queried ${pluraliseWithCount(allEvents.length, "event")}`);
  const groups: ContentMigrationGroup[] = [];
  const sourceType = eventType === RamblersEventType.GROUP_EVENT
    ? ContentMigrationSourceType.SOCIAL_EVENT
    : ContentMigrationSourceType.GROUP_EVENT;

  allEvents.forEach((doc: any) => {
    const event: ExtendedGroupEvent = transforms.toObjectWithId(doc);
    const matchingItems: ExternalContentReference[] = [];
    const media: Media[] = event.groupEvent?.media || [];

    media.forEach((mediaItem: Media) => {
      (mediaItem.styles || []).forEach((style: MediaStyle) => {
        if (style.url && urlMatchesHost(style.url, hostPattern)) {
          matchingItems.push({
            id: generateId(),
            sourceType,
            sourceId: event.id,
            sourcePath: event.groupEvent?.url || event.id,
            sourceTitle: event.groupEvent?.title || "Unnamed Event",
            currentUrl: style.url,
            thumbnailUrl: generateThumbnailUrl(style.url),
            documentType: documentTypeFromUrl(style.url),
            fileSize: null,
            status: ContentMigrationStatus.PENDING,
            selected: true,
            newS3Url: null,
            errorMessage: null
          });
        }
      });
    });

    [event.groupEvent?.description, event.groupEvent?.additional_details].forEach(textField => {
      if (textField) {
        extractExternalUrlsFromText(textField, hostPattern).forEach(url => {
          matchingItems.push({
            id: generateId(),
            sourceType,
            sourceId: event.id,
            sourcePath: event.groupEvent?.url || event.id,
            sourceTitle: event.groupEvent?.title || "Unnamed Event",
            currentUrl: url,
            thumbnailUrl: generateThumbnailUrl(url),
            documentType: documentTypeFromUrl(url),
            fileSize: null,
            status: ContentMigrationStatus.PENDING,
            selected: true,
            newS3Url: null,
            errorMessage: null
          });
        });
      }
    });

    if (matchingItems.length > 0) {
      groups.push({
        sourcePath: event.groupEvent?.url || event.id,
        sourceType,
        sourceTitle: event.groupEvent?.title || "Unnamed Event",
        expanded: false,
        selectAll: true,
        items: matchingItems
      });
    }
  });

  timer.complete(`found ${pluraliseWithCount(groups.length, "group")} with matching content`);
  return groups;
}

async function scanCommitteeFiles(hostPattern: string): Promise<ContentMigrationGroup[]> {
  const timer = createProcessTimer("scanCommitteeFiles", debugLog);
  await mongooseClient.connect(debugLog);
  const allFiles = await committeeFile.find({}).exec();
  timer.log(`queried ${pluraliseWithCount(allFiles.length, "committee file")}`);
  const groups: ContentMigrationGroup[] = [];

  allFiles.forEach((doc: any) => {
    const file: CommitteeFile = transforms.toObjectWithId(doc);
    const awsFileName = file.fileNameData?.awsFileName;
    if (awsFileName && urlMatchesHost(awsFileName, hostPattern)) {
      const sourcePath = `committee-files/${file.fileType || "uncategorised"}`;
      const title = file.fileNameData?.title || file.fileNameData?.originalFileName || awsFileName;
      groups.push({
        sourcePath,
        sourceType: ContentMigrationSourceType.COMMITTEE_FILE,
        sourceTitle: title,
        expanded: false,
        selectAll: true,
        items: [{
          id: generateId(),
          sourceType: ContentMigrationSourceType.COMMITTEE_FILE,
          sourceId: file.id,
          sourcePath,
          sourceTitle: title,
          currentUrl: awsFileName,
          thumbnailUrl: generateThumbnailUrl(awsFileName),
          documentType: documentTypeFromUrl(awsFileName),
          fileSize: null,
          status: ContentMigrationStatus.PENDING,
          selected: true,
          newS3Url: null,
          errorMessage: null
        }]
      });
    }
  });

  timer.complete(`found ${pluraliseWithCount(groups.length, "committee file")} with external URLs`);
  return groups;
}

export async function scanForExternalContent(request: ContentMigrationScanRequest): Promise<ContentMigrationScanResult> {
  const timer = createProcessTimer("scanForExternalContent", debugLog);
  debugLog("scanForExternalContent:scan request:", request);

  const scanPromises: Promise<ContentMigrationGroup[]>[] = [];

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
  if (request.scanCommitteeFiles !== false) {
    scanPromises.push(scanCommitteeFiles(request.hostPattern));
  }

  const results = await Promise.all(scanPromises);
  const allGroups = results.flat().sort(sortBy("sourcePath"));

  const totalItems = allGroups.reduce((sum, group) => sum + group.items.length, 0);
  const scanDurationMs = timer.elapsed();

  timer.complete(`found ${pluraliseWithCount(totalItems, "item")} in ${pluraliseWithCount(allGroups.length, "group")}`);

  return {
    hostPattern: request.hostPattern,
    groups: allGroups,
    totalItems,
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
  }
}

function extractHostsFromColumn(column: PageContentColumn, hosts: Set<string>): void {
  if (column.imageSource) {
    extractHost(column.imageSource, hosts);
  }
  if (column.href && isExternalDocumentUrl(column.href)) {
    extractHost(column.href, hosts);
  }
  if (column.contentText) {
    extractHostsFromText(column.contentText, hosts);
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

  const [allMetadata, allPages, allCommitteeFiles] = await Promise.all([
    contentMetadata.find({}).exec(),
    pageContent.find({}).exec(),
    committeeFile.find({}).exec()
  ]);
  timer.log(`queried ${pluraliseWithCount(allMetadata.length, "album")}, ${pluraliseWithCount(allPages.length, "page")}, ${pluraliseWithCount(allCommitteeFiles.length, "committee file")}`);

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

  allCommitteeFiles.forEach((doc: any) => {
    const file: CommitteeFile = transforms.toObjectWithId(doc);
    const awsFileName = file.fileNameData?.awsFileName;
    if (awsFileName && isExternalDocumentUrl(awsFileName)) {
      extractHost(awsFileName, hosts);
    }
  });

  const uniqueHosts = Array.from(hosts).sort();
  timer.complete(`found ${pluraliseWithCount(uniqueHosts.length, "unique host")}: ${JSON.stringify(uniqueHosts)}`);
  return uniqueHosts;
}
