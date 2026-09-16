import {chunk} from "es-toolkit/compat";
import sharp from "sharp";
import {AccessLevel} from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import {PageContent, PageContentRow, PageContentType} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {S3_BASE_URL} from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";
import {MigratedAlbum} from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import {RegistrationContentLink, RegistrationMigratedAssets, RegistrationNavbarPath, StoredSiteRegistration} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import {RootFolder} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {assembleRegistrationPages, unusedRegistrationPath} from "../../../projects/ngx-ramblers/src/app/functions/registration-page-tree";
import {toKebabCase} from "../../../projects/ngx-ramblers/src/app/functions/strings";
import {convertBufferToMarkdown} from "../document-conversion/document-conversion";
import {uploadMigrationBufferToS3} from "../migration/migration-file-upload";
import {fetchPublicSiteDocument, fetchPublicSiteImage, sourceUnavailable, withoutQuery} from "./public-site-fetch";
import {SourceSiteUnavailableError, sourceSiteLimiter} from "./source-site-limiter";
import {pluraliseWithCount} from "../shared/string-utils";
import {registrationSourceUrl} from "./registration-content";

const DOCUMENT_PATTERN = /\.(csv|docx?|gpx|ods|odt|pdf|pptx?|rtf|txt|xlsx?|zip)$/i;
const MARKDOWN_LINK_PATTERN = /(!?)\[([^\]]*)\]\(((?:\\\)|[^)])+)\)/g;
const MARKDOWN_IMAGE_PATTERN = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const REMOTE_IMAGE_PATTERN = /^https?:\/\//i;
const IMAGE_UPLOAD_BATCH_SIZE = 8;
const MIN_PHOTO_WIDTH = 150;
const MIN_PHOTO_HEIGHT = 100;

export function tooSmallForPhoto(width: number, height: number): boolean {
  return !!width && !!height && (width < MIN_PHOTO_WIDTH || height < MIN_PHOTO_HEIGHT);
}

function sourceUrlWithoutFragment(value: string): string {
  return registrationSourceUrl(value);
}

function sourcePageUrl(registration: StoredSiteRegistration, targetPath: string): string {
  const assembled = assembleRegistrationPages(registration.pages || [],
    registration.proposedNavigation.some(item => item.path === RegistrationNavbarPath.WALKS),
    registration.proposedNavigation.some(item => item.path === RegistrationNavbarPath.EVENTS));
  return assembled.find(page => page.path === targetPath)?.url || registration.pages.find(page => page.path === targetPath)?.url || registration.website;
}

function contentLinks(registration: StoredSiteRegistration, pages: PageContent[]): RegistrationContentLink[] {
  return pages.flatMap(page => {
    const sourcePage = sourcePageUrl(registration, page.path);
    return contentTextValues(page.rows || []).flatMap(text => [...text.matchAll(MARKDOWN_LINK_PATTERN)].map(match => ({
      label: match[2], href: linkAddress(match[3]), parentPath: page.path, sourcePageUrl: sourcePage
    })));
  });
}

function contentTextValues(rows: PageContentRow[]): string[] {
  return rows.flatMap(row => (row.columns || []).flatMap(column => [column.contentText || "", ...contentTextValues(column.rows || [])]));
}

function remoteImageSources(rows: PageContentRow[]): string[] {
  return (rows || []).flatMap(row => (row.columns || []).flatMap(column => [
    ...(column.imageSource && REMOTE_IMAGE_PATTERN.test(column.imageSource) ? [column.imageSource] : []),
    ...remoteImageSources(column.rows || [])
  ]));
}

function documentLinks(registration: StoredSiteRegistration, pages: PageContent[]): RegistrationContentLink[] {
  return contentLinks(registration, pages).filter(link => {
    try {
      return DOCUMENT_PATTERN.test(new URL(link.href, link.sourcePageUrl).pathname);
    } catch (error) {
      return false;
    }
  }).reduce((found, link) => {
    const href = sourceUrlWithoutFragment(new URL(link.href, link.sourcePageUrl).href);
    return found.some(existing => sourceUrlWithoutFragment(new URL(existing.href, existing.sourcePageUrl).href) === href) ? found : [...found, link];
  }, [] as RegistrationContentLink[]);
}

function convertedDocumentRows(markdown: string): PageContentRow[] {
  return markdown.split(/(!\[[^\]]*\]\([^)]+\))/g).map(value => value.trim()).filter(Boolean).map(value => {
    const image = value.match(MARKDOWN_IMAGE_PATTERN);
    if (image) {
      return {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC, imageSource: image[2], alt: image[1]}]};
    } else {
      return {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, accessLevel: AccessLevel.PUBLIC, contentText: value}]};
    }
  });
}

