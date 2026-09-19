import { JSDOM } from "jsdom";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("site-registration-content"));
import {
  RegistrationMigrationTemplate, RegistrationNavbarPath, RegistrationNavbarTitle, RegistrationPage, RegistrationPageType,
  RegistrationDiscoveryReporter, RegistrationSiteFlavour, StoredSiteRegistration
} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { ParentPageMode, SiteMigrationConfig } from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import { createAllImagesLayoutTransformationConfig, createDefaultTransformationConfig, ContentMatchType, PageTransformationConfig, TransformationActionType } from "../../../projects/ngx-ramblers/src/app/models/page-transformation.model";
import { PageContent, PageContentRow, PageContentType } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { MigratedAlbum } from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { fetchPublicSiteHtml, publicSiteUrl } from "./public-site-fetch";
import { httpRequest, optionalParameter } from "../shared/message-handlers";
import { systemConfig } from "../config/system-config";
import * as requestDefaults from "../ramblers/request-defaults";
import { DateFormat, RamblersEventType, RamblersEventsApiResponse } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { dateTimeNow } from "../shared/dates";
import { chunk, isEmpty } from "es-toolkit/compat";
import { toKebabCase } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import { CONTACT_US_TYPE } from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import { assembleRegistrationPages, isRegistrationFeaturePath, proposedRegistrationNavigation, unusedRegistrationPath } from "../../../projects/ngx-ramblers/src/app/functions/registration-page-tree";

export { proposedRegistrationNavigation };

const MAX_DISCOVERED_PAGES = 250;
const MAX_CRAWLED_PAGES = 250;
const CRAWL_BATCH_SIZE = 5;
const menuSelectors: Record<RegistrationSiteFlavour, string> = {
  [RegistrationSiteFlavour.GENERIC]: "nav a, header a, a[href]",
  [RegistrationSiteFlavour.RAMBLERSWEBS]: ".BMenu a",
  [RegistrationSiteFlavour.WORDPRESS]: ".wp-block-navigation a, .main-navigation a, nav a"
};
const contentSelectors: Record<RegistrationSiteFlavour, string> = {
  [RegistrationSiteFlavour.GENERIC]: "#BContent, main, article, #content, [role=main]",
  [RegistrationSiteFlavour.RAMBLERSWEBS]: "#BContent",
  [RegistrationSiteFlavour.WORDPRESS]: ".entry-content, .wp-block-post-content, main, article, [role=main]"
};

const MIN_PAGES_FOR_LAYOUT_IMAGE = 3;
const LAYOUT_IMAGE_PAGE_SHARE = 0.75;
const IMAGES_PER_ROW = 2;
const HALF_WIDTH_COLUMNS = 6;

const CONTACT_PAGE_LINK = /\[([^\]]+)\]\(([^)\s]*(?:component\/contact\/|option=com_contact)[^)\s]*)\)/gi;

const CONTACT_ROLE_KEYWORDS: {role: string; keywords: string[]}[] = [
  {role: "membership", keywords: ["membership", "member"]},
  {role: "treasurer", keywords: ["treasurer", "treasury", "finance"]},
  {role: "chairman", keywords: ["chair"]},
  {role: "walks", keywords: ["walk", "footpath", "rights of way"]},
  {role: "social", keywords: ["social", "event"]},
  {role: "publicity", keywords: ["publicity", "press", "media"]},
  {role: "webmaster", keywords: ["webmaster", "website", "web"]},
  {role: "secretary", keywords: ["secretary"]}
];

export function contactUsRoleFor(text: string): string {
  const haystack = (text || "").toLowerCase();
  return CONTACT_ROLE_KEYWORDS.find(entry => entry.keywords.some(keyword => haystack.includes(keyword)))?.role || CONTACT_US_TYPE;
}

export function withContactUsLinks(text: string, redirectPath: string): string {
  return (text || "").replace(CONTACT_PAGE_LINK, (match, label, href) => {
    const role = contactUsRoleFor(`${label} ${href}`);
    const redirect = (redirectPath || "").replace(/^\/+/, "");
    return redirect ? `[${label}](?contact-us&role=${role}&redirect=${redirect})` : `[${label}](?contact-us&role=${role})`;
  });
}

