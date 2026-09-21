import {AccessLevel} from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import {PageContent, PageContentRow, PageContentType} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";

import {MigratedAlbum} from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import {RegistrationContentLink, RegistrationMigratedAssets, RegistrationNavbarPath, StoredSiteRegistration} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";

import {assembleRegistrationPages, unusedRegistrationPath} from "../../../projects/ngx-ramblers/src/app/functions/registration-page-tree";
import {toKebabCase} from "../../../projects/ngx-ramblers/src/app/functions/strings";
import {convertBufferToMarkdown} from "../document-conversion/document-conversion";

import {fetchPublicSiteDocument, sourceUnavailable, withoutQuery} from "./public-site-fetch";
import {SourceSiteUnavailableError, sourceSiteLimiter} from "./source-site-limiter";
import {pluraliseWithCount} from "../shared/string-utils";
import {registrationSourceUrl} from "./registration-content";

const DOCUMENT_PATTERN = /\.(csv|docx?|gpx|ods|odt|pdf|pptx?|rtf|txt|xlsx?|zip)$/i;
const MARKDOWN_LINK_PATTERN = /(!?)\[([^\]]*)\]\(((?:\\\)|[^)])+)\)/g;
const MARKDOWN_IMAGE_PATTERN = /^!\[([^\]]*)\]\(([^)]+)\)$/;
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

function rewriteRows(rows: PageContentRow[], replacements: Map<string, string>, pageMappings: Map<string, string>, sourcePage: string): PageContentRow[] {
  return (rows || []).map(row => ({...row, columns: (row.columns || []).map(column => ({
    ...column,
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
        } else if (image) {
          return `![${label}](${resolved.href})`;
        } else if (!showsOwnAddress && resolved.host === new URL(sourcePage).host) {
          const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
          const lineEnd = text.indexOf("\n", offset) === -1 ? text.length : text.indexOf("\n", offset);
          const aloneOnLine = text.slice(lineStart, lineEnd).trim() === match;
          const siteHome = /^\/(index\.[a-z]+)?$/i.test(resolved.pathname) && !resolved.search;
          return aloneOnLine && siteHome ? "" : label;
        } else {
          return match;
        }
      } catch (error) {
        return match;
      }
    }) : column.contentText,
    rows: column.rows ? rewriteRows(column.rows, replacements, pageMappings, sourcePage) : column.rows
  }))}));
}

function pageLinkMappings(registration: StoredSiteRegistration): Map<string, string> {
  const assembled = assembleRegistrationPages(registration.pages || [],
    registration.proposedNavigation.some(item => item.path === RegistrationNavbarPath.WALKS),
    registration.proposedNavigation.some(item => item.path === RegistrationNavbarPath.EVENTS));
  return new Map(assembled.filter(page => page.url && !page.proposed).map(page => [sourceUrlWithoutFragment(page.url), page.path === "home" ? "/" : `/${page.path}`]));
}

export function rewriteRegistrationPageLinks(registration: StoredSiteRegistration, pages: PageContent[], replacements: Map<string, string> = new Map()): PageContent[] {
  const pageMappings = pageLinkMappings(registration);
  return pages.map(page => ({...page, rows: rewriteRows(page.rows, replacements, pageMappings, sourcePageUrl(registration, page.path))}));
}

export async function migrateRegistrationAssets(registration: StoredSiteRegistration, pages: PageContent[], albums: MigratedAlbum[], _bucket: string, onProgress: (message: string) => void = () => undefined): Promise<RegistrationMigratedAssets> {
  const links = documentLinks(registration, pages);
  const replacements = new Map<string, string>();
  const usedPaths = new Set(pages.map(page => page.path));
  const documentPages: PageContent[] = [];
  for (const link of links) {
    const href = sourceUrlWithoutFragment(new URL(link.href, link.sourcePageUrl).href);
    const sourceFile = decodeURIComponent(new URL(href).pathname.split("/").pop() || "document");
    if (/\.(jpe?g|png|gif|webp|svg|avif|bmp|tiff?)$/i.test(sourceFile)) {
      onProgress(`Left ${withoutQuery(href)} on the current website`);
    } else {
      try {
        const buffer = await fetchPublicSiteDocument(href);
        if (/\.(pdf|docx)$/i.test(sourceFile)) {
          const converted = await convertBufferToMarkdown(buffer, sourceFile);
          const path = unusedRegistrationPath(usedPaths, `${link.parentPath}/${documentSlug(link, converted.suggestedTitle || "")}`);
          usedPaths.add(path);
          documentPages.push({path, rows: convertedDocumentRows(converted.markdown)});
          replacements.set(href, `/${path}`);
        } else {
          onProgress(`Left ${withoutQuery(href)} on the current website`);
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
  }
  const rewritten = rewriteRegistrationPageLinks(registration, pages, replacements);
  const requests = sourceSiteLimiter.summary(registration.website);
  onProgress(`Downloaded ${pluraliseWithCount(requests.requests, "file")} from ${requests.host}, averaging ${requests.averageResponseMs}ms, with ${pluraliseWithCount(requests.retries, "retry", "retries")}`);
  const albumsWithPhotos = albums.filter(album => (album.album.files || []).length > 0);
  return {pages: [...rewritten, ...documentPages], albums: albumsWithPhotos};
}
