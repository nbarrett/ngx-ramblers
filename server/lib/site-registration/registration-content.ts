import { JSDOM } from "jsdom";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("site-registration-content"));
import {
  RegistrationMigrationTemplate, RegistrationNavbarPath, RegistrationNavbarTitle, RegistrationPage, RegistrationPageType,
  RegistrationSiteFlavour, StoredSiteRegistration
} from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { ParentPageMode, SiteMigrationConfig } from "../../../projects/ngx-ramblers/src/app/models/migration-config.model";
import { createAllImagesLayoutTransformationConfig, createDefaultTransformationConfig, ContentMatchType, PageTransformationConfig, TransformationActionType } from "../../../projects/ngx-ramblers/src/app/models/page-transformation.model";
import { PageContentType } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { fetchPublicSiteHtml, publicSiteUrl } from "./public-site-fetch";
import { httpRequest, optionalParameter } from "../shared/message-handlers";
import { systemConfig } from "../config/system-config";
import * as requestDefaults from "../ramblers/request-defaults";
import { DateFormat, RamblersEventType, RamblersEventsApiResponse } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { dateTimeNow } from "../shared/dates";
import { isEmpty } from "es-toolkit/compat";
import { toKebabCase } from "../../../projects/ngx-ramblers/src/app/functions/strings";
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
  [RegistrationSiteFlavour.GENERIC]: "#BContent, main, article, #content",
  [RegistrationSiteFlavour.RAMBLERSWEBS]: "#BContent",
  [RegistrationSiteFlavour.WORDPRESS]: ".entry-content, .wp-block-post-content, main, article"
};

export function isRamblersWalksListing(path: string, title = "", sourcePath = ""): boolean {
  const leaf = path.split("/").pop() || "";
  const sourceLeaf = sourcePath.split("/").pop() || "";
  const normalisedTitle = title.trim().toLowerCase();
  return /^(walks|walks-programme|walk-programme|walks-calendar|programme|our-walks)$/.test(leaf)
    || /^(walks|walks-programme|walk-programme|walks-calendar|programme|our-walks)$/.test(sourceLeaf)
    || /^(walks|walks programme|our walks|programme|walks calendar|walk calendar)$/.test(normalisedTitle);
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
      const sourcePath = url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.(html?|php|aspx?)$/i, "") || "home";
      const title = link.textContent?.replace(/\s+/g, " ").trim();
      const parentLink = link.closest("li")?.parentElement?.closest("li")?.querySelector<HTMLAnchorElement>(":scope > a[href]");
      const parentTitle = parentLink?.textContent?.replace(/\s+/g, " ").trim() || "";
      const sourceUrl = registrationSourceUrl(url.href);
      if (url.origin === base.origin && title && !/\.(jpe?g|png|gif|webp|svg|pdf|zip|docx?|xlsx?)$/i.test(url.pathname) &&
        !/^(admin|login|wp-admin|wp-json)(\/|$)/i.test(sourcePath) && !items.some(item => item.url === sourceUrl)) {
        items.push({url: sourceUrl, title, parentTitle, sourcePath});
      }
    } catch (error) {
      if (!(error instanceof TypeError)) {
        throw error;
      }
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
      parentPath: path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : null, proposed: false
    }]);
  }, [] as RegistrationPage[]);
  return {flavour, pages: pages.filter(page => page.type !== RegistrationPageType.WALKS).sort((left, right) => left.path.localeCompare(right.path))};
}