export function isRamblersWalksListing(path: string, title = "", sourcePath = ""): boolean {
  const leaf = path.split("/").pop() || "";
  const sourceLeaf = sourcePath.split("/").pop() || "";
  const normalisedTitle = title.trim().toLowerCase();
  return /^(walks|walks-programme|walk-programme|walks-calendar|programme|our-walks|upcoming-walks)$/.test(leaf)
    || /^(walks|walks-programme|walk-programme|walks-calendar|programme|our-walks|upcoming-walks)$/.test(sourceLeaf)
    || /^(walks|walks programme|our walks|programme|walks calendar|walk calendar|upcoming walks)$/.test(normalisedTitle);
}

export function registrationPageType(path: string, title = "", sourcePath = ""): RegistrationPageType {
  const haystack = `${path} ${title}`.toLowerCase();
  if (isRamblersWalksListing(path, title, sourcePath)) {
    return RegistrationPageType.WALKS;
  } else if (/contact|committee/.test(haystack)) {
    return RegistrationPageType.CONTACT;
  } else if (/photos|gallery|album/.test(haystack)) {
    return RegistrationPageType.GALLERY;
  } else {
    return RegistrationPageType.TEXT;
  }
}

export function discoverRegistrationPages(html: string, website: string): {pages: RegistrationPage[]; flavour: RegistrationSiteFlavour} {
  const document = new JSDOM(html, {url: website}).window.document;
  const base = publicSiteUrl(website);
  const flavour = document.querySelector(".BMenu") ? RegistrationSiteFlavour.RAMBLERSWEBS
    : document.querySelector('meta[name="generator"][content*="WordPress"], link[href*="wp-content"]') ? RegistrationSiteFlavour.WORDPRESS : RegistrationSiteFlavour.GENERIC;
  const items: {url: string; title: string; parentTitle: string; sourcePath: string}[] = [];
  document.querySelectorAll<HTMLAnchorElement>(menuSelectors[flavour]).forEach(link => {
    try {
      const url = new URL(link.href, base);
      const samePublicHost = url.origin === base.origin && !url.username && !url.password && (!url.port || ["80", "443"].includes(url.port));
      if (samePublicHost) {
        const sourcePath = url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.(html?|php|aspx?)$/i, "") || "home";
        const title = link.textContent?.replace(/\s+/g, " ").trim();
        const parentLink = link.closest("li")?.parentElement?.closest("li")?.querySelector<HTMLAnchorElement>(":scope > a[href]");
        const parentTitle = parentLink?.textContent?.replace(/\s+/g, " ").trim() || "";
        const sourceUrl = registrationSourceUrl(url.href);
        if (title && !/\.(jpe?g|png|gif|webp|svg|pdf|zip|docx?|xlsx?)$/i.test(url.pathname) &&
          !/^(admin|login|wp-admin|wp-json)(\/|$)/i.test(sourcePath) && !items.some(item => item.url === sourceUrl)) {
          items.push({url: sourceUrl, title, parentTitle, sourcePath});
        }
      }
    } catch (error) {
      debugLog("skipping source link %s: %s", link.href, error instanceof Error ? error.message : error);
    }
  });
  if (items.length > MAX_DISCOVERED_PAGES) {
    throw new Error(`The source page contains more than ${MAX_DISCOVERED_PAGES} internal page links. Reduce duplicate navigation before migration.`);
  }
  const used = new Set<string>();
  const pages = items.reduce((collected, item) => {
    const leaf = /^(index|home)?$/i.test(item.sourcePath) ? "home" : toKebabCase(item.title) || "page";
    const parentLeaf = item.parentTitle && !isRamblersWalksListing("", item.parentTitle, "") ? toKebabCase(item.parentTitle) : "";
    const parentPages = parentLeaf && parentLeaf !== leaf && !used.has(parentLeaf)
      ? (used.add(parentLeaf), [{url: item.url, path: parentLeaf, title: item.parentTitle, type: RegistrationPageType.INDEX, selected: true, parentPath: null as string, proposed: true}])
      : [];
    const path = unusedRegistrationPath(used, parentLeaf && parentLeaf !== leaf ? `${parentLeaf}/${leaf}` : leaf);
    return isRamblersWalksListing(path, item.title, item.sourcePath) ? collected : (used.add(path), [...collected, ...parentPages, {
      url: item.url, path, title: item.title, type: registrationPageType(path, item.title, item.sourcePath), selected: true,
      parentPath: path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : null, proposed: false, sourceTitle: item.title, imageUrls: []
    }]);
  }, [] as RegistrationPage[]);
  const pageUrl = registrationSourceUrl(website);
  const imageUrls = publicImageUrls(document, base);
  const withImages = pages.map(page => page.url === pageUrl ? {...page, imageUrls} : page);
  return {flavour, pages: withImages.filter(page => page.type !== RegistrationPageType.WALKS).sort((left, right) => left.path.localeCompare(right.path))};
}

