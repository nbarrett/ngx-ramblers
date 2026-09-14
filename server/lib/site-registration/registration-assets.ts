import {AccessLevel} from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import {PageContent, PageContentRow, PageContentType} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {RegistrationContentLink, RegistrationNavbarPath, StoredSiteRegistration} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import {RootFolder} from "../../../projects/ngx-ramblers/src/app/models/system.model";
import {assembleRegistrationPages, unusedRegistrationPath} from "../../../projects/ngx-ramblers/src/app/functions/registration-page-tree";
import {toKebabCase} from "../../../projects/ngx-ramblers/src/app/functions/strings";
import {convertBufferToMarkdown} from "../document-conversion/document-conversion";
import {uploadMigrationBufferToS3} from "../migration/migration-file-upload";
import {fetchPublicSiteDocument} from "./public-site-fetch";
import {registrationSourceUrl} from "./registration-content";

const DOCUMENT_PATTERN = /\.(csv|docx?|gpx|ods|odt|pdf|pptx?|rtf|txt|xlsx?|zip)$/i;
const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;
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
      label: match[1], href: match[2], parentPath: page.path, sourcePageUrl: sourcePage
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

function documentSlug(link: RegistrationContentLink, title: string): string {
  const sourceFile = decodeURIComponent(new URL(link.href, link.sourcePageUrl).pathname.split("/").pop() || "document").replace(/\.[^.]+$/, "");
  return toKebabCase(title || link.label || sourceFile) || "document";
}

function rewriteRows(rows: PageContentRow[], replacements: Map<string, string>, pageMappings: Map<string, string>, sourcePage: string): PageContentRow[] {
  return (rows || []).map(row => ({...row, columns: (row.columns || []).map(column => ({
    ...column,
    contentText: column.contentText ? column.contentText.replace(MARKDOWN_LINK_PATTERN, (match, label, href) => {
      try {
        const resolved = new URL(href, sourcePage);
        const fragment = resolved.hash;
        resolved.hash = "";
        const replacement = replacements.get(resolved.href) || pageMappings.get(resolved.href);
        return replacement ? `[${label}](${replacement}${fragment})` : match;
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

export async function migrateRegistrationAssets(registration: StoredSiteRegistration, pages: PageContent[], bucket: string): Promise<PageContent[]> {
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
        replacements.set(href, `/api/aws/s3/${key}`);
      }
    } catch (error) {
      if (registration.migrationConfig?.requireSourceFidelity !== false) {
        throw new Error(`Could not import linked document ${href}: ${error.message}`);
      }
    }
  }
  const rewritten = rewriteRegistrationPageLinks(registration, pages, replacements);
  return [...rewritten, ...documentPages];
}