export function registrationSourceUrl(value: string): string {
  const url = publicSiteUrl(value);
  url.hash = "";
  [...url.searchParams.keys()].filter(key => /^utm_/i.test(key) || ["fbclid", "gclid"].includes(key.toLowerCase())).forEach(key => url.searchParams.delete(key));
  url.searchParams.sort();
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

export async function discoverRegistrationWebsite(website: string, groupCode = "") {
  const initialUrl = publicSiteUrl(website).href;
  const initialHtml = await fetchPublicSiteHtml(initialUrl);
  if (isNgxRamblersSite(initialHtml, initialUrl)) {
    throw new Error("This website is already an NGX Ramblers site, so it does not need to be converted. Contact the platform administrator if you need help with it.");
  } else {
    const initial = discoverRegistrationPages(initialHtml, initialUrl);
    const document = new JSDOM(initialHtml, {url: initialUrl}).window.document;
    const sourceTitle = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() || document.title.replace(/\s+/g, " ").trim() || publicSiteUrl(initialUrl).hostname;
    const homePage: RegistrationPage = {url: initialUrl, path: "home", title: RegistrationNavbarTitle.HOME, type: RegistrationPageType.TEXT, selected: true, parentPath: null, proposed: false};
    const initialPages = initial.pages.some(page => page.path === RegistrationNavbarPath.HOME) ? initial.pages : [homePage, ...initial.pages.filter(page => page.path !== "home")];
    const discovered = await crawlRegistrationPages(initialPages, initial.flavour, new Set([initialUrl]), initialPages.filter(page => !page.proposed).map(page => page.url));
    const hasWalks = await groupHasRamblersEvents(groupCode, RamblersEventType.GROUP_WALK, true);
    const hasSocialEvents = await groupHasRamblersEvents(groupCode, RamblersEventType.GROUP_EVENT, false);
    const navigationPages = assembleRegistrationPages(discovered.pages, hasWalks, hasSocialEvents);
    return {...discovered, proposedNavigation: proposedRegistrationNavigation(navigationPages)};
  }
}

async function crawlRegistrationPages(pages: RegistrationPage[], flavour: RegistrationSiteFlavour, visited: Set<string>, queue: string[]): Promise<{pages: RegistrationPage[]; flavour: RegistrationSiteFlavour}> {
  const candidates = [...new Set(queue)].filter(url => !visited.has(url));
  if (!candidates.length) {
    return {pages: finaliseRegistrationPages(pages), flavour};
  } else if (visited.size >= MAX_CRAWLED_PAGES || pages.length >= MAX_DISCOVERED_PAGES) {
    throw new Error(`The source site exceeds the ${MAX_CRAWLED_PAGES}-page migration safety limit. No partial migration has been created.`);
  } else {
    const batch = candidates.slice(0, Math.min(CRAWL_BATCH_SIZE, MAX_CRAWLED_PAGES - visited.size));
    const remaining = candidates.slice(batch.length);
    const discoveries = await Promise.all(batch.map(async url => discoverRegistrationPages(await fetchPublicSiteHtml(url), url)));
    const nextPages = mergeRegistrationPages([...pages, ...discoveries.flatMap(discovery => discovery.pages)]);
    const nextQueue = [...remaining, ...discoveries.flatMap(discovery => discovery.pages).filter(page => !page.proposed && !visited.has(page.url)).map(page => page.url)];
    const nextFlavour = flavour === RegistrationSiteFlavour.GENERIC ? discoveries.find(discovery => discovery.flavour !== RegistrationSiteFlavour.GENERIC)?.flavour || flavour : flavour;
    return crawlRegistrationPages(nextPages, nextFlavour, new Set([...visited, ...batch]), nextQueue);
  }
}

export function mergeRegistrationPages(pages: RegistrationPage[]): RegistrationPage[] {
  const sourcePages = pages.filter(page => !page.proposed).reduce((found, page) => {
    if (!found.some(existing => existing.url === page.url)) {
      return [...found, page];
    } else {
      return found;
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

export function registrationMigrationConfig(registration: StoredSiteRegistration, requireSourceFidelity = true): SiteMigrationConfig {
  const selected = registration.pages.map(page => ({...page, selected: true}));
  if (!selected.length || selected.some(page => page.parentPath && !selected.some(parent => parent.path === page.parentPath))) {
    throw new Error("Select content and retain its parent indexes so every imported page can be reached.");
  }
  return {
    expanded: false, name: registration.group.name, baseUrl: registration.website, siteIdentifier: registration.environmentName,
    menuSelector: menuSelectors[registration.flavour],
    contentSelector: contentSelectors[registration.flavour],
    excludeSelectors: ["script", "style", "nav", "header", "footer", ".cookie-notice", ".wp-block-navigation", ".site-header", ".site-footer"],
    enabled: true, uploadTos3: true, persistData: false, publicHtmlOnly: true, requireSourceFidelity,
    defaultPageTransformation: registrationTransformation(),
    parentPages: selected.filter(page => page.url && !isRegistrationFeaturePath(page.path)).map(page => ({
      url: page.url, pathPrefix: page.path, parentPageMode: page.proposed ? ParentPageMode.INDEX : ParentPageMode.AS_IS,
      selectedChildren: page.type === RegistrationPageType.INDEX ? selected.filter(child => child.parentPath === page.path).map(child => ({path: child.url, contentPath: child.path, title: child.title})) : [],
      migrateChildren: false,
      templateFragmentId: registrationTemplateFor(page.type),
      pageTransformation: registrationTransformation(page.type)
    }))
  };
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