function publicImageUrls(document: Document, base: URL): string[] {
  return [...document.querySelectorAll("img")].reduce((urls, image) => {
    try {
      const href = new URL(image.src, base).href;
      if (/^https?:/i.test(href) && !urls.includes(href)) {
        return [...urls, href].slice(0, 12);
      } else {
        return urls;
      }
    } catch (error) {
      return urls;
    }
  }, [] as string[]);
}

function rawQueryPart(part: string): string {
  const reencodedValueless = /^[^=]*(\+|%7E)[^=]*=$/i.test(part);
  if (reencodedValueless) {
    return encodeURIComponent(decodeURIComponent(part.slice(0, -1).replace(/\+/g, " ")));
  } else {
    return part;
  }
}

export function registrationSourceUrl(value: string): string {
  const url = publicSiteUrl(value);
  url.hash = "";
  url.pathname = url.pathname.replace(/\/(index|default)\.(html?|php|aspx?)$/i, "/");
  const keptQueryParts = url.search.replace(/^\?/, "").split("&")
    .filter(part => part.length > 0)
    .map(part => rawQueryPart(part))
    .filter(part => {
      const key = part.split("=")[0].toLowerCase();
      return !/^utm_/.test(key) && !["fbclid", "gclid"].includes(key);
    })
    .sort();
  url.search = keptQueryParts.length ? `?${keptQueryParts.join("&")}` : "";
  return url.href;
}

export function isNgxRamblersSite(html: string, website: string): boolean {
  const document = new JSDOM(html, {url: website}).window.document;
  const hostname = publicSiteUrl(website).hostname.toLowerCase();
  const ngxHostname = hostname === "ngx-ramblers.org.uk" || hostname.endsWith(".ngx-ramblers.org.uk");
  const ngxGenerator = document.querySelector('meta[name="generator"][content="NGX Ramblers"]');
  const existingNgxApplication = document.querySelector("app-root") &&
    document.querySelector('link[rel="manifest"][href="/manifest.webmanifest"]') &&
    document.querySelector('meta[name="theme-color"][content="#1b4332"]');
  return ngxHostname || !!ngxGenerator || !!existingNgxApplication;
}