const GENERIC_LINK_LABEL = /^(click here|here|download|pdf|read more|more|link|view|open|this)$/i;

export function documentSlug(link: RegistrationContentLink, title: string): string {
  const sourceFile = decodeURIComponent(new URL(link.href, link.sourcePageUrl).pathname.split("/").pop() || "document").replace(/\.[^.]+$/, "");
  const label = (link.label || "").replace(/[*_`]/g, "").trim();
  const meaningfulLabel = label && !GENERIC_LINK_LABEL.test(label) && label !== sourceFile ? label : "";
  return toKebabCase(meaningfulLabel || title || sourceFile) || "document";
}

function linkAddress(target: string): string {
  return target.trim().split(/\s+["']/)[0].replace(/\\([()])/g, "$1");
}

function rewriteRows(rows: PageContentRow[], replacements: Map<string, string>, pageMappings: Map<string, string>, sourcePage: string, imageKeys: Map<string, string>, unavailableImages: Set<string>): PageContentRow[] {
  return (rows || []).map(row => ({...row, columns: (row.columns || []).map(column => ({
    ...column,
    imageSource: column.imageSource && unavailableImages.has(column.imageSource) ? null : column.imageSource ? imageKeys.get(column.imageSource) || column.imageSource : column.imageSource,
    contentText: column.contentText ? column.contentText.replace(MARKDOWN_LINK_PATTERN, (match, image, label, target, offset, text) => {
      try {
        const href = linkAddress(target);
        const resolved = new URL(href, sourcePage);
        const fragment = resolved.hash;
        resolved.hash = "";
        const showsOwnAddress = label.trim() === href.trim();
        const replacement = showsOwnAddress ? null : replacements.get(resolved.href) || pageMappings.get(resolved.href);
        if (replacement) {
          return `${image}[${label}](${replacement}${fragment})`;
        } else if (!showsOwnAddress && resolved.host === new URL(sourcePage).host) {
          const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
          const lineEnd = text.indexOf("\n", offset) === -1 ? text.length : text.indexOf("\n", offset);
          const aloneOnLine = text.slice(lineStart, lineEnd).trim() === match;
          const siteHome = /^\/(index\.[a-z]+)?$/i.test(resolved.pathname) && !resolved.search;
          return image || (aloneOnLine && siteHome) ? "" : label;
        } else {
          return match;
        }
      } catch (error) {
        return match;
      }
    }) : column.contentText,
    rows: column.rows ? rewriteRows(column.rows, replacements, pageMappings, sourcePage, imageKeys, unavailableImages) : column.rows
  }))}));
}

function pageLinkMappings(registration: StoredSiteRegistration): Map<string, string> {
  const assembled = assembleRegistrationPages(registration.pages || [],
    registration.proposedNavigation.some(item => item.path === RegistrationNavbarPath.WALKS),
    registration.proposedNavigation.some(item => item.path === RegistrationNavbarPath.EVENTS));
  return new Map(assembled.filter(page => page.url && !page.proposed).map(page => [sourceUrlWithoutFragment(page.url), page.path === "home" ? "/" : `/${page.path}`]));
}

export function rewriteRegistrationPageLinks(registration: StoredSiteRegistration, pages: PageContent[], replacements: Map<string, string> = new Map(), imageKeys: Map<string, string> = new Map(), unavailableImages: Set<string> = new Set()): PageContent[] {
  const pageMappings = pageLinkMappings(registration);
  return pages.map(page => ({...page, rows: rewriteRows(page.rows, replacements, pageMappings, sourcePageUrl(registration, page.path), imageKeys, unavailableImages)}));
}

async function uploadedImageKeys(sources: string[], bucket: string, rootFolder: string, onProgress: (message: string) => void, unavailableImages: Set<string>): Promise<Map<string, string>> {
  const unique = [...new Set(sources)];
  const uploads = await chunk(unique, IMAGE_UPLOAD_BATCH_SIZE).reduce(async (previous, batch) => {
    const uploaded = await previous;
    const batchUploads = await Promise.all(batch.map(async source => {
      try {
        const buffer = await fetchPublicSiteImage(source);
        const metadata = await sharp(buffer).metadata().catch(() => null);
        if (tooSmallForPhoto(metadata?.width, metadata?.height)) {
          unavailableImages.add(source);
          onProgress(`Left out image ${withoutQuery(source)}: at ${metadata.width} x ${metadata.height} pixels it is too small to be a photo`);
          return null;
        } else {
          return [source, await uploadMigrationBufferToS3(bucket, source, buffer, rootFolder)] as [string, string];
        }
      } catch (error) {
        if (error instanceof SourceSiteUnavailableError) {
          throw error;
        } else if (sourceUnavailable(error)) {
          unavailableImages.add(source);
          onProgress(`Left out image ${withoutQuery(source)}: the current website no longer has it (${error.message})`);
        } else {
          onProgress(`Kept original image URL ${withoutQuery(source)}: ${error.message}`);
        }
        return null;
      }
    }));
    return [...uploaded, ...batchUploads.filter(Boolean)];
  }, Promise.resolve([] as [string, string][]));
  return new Map(uploads);
}

async function migrateAlbumImages(album: MigratedAlbum, bucket: string, onProgress: (message: string) => void): Promise<MigratedAlbum> {
  const files = album.album.files || [];
  const remote = files.map(file => file.image).filter(image => image && REMOTE_IMAGE_PATTERN.test(image));
  const unavailableImages = new Set<string>();
  const imageKeys = await uploadedImageKeys(remote, bucket, `${album.album.rootFolder}/${album.album.name}`, onProgress, unavailableImages);
  return {
    ...album,
    album: {...album.album, files: files.filter(file => !unavailableImages.has(file.image)).map(file => imageKeys.has(file.image) ? {...file, image: imageKeys.get(file.image).split("/").pop()} : file)}
  };
}

export async function migrateRegistrationAssets(registration: StoredSiteRegistration, pages: PageContent[], albums: MigratedAlbum[], bucket: string, onProgress: (message: string) => void = () => undefined): Promise<RegistrationMigratedAssets> {
  const links = documentLinks(registration, pages);
  const replacements = new Map<string, string>();
  const usedPaths = new Set(pages.map(page => page.path));
  const documentPages: PageContent[] = [];
  for (const link of links) {
    const href = sourceUrlWithoutFragment(new URL(link.href, link.sourcePageUrl).href);
    try {
      const buffer = await fetchPublicSiteDocument(href);
      const sourceFile = decodeURIComponent(new URL(href).pathname.split("/").pop() || "document");
      if (/\.(pdf|docx)$/i.test(sourceFile)) {
        const converted = await convertBufferToMarkdown(buffer, sourceFile, image => uploadMigrationBufferToS3(bucket, image.name, image.buffer));
        const path = unusedRegistrationPath(usedPaths, `${link.parentPath}/${documentSlug(link, converted.suggestedTitle || "")}`);
        usedPaths.add(path);
        documentPages.push({path, rows: convertedDocumentRows(converted.markdown)});
        replacements.set(href, `/${path}`);
      } else {
        const key = await uploadMigrationBufferToS3(bucket, sourceFile, buffer, RootFolder.siteContent);
        replacements.set(href, `/${S3_BASE_URL}/${key}`);
      }
    } catch (error) {
      if (error instanceof SourceSiteUnavailableError) {
        throw error;
      } else if (sourceUnavailable(error)) {
        onProgress(`Kept original link to ${withoutQuery(href)}: the link no longer works (${error.message})`);
      } else if (registration.migrationConfig?.requireSourceFidelity !== false) {
        throw new Error(`Could not import linked document ${withoutQuery(href)}: ${error.message}`);
      }
    }
  }
  const unavailableImages = new Set<string>();
  const imageKeys = await uploadedImageKeys(pages.flatMap(page => remoteImageSources(page.rows || [])), bucket, RootFolder.siteContent, onProgress, unavailableImages);
  imageKeys.forEach((key, source) => replacements.set(source, `/${S3_BASE_URL}/${key}`));
  const rewritten = rewriteRegistrationPageLinks(registration, pages, replacements, imageKeys, unavailableImages);
  const migratedAlbums = await albums.reduce(async (previous, album) => [...await previous, await migrateAlbumImages(album, bucket, onProgress)], Promise.resolve([] as MigratedAlbum[]));
  if (imageKeys.size > 0) {
    onProgress(`✅ Stored ${imageKeys.size} ${imageKeys.size === 1 ? "photo" : "photos"} with the new site`);
  }
  const requests = sourceSiteLimiter.summary(registration.website);
  onProgress(`Downloaded ${pluraliseWithCount(requests.requests, "file")} from ${requests.host}, averaging ${requests.averageResponseMs}ms, with ${pluraliseWithCount(requests.retries, "retry", "retries")}`);
  const albumsWithPhotos = migratedAlbums.filter(album => (album.album.files || []).length > 0);
  if (albumsWithPhotos.length < migratedAlbums.length) {
    onProgress(`Left out ${pluraliseWithCount(migratedAlbums.length - albumsWithPhotos.length, "album")} with no photos large enough to keep`);
  }
  return {pages: [...rewritten, ...documentPages], albums: albumsWithPhotos};
}