export async function discoverRegistrationWebsite(website: string, groupCode = "", onProgress: RegistrationDiscoveryReporter = async () => undefined) {
  const initialUrl = publicSiteUrl(website).href;
  await onProgress({message: "Reading the home page", pagesRead: 0, pagesFound: 0});
  const initialHtml = await fetchPublicSiteHtml(initialUrl);
  if (isNgxRamblersSite(initialHtml, initialUrl)) {
    throw new Error("This website is already an NGX Ramblers site, so it does not need to be converted. Contact the platform administrator if you need help with it.");
  } else {
    const initial = discoverRegistrationPages(initialHtml, initialUrl);
    const document = new JSDOM(initialHtml, {url: initialUrl}).window.document;
    const sourceTitle = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() || document.title.replace(/\s+/g, " ").trim() || publicSiteUrl(initialUrl).hostname;
    const homePage: RegistrationPage = {url: initialUrl, path: "home", title: RegistrationNavbarTitle.HOME, type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false};
    const initialPages = initial.pages.some(page => page.path === RegistrationNavbarPath.HOME) ? initial.pages : [homePage, ...initial.pages.filter(page => page.path !== "home")];
    await onProgress({message: `Read the home page and found ${initialPages.length} pages linked from it`, pagesRead: 1, pagesFound: initialPages.length});
    const discovered = await crawlRegistrationPages(initialPages, initial.flavour, new Set([initialUrl]), initialPages.filter(page => !page.proposed).map(page => page.url), onProgress);
    await onProgress({message: "Checking Walks Manager for the group's walks and events", pagesRead: 0, pagesFound: discovered.pages.length});
    const hasWalks = await groupHasRamblersEvents(groupCode, RamblersEventType.GROUP_WALK, true);
    const hasSocialEvents = await groupHasRamblersEvents(groupCode, RamblersEventType.GROUP_EVENT, false);
    await onProgress({message: "Arranging the pages into the navbar", pagesRead: 0, pagesFound: discovered.pages.length});
    const navigationPages = assembleRegistrationPages(discovered.pages, hasWalks, hasSocialEvents);
    return {flavour: discovered.flavour, pages: navigationPages, proposedNavigation: proposedRegistrationNavigation(navigationPages)};
  }
}

async function crawlRegistrationPages(pages: RegistrationPage[], flavour: RegistrationSiteFlavour, visited: Set<string>, queue: string[], onProgress: RegistrationDiscoveryReporter): Promise<{pages: RegistrationPage[]; flavour: RegistrationSiteFlavour}> {
  const candidates = [...new Set(queue)].filter(url => !visited.has(url));
  if (!candidates.length) {
    return {pages: finaliseRegistrationPages(pages), flavour};
  } else if (visited.size >= MAX_CRAWLED_PAGES || pages.length >= MAX_DISCOVERED_PAGES) {
    throw new Error(`The source site exceeds the ${MAX_CRAWLED_PAGES}-page migration safety limit. No partial migration has been created.`);
  } else {
    const batch = candidates.slice(0, Math.min(CRAWL_BATCH_SIZE, MAX_CRAWLED_PAGES - visited.size));
    const remaining = candidates.slice(batch.length);
    const discoveries = await Promise.all(batch.map(async url => {
      const discovery = discoverRegistrationPages(await fetchPublicSiteHtml(url), url);
      return {...discovery, pages: pagesFoundOn(pages, url, discovery.pages)};
    }));
    const nextPages = mergeRegistrationPages([...pages, ...discoveries.flatMap(discovery => discovery.pages)]);
    const nextQueue = [...remaining, ...discoveries.flatMap(discovery => discovery.pages).filter(page => !page.proposed && !visited.has(page.url)).map(page => page.url)];
    const nextFlavour = flavour === RegistrationSiteFlavour.GENERIC ? discoveries.find(discovery => discovery.flavour !== RegistrationSiteFlavour.GENERIC)?.flavour || flavour : flavour;
    const nextVisited = new Set([...visited, ...batch]);
    await onProgress({message: `Read ${publicSiteUrl(batch[batch.length - 1]).pathname}`, pagesRead: nextVisited.size, pagesFound: nextPages.length});
    return crawlRegistrationPages(nextPages, nextFlavour, nextVisited, nextQueue, onProgress);
  }
}

export function pagesFoundOn(knownPages: RegistrationPage[], foundOnUrl: string, discovered: RegistrationPage[]): RegistrationPage[] {
  const foundOn = knownPages.find(page => page.url === foundOnUrl && !page.proposed);
  if (!foundOn || foundOn.path === RegistrationNavbarPath.HOME) {
    return discovered;
  } else {
    return discovered.filter(page => !page.proposed).map(page => knownPages.some(known => known.url === page.url) ? page : {
      ...page, path: `${foundOn.path}/${page.path.split("/").pop()}`, parentPath: foundOn.path
    });
  }
}

export function mergeRegistrationPages(pages: RegistrationPage[]): RegistrationPage[] {
  const sourcePages = pages.filter(page => !page.proposed).reduce((found, page) => {
    if (!found.some(existing => existing.url === page.url)) {
      return [...found, page];
    } else {
      return found.map(existing => existing.url === page.url
        ? {...existing, imageUrls: [...existing.imageUrls || [], ...page.imageUrls || []].filter((url, index, list) => list.indexOf(url) === index).slice(0, 12)}
        : existing);
    }
  }, [] as RegistrationPage[]);
  const used = new Set<string>();
  const resolvedParents = new Map<string, string>();
  const resolvedSources = sourcePages.map(page => {
    const path = unusedRegistrationPath(used, page.path);
    used.add(path);
    if (!resolvedParents.has(page.path)) {
      resolvedParents.set(page.path, path);
    }
    return {...page, path, parentPath: page.parentPath ? resolvedParents.get(page.parentPath) || page.parentPath : null};
  });
  const proposedPages = pages.filter(page => page.proposed).reduce((found, page) => {
    if (!used.has(page.path) && !found.some(existing => existing.path === page.path)) {
      return [...found, page];
    } else {
      return found;
    }
  }, [] as RegistrationPage[]);
  return [...resolvedSources, ...proposedPages].sort((left, right) => left.path.localeCompare(right.path));
}

function finaliseRegistrationPages(pages: RegistrationPage[]): RegistrationPage[] {
  return pages.map(page => pages.some(child => child.parentPath === page.path) ? {...page, type: RegistrationPageType.INDEX} : page).sort((left, right) => left.path.localeCompare(right.path));
}

async function groupHasRamblersEvents(groupCode: string, type: RamblersEventType, fallback: boolean): Promise<boolean> {
  if (!groupCode) {
    return fallback;
  } else {
    try {
      const config = await systemConfig();
      const defaults = requestDefaults.createApiRequestOptions(config);
      const params = [
        optionalParameter("groups", groupCode),
        optionalParameter("types", type),
        optionalParameter("date", dateTimeNow().toFormat(DateFormat.WALKS_MANAGER_API)),
        optionalParameter("date_end", dateTimeNow().plus({years: 1}).toFormat(DateFormat.WALKS_MANAGER_API)),
        optionalParameter("limit", 1)
      ].filter(item => !isEmpty(item)).join("&");
      const response = await httpRequest({
        apiRequest: {
          hostname: defaults.hostname, protocol: defaults.protocol, headers: defaults.headers, method: "get",
          path: `/api/volunteers/walksevents?api-key=${config?.national?.walksManager?.apiKey}&${params}`
        },
        debug: debugLog
      }) as RamblersEventsApiResponse;
      return (response.response?.data || []).length > 0;
    } catch (error) {
      debugLog("groupHasRamblersEvents failed", type, error);
      return fallback;
    }
  }
}

export function registrationTransformation(pageType: RegistrationPageType = RegistrationPageType.TEXT): PageTransformationConfig {
  const transformation: PageTransformationConfig = pageType === RegistrationPageType.GALLERY
    ? galleryRegistrationTransformation()
    : textRegistrationTransformation(pageType);
  return transformation;
}

function galleryRegistrationTransformation(): PageTransformationConfig {
  const gallery = createAllImagesLayoutTransformationConfig();
  return {...gallery, name: "Registration gallery", description: "Built-in registration gallery with linked source images"};
}

function textRegistrationTransformation(pageType: RegistrationPageType): PageTransformationConfig {
  const defaults = createDefaultTransformationConfig();
  const name = pageType === RegistrationPageType.CONTACT ? "Registration contact" : "Registration text and images";
  return {...defaults, name, steps: defaults.steps.map(step => step.type === TransformationActionType.ADD_ROW ? {
    ...step, rowConfig: {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12,
      nestedRows: {contentMatcher: {type: ContentMatchType.COLLECT_WITH_BREAKS, breakOnImage: true, groupTextWithImage: true},
        rowTemplate: {type: PageContentType.TEXT, maxColumns: 1, showSwiper: false}}
    }]}
  } : step)};
}

export function albumPhotoPaths(album: MigratedAlbum): string[] {
  return (album.album.files || [])
    .map(file => file.image)
    .filter(Boolean)
    .map(image => /^https?:\/\//i.test(image) ? image : `${album.album.rootFolder}/${album.album.name}/${image}`);
}

export function withIntroductionPhotos(pages: PageContent[], albums: MigratedAlbum[]): PageContent[] {
  const photos = albums.flatMap(albumPhotoPaths);
  const indexedChildPaths = new Set(pages
    .filter(page => (page.rows || []).some(row => row.type === PageContentType.ALBUM_INDEX))
    .flatMap(parent => pages.filter(child => child.path.startsWith(`${parent.path}/`) && child.path.split("/").length === parent.path.split("/").length + 1))
    .map(child => child.path));
  return photos.length === 0 ? pages : pages.reduce((placed, page) => {
    if (indexedChildPaths.has(page.path) && !rowsHaveImage(page.rows || [])) {
      return {pages: [...placed.pages, withPhotoUnderHeading(page, photos[placed.used % photos.length])], used: placed.used + 1};
    } else {
      return {pages: [...placed.pages, page], used: placed.used};
    }
  }, {pages: [] as PageContent[], used: 0}).pages;
}

function withPhotoUnderHeading(page: PageContent, photo: string): PageContent {
  return withRowsUnderHeading(page, [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, imageSource: photo, alt: ""}]}]);
}

export function withRowsUnderHeading(page: PageContent, added: PageContentRow[]): PageContent {
  const rows = page.rows || [];
  const headingRowIndex = rows.findIndex(row => (row.columns || []).length === 1 && /^#\s+/m.test(row.columns[0].contentText || ""));
  if (headingRowIndex === -1) {
    return {...page, rows: [...added, ...rows]};
  } else {
    const headingRow = rows[headingRowIndex];
    const lines = (headingRow.columns[0].contentText || "").trim().split("\n");
    const headingLine = lines.findIndex(line => /^#\s+/.test(line));
    const upToHeading = lines.slice(0, headingLine + 1).join("\n").trim();
    const remainder = lines.slice(headingLine + 1).join("\n").trim();
    const headingOnly = {...headingRow, columns: [{...headingRow.columns[0], contentText: upToHeading}]};
    const remainderRows = remainder ? [{...headingRow, columns: [{...headingRow.columns[0], contentText: remainder}]}] : [];
    return {...page, rows: [...rows.slice(0, headingRowIndex), headingOnly, ...added, ...remainderRows, ...rows.slice(headingRowIndex + 1)]};
  }
}

export function withPageHeading(page: PageContent, title: string): PageContent {
  const hasHeading = contentTexts(page.rows || []).some(text => /^#\s+/m.test(text)) || (page.rows || []).some(row => row.type === PageContentType.ALBUM_INDEX);
  return hasHeading || !title ? page : {...page, rows: [{type: PageContentType.TEXT, maxColumns: 1, showSwiper: false, columns: [{columns: 12, contentText: `# ${title}`}]}, ...(page.rows || [])]};
}

function contentTexts(rows: PageContentRow[]): string[] {
  return rows.flatMap(row => (row.columns || []).flatMap(column => [column.contentText || "", ...contentTexts(column.rows || [])]));
}

export function withoutButtonsTo(rows: PageContentRow[], removedPaths: string[]): PageContentRow[] {
  return (rows || []).flatMap(row => {
    if (row.type !== PageContentType.ACTION_BUTTONS) {
      return [row];
    } else {
      const columns = (row.columns || []).filter(column => !removedPaths.includes((column.href || "").replace(/^\/+/, "")));
      return columns.length ? [{...row, columns}] : [];
    }
  });
}

export function withoutEmptyRows(rows: PageContentRow[]): PageContentRow[] {
  return (rows || []).flatMap(row => {
    if (row.type !== PageContentType.TEXT) {
      return [row];
    } else {
      const columns = (row.columns || []).map(column => column.rows ? {...column, rows: withoutEmptyRows(column.rows)} : column)
        .filter(column => (column.contentText || "").trim() || column.imageSource || column.rows?.length || column.href || column.title);
      return columns.length ? [{...row, columns}] : [];
    }
  });
}

function rowsHaveImage(rows: PageContentRow[]): boolean {
  return rows.some(row => row.type === PageContentType.ALBUM || (row.columns || []).some(column => !!column.imageSource || rowsHaveImage(column.rows || [])));
}

export function importedPagePath(pagePath: string, sourcePages: RegistrationPage[], assembledPages: RegistrationPage[]): string {
  const lastSegment = (path: string) => path.split("/").pop() || path;
  const exact = assembledPages.find(item => item.path === pagePath);
  const sourcePage = sourcePages.find(item => item.path === pagePath) || sourcePages.find(item => lastSegment(item.path) === pagePath);
  const byUrl = sourcePage?.url && !sourcePage.proposed ? assembledPages.find(item => item.url === sourcePage.url && !item.proposed) : null;
  const bySegment = assembledPages.find(item => lastSegment(item.path) === pagePath);
  return (exact || byUrl || bySegment)?.path || pagePath;
}

export function earlierImportFilters(pagePaths: string[], albumNames: string[]) {
  return {
    pages: {path: {$nin: pagePaths, $not: /^fragments\//}, $or: [{debugLogs: {$exists: true}}, {path: /^gallery\//}]},
    albums: {rootFolder: RootFolder.siteContent, name: {$nin: albumNames, $regex: /^gallery\//}}
  };
}

export function withSourcePageAlbums(pages: PageContent[], albums: MigratedAlbum[]): PageContent[] {
  const leaf = (path: string) => (path || "").split("/").pop();
  return pages.map(page => {
    const albumRows = albums
      .filter(album => album.sourcePagePath && (
        page.path === album.sourcePagePath
        || page.path.endsWith(`/${album.sourcePagePath}`)
        || (leaf(page.path) === leaf(album.sourcePagePath) && page.path.split("/")[0] === album.sourcePagePath.split("/")[0])
      ))
      .map(album => album.pageContent?.rows?.[0])
      .filter(Boolean);
    return albumRows.length ? withRowsUnderHeading(page, albumRows) : page;
  });
}

export function pairedImageRows(rows: PageContentRow[]): PageContentRow[] {
  const runs = (rows || []).reduce((found, row) => {
    const previous = found[found.length - 1];
    if (imageOnlyRow(row) && previous?.images) {
      return [...found.slice(0, -1), {images: [...previous.images, row]}];
    } else if (imageOnlyRow(row)) {
      return [...found, {images: [row]}];
    } else {
      return [...found, {row: {...row, columns: (row.columns || []).map(column => column.rows ? {...column, rows: pairedImageRows(column.rows)} : column)}}];
    }
  }, [] as {images?: PageContentRow[]; row?: PageContentRow}[]);
  return runs.flatMap(run => run.images?.length > 1
    ? chunk(run.images, IMAGES_PER_ROW).map(pair => ({...pair[0], maxColumns: IMAGES_PER_ROW, columns: pair.map(imageRow => ({...imageRow.columns[0], columns: HALF_WIDTH_COLUMNS}))}))
    : run.images || [withoutSingleNestedRow(run.row)]);
}

function withoutSingleNestedRow(row: PageContentRow): PageContentRow {
  const column = row.columns?.length === 1 ? row.columns[0] : null;
  const nestedRow = column?.rows?.length === 1 && !column.contentText && !column.imageSource ? column.rows[0] : null;
  return nestedRow?.columns?.length ? {...nestedRow, marginTop: row.marginTop ?? nestedRow.marginTop, marginBottom: row.marginBottom ?? nestedRow.marginBottom} : row;
}

function imageOnlyRow(row: PageContentRow): boolean {
  const column = row.columns?.length === 1 ? row.columns[0] : null;
  return !!column?.imageSource && !column.contentText && !column.rows?.length;
}

export function repeatedLayoutImagePaths(pages: RegistrationPage[]): string[] {
  const pagesWithImages = pages.filter(page => page.imageUrls?.length);
  const threshold = Math.max(MIN_PAGES_FOR_LAYOUT_IMAGE, Math.ceil(pagesWithImages.length * LAYOUT_IMAGE_PAGE_SHARE));
  const counts = pagesWithImages.reduce((found, page) => {
    new Set(page.imageUrls.map(imagePathWithoutLeadingSlash).filter(Boolean)).forEach(path => found.set(path, (found.get(path) || 0) + 1));
    return found;
  }, new Map<string, number>());
  return [...counts.entries()].filter(([, count]) => count >= threshold).map(([path]) => path);
}

function imagePathWithoutLeadingSlash(imageUrl: string): string {
  try {
    return new URL(imageUrl).pathname.replace(/^\/+/, "");
  } catch (error) {
    return "";
  }
}

export function registrationMigrationConfig(registration: StoredSiteRegistration, requireSourceFidelity = true): SiteMigrationConfig {
  const selected = registration.pages.map(page => ({...page, selected: true}));
  const orphans = selected.filter(page => page.parentPath && !selected.some(parent => parent.path === page.parentPath));
  if (!selected.length) {
    throw new Error("No pages are chosen yet. Go back to Choose content and click Find pages.");
  } else if (orphans.length) {
    throw new Error(`${orphans.map(page => `${page.title} is under ${page.parentPath}`).join(", ")}, which is not in the page list any more. Go back to Choose content and click Find pages to rebuild the list, or move those pages under another section.`);
  }
  return {
    expanded: false, name: registration.group.name, baseUrl: registration.website, siteIdentifier: registration.environmentName,
    menuSelector: menuSelectors[registration.flavour],
    contentSelector: contentSelectors[registration.flavour],
    excludeSelectors: ["script", "style", "nav", "header", "footer", ".cookie-notice", ".wp-block-navigation", ".site-header", ".site-footer"],
    excludeImageUrls: repeatedLayoutImagePaths(registration.pages),
    galleryPathPrefixes: [`${RegistrationNavbarPath.PHOTOS}/`],
    enabled: true, uploadTos3: false, persistData: false, publicHtmlOnly: true, requireSourceFidelity,
    defaultPageTransformation: registrationTransformation(),
    parentPages: selected.filter(page => page.url && !isRegistrationFeaturePath(page.path) && !isRamblersWalksListing(page.path, page.title)).map(page => ({
      url: registrationSourceUrl(page.url), pathPrefix: page.path, parentPageMode: page.proposed ? ParentPageMode.INDEX : ParentPageMode.AS_IS,
      selectedChildren: page.type === RegistrationPageType.INDEX ? selected.filter(child => child.parentPath === page.path).map(child => ({path: registrationSourceUrl(child.url), contentPath: child.path, title: child.title})) : [],
      migrateChildren: false,
      templateFragmentId: registrationTemplateFor(registrationContentType(page)),
      pageTransformation: registrationTransformation(registrationContentType(page))
    }))
  };
}

export function registrationContentType(page: RegistrationPage): RegistrationPageType {
  return page.type === RegistrationPageType.INDEX && !page.proposed ? registrationPageType(page.path, page.title) : page.type;
}

function registrationTemplateFor(pageType: RegistrationPageType): RegistrationMigrationTemplate {
  if (pageType === RegistrationPageType.CONTACT) {
    return RegistrationMigrationTemplate.CONTACT;
  } else if (pageType === RegistrationPageType.GALLERY) {
    return RegistrationMigrationTemplate.GALLERY;
  } else if (pageType === RegistrationPageType.INDEX) {
    return RegistrationMigrationTemplate.CHILD_INDEX;
  } else {
    return RegistrationMigrationTemplate.TEXT_WITH_IMAGES;
  }
}
