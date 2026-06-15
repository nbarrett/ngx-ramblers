import { Request, Response } from "express";
import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { createErrorDebugLog } from "../../shared/error-debug-log";
import { dateTimeNowAsValue } from "../../shared/dates";
import { lastItemFrom, titleCase } from "../../shared/string-utils";
import { isQuoted } from "../../../../projects/ngx-ramblers/src/app/functions/strings";
import { excerptAround, matches, termOverlap } from "./site-search-matching";
import { pageContent } from "../models/page-content";
import { extendedGroupEvent } from "../models/extended-group-event";
import { BuiltInPath, PageContent, PageContentRow, USER_TEMPLATES_PATH_PREFIX } from "../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { EventSource, ExtendedGroupEvent } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { RamblersEventType } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { AccessLevel } from "../../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { SiteSearchRelevance, SiteSearchResult, SiteSearchResultType } from "../../../../projects/ngx-ramblers/src/app/models/site-search.model";
import { ApiAction } from "../../../../projects/ngx-ramblers/src/app/models/api-response.model";
import { DocumentField, GroupEventField } from "../../../../projects/ngx-ramblers/src/app/models/walk.model";

const searchLog: debug.Debugger = debug(envConfig.logNamespace("database:site-search"));
searchLog.enabled = true;
const errorDebugLog = createErrorDebugLog("database:site-search");

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 100;
const PAGE_INDEX_LIMIT = 3000;
const EVENT_INDEX_LIMIT = 6000;
const INDEX_TTL_MS = 30 * 60 * 1000;
const INDEX_BUILD_WAIT_MS = 25000;
const APPLICATION_SEGMENTS = [BuiltInPath.ADMIN, USER_TEMPLATES_PATH_PREFIX.split("/")[0]];

const LOCAL_ACTIVE_FILTER = {
  $or: [
    {[DocumentField.SOURCE]: {$ne: EventSource.LOCAL}},
    {[DocumentField.SOURCE]: EventSource.LOCAL, [GroupEventField.STATUS]: {$ne: "deleted"}}
  ]
};

interface SearchableSegment {
  text: string;
  level: AccessLevel;
}

interface PageEntry {
  path: string;
  title: string;
  breadcrumb: string;
  segments: SearchableSegment[];
}

interface EventEntry {
  type: SiteSearchResultType;
  title: string;
  path: string;
  breadcrumb: string;
  description: string;
  haystack: string;
  date: string;
  contactName: string;
}

interface SearchIndex {
  pages: PageEntry[];
  events: EventEntry[];
  builtAt: number;
}

let searchIndexCache: SearchIndex | null = null;
let searchIndexBuilding: Promise<SearchIndex> | null = null;

function accessibleLevels(user: any): AccessLevel[] {
  const levels = [AccessLevel.PUBLIC];
  if (user) {
    levels.push(AccessLevel.LOGGED_IN_MEMBER);
    if (user.committee) {
      levels.push(AccessLevel.COMMITTEE);
    }
    const admin = user.contentAdmin || user.memberAdmin || user.financeAdmin || user.treasuryAdmin || user.fileAdmin || user.walkAdmin || user.socialAdmin;
    if (admin) {
      levels.push(AccessLevel.ENVIRONMENT_ADMIN);
    }
  }
  return levels;
}

function titleFromPath(path: string): string {
  return titleCase((lastItemFrom(path) || path || "").replace(/-/g, " "));
}

function breadcrumbFromPath(path: string): string {
  const segments = (path || "").split("/").filter(segment => segment.length > 0);
  return segments.slice(0, -1).map(segment => titleCase(segment.replace(/-/g, " "))).join(" / ");
}

function collectSegments(rows: PageContentRow[], accumulator: SearchableSegment[]): SearchableSegment[] {
  (rows || []).forEach(row => {
    (row.columns || []).forEach(column => {
      const text = [column.contentText, column.title].filter(value => !!value).join(" ");
      if (text.trim().length > 0) {
        accumulator.push({text, level: column.accessLevel || AccessLevel.PUBLIC});
      }
      if (column.rows) {
        collectSegments(column.rows, accumulator);
      }
    });
  });
  return accumulator;
}

function firstSegmentOf(path: string): string {
  return (path || "").split("/").filter(segment => segment.length > 0)[0] || "";
}

function pathIncluded(page: PageContent): boolean {
  return !!page.path
    && !page.path.includes("#")
    && !APPLICATION_SEGMENTS.includes(firstSegmentOf(page.path))
    && !page.migrationTemplate?.isTemplate;
}

function pageVisible(entry: PageEntry, levels: AccessLevel[]): boolean {
  const hasAccessibleSegment = entry.segments.some(segment => levels.includes(segment.level));
  const hasRestrictedSegment = entry.segments.some(segment => !levels.includes(segment.level));
  return hasAccessibleSegment || !hasRestrictedSegment;
}

function toEventEntry(event: ExtendedGroupEvent): EventEntry | null {
  const groupEvent = event.groupEvent;
  if (!groupEvent?.title) {
    return null;
  }
  const isGroupEvent = groupEvent.item_type === RamblersEventType.GROUP_EVENT;
  const slug = lastItemFrom(groupEvent.url) || (event as any)._id?.toString() || event.id;
  const description = groupEvent.description || groupEvent.additional_details || "";
  const contactName = event.fields?.contactDetails?.displayName || "";
  return {
    type: isGroupEvent ? SiteSearchResultType.EVENT : SiteSearchResultType.WALK,
    title: groupEvent.title,
    path: `walks/${slug}`,
    breadcrumb: isGroupEvent ? "Events" : "Walks",
    description,
    haystack: [
      groupEvent.title,
      groupEvent.description,
      groupEvent.additional_details,
      groupEvent.location?.description,
      groupEvent.location?.postcode,
      groupEvent.start_location?.description,
      contactName
    ].filter(value => !!value).join(" "),
    date: groupEvent.start_date_time || "",
    contactName
  };
}

async function timed<T>(label: string, action: () => Promise<T>): Promise<T> {
  const start = dateTimeNowAsValue();
  try {
    const result = await action();
    searchLog("buildSearchIndex:", label, "completed in", dateTimeNowAsValue() - start, "ms");
    return result;
  } catch (error) {
    errorDebugLog("buildSearchIndex:", label, "failed after", dateTimeNowAsValue() - start, "ms:", error);
    throw error;
  }
}

async function buildSearchIndex(): Promise<SearchIndex> {
  const startedAt = dateTimeNowAsValue();
  searchLog("buildSearchIndex: starting full index build from database");
  const [pages, events] = await Promise.all([
    timed("page-content load", () => pageContent.find({}).select("path rows migrationTemplate").limit(PAGE_INDEX_LIMIT).lean().exec() as Promise<PageContent[]>),
    timed("events load", () => extendedGroupEvent.find(LOCAL_ACTIVE_FILTER)
      .select("id groupEvent.title groupEvent.description groupEvent.additional_details groupEvent.url groupEvent.item_type groupEvent.location groupEvent.start_location groupEvent.start_date_time fields.contactDetails.displayName")
      .limit(EVENT_INDEX_LIMIT).lean().exec() as Promise<ExtendedGroupEvent[]>)
  ]);
  const includedPages = pages.filter(pathIncluded);
  const pageEntries: PageEntry[] = includedPages.map(page => ({
    path: page.path,
    title: titleFromPath(page.path),
    breadcrumb: breadcrumbFromPath(page.path),
    segments: collectSegments(page.rows, [])
  }));
  const eventEntries: EventEntry[] = events.map(toEventEntry).filter(entry => !!entry);
  searchLog("buildSearchIndex: complete - loaded", pages.length, "page documents (", pageEntries.length, "indexed ),", events.length, "events (", eventEntries.length, "indexed ) - total", dateTimeNowAsValue() - startedAt, "ms");
  return {pages: pageEntries, events: eventEntries, builtAt: dateTimeNowAsValue()};
}

function ensureSearchIndex(): SearchIndex | null {
  const stale = !searchIndexCache || (dateTimeNowAsValue() - searchIndexCache.builtAt) >= INDEX_TTL_MS;
  if (stale && !searchIndexBuilding) {
    searchLog("ensureSearchIndex:", searchIndexCache ? "cache stale - triggering background rebuild" : "no cache yet - triggering initial build (this loads the full index and can take a while on a slow cluster)");
    searchIndexBuilding = buildSearchIndex()
      .then(built => {
        searchIndexCache = built;
        searchIndexBuilding = null;
        return built;
      })
      .catch(error => {
        searchIndexBuilding = null;
        errorDebugLog("buildSearchIndex failed:", error);
        return null;
      });
  }
  return searchIndexCache;
}

async function ensureSearchIndexReady(): Promise<SearchIndex | null> {
  const index = ensureSearchIndex();
  if (index) {
    return index;
  }
  const building = searchIndexBuilding;
  if (!building) {
    return null;
  }
  searchLog("ensureSearchIndexReady: index cold - awaiting in-flight build (up to", INDEX_BUILD_WAIT_MS, "ms)");
  return Promise.race([
    building,
    new Promise<SearchIndex | null>(resolve => setTimeout(() => resolve(null), INDEX_BUILD_WAIT_MS))
  ]);
}

function relevanceFor(titleMatch: boolean, secondaryMatches: number): SiteSearchRelevance {
  if (titleMatch) {
    return SiteSearchRelevance.HIGH;
  } else if (secondaryMatches >= 2) {
    return SiteSearchRelevance.MEDIUM;
  } else {
    return SiteSearchRelevance.LOW;
  }
}

function scanPage(entry: PageEntry, rawQuery: string, levels: AccessLevel[]): SiteSearchResult | null {
  if (!pageVisible(entry, levels)) {
    return null;
  }
  const accessibleSegments = entry.segments.filter(segment => levels.includes(segment.level));
  const titleMatch = matches(entry.title, rawQuery) || matches(entry.path, rawQuery);
  const matchingSegments = accessibleSegments.filter(segment => matches(segment.text, rawQuery));
  if (!titleMatch && matchingSegments.length === 0) {
    return null;
  }
  const excerptSource = matchingSegments[0]?.text || accessibleSegments[0]?.text || entry.title;
  const overlap = termOverlap([entry.title, entry.path, ...matchingSegments.map(segment => segment.text)].join(" "), rawQuery);
  return {
    type: SiteSearchResultType.PAGE,
    title: entry.title,
    path: entry.path,
    breadcrumb: entry.breadcrumb,
    excerpt: excerptAround(excerptSource, rawQuery),
    score: (titleMatch ? 5 : 0) + matchingSegments.length + overlap * 2,
    relevance: relevanceFor(titleMatch, matchingSegments.length),
    matchedIn: titleMatch ? "Title" : "Page content"
  };
}

function scanEvent(entry: EventEntry, rawQuery: string): SiteSearchResult | null {
  if (!matches(entry.haystack, rawQuery)) {
    return null;
  }
  const titleMatch = matches(entry.title, rawQuery);
  const descriptionMatch = matches(entry.description, rawQuery);
  const overlap = termOverlap(entry.haystack, rawQuery);
  return {
    type: entry.type,
    title: entry.title,
    path: entry.path,
    breadcrumb: entry.breadcrumb,
    excerpt: excerptAround(entry.description || entry.title, rawQuery),
    score: (titleMatch ? 5 : 0) + (descriptionMatch ? 2 : 0) + 1 + overlap * 2,
    relevance: relevanceFor(titleMatch, descriptionMatch ? 2 : 0),
    matchedIn: titleMatch ? "Title" : descriptionMatch ? "Description" : "Location",
    date: entry.date || undefined,
    contactName: entry.contactName || undefined
  };
}

function dedupe(results: SiteSearchResult[]): SiteSearchResult[] {
  const seen = new Set<string>();
  return results.filter(result => {
    const key = result.type === SiteSearchResultType.PAGE ? `page:${result.path}` : `event:${result.title.toLowerCase().trim()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function searchStatus(req: Request, res: Response): void {
  const builtAtMillis = searchIndexCache?.builtAt ?? null;
  const ageMinutes = builtAtMillis !== null ? Math.floor((dateTimeNowAsValue() - builtAtMillis) / 60000) : null;
  res.status(200).json({
    action: ApiAction.QUERY,
    response: {
      indexed: !!searchIndexCache,
      building: searchIndexBuilding !== null,
      pages: searchIndexCache?.pages.length ?? 0,
      events: searchIndexCache?.events.length ?? 0,
      builtAtMillis,
      ageMinutes,
      ttlMinutes: Math.round(INDEX_TTL_MS / 60000)
    }
  });
}

export function siteMapPages(req: Request, res: Response): void {
  const levels = accessibleLevels((req as any).user);
  const index = ensureSearchIndex();
  if (!index) {
    res.status(200).json({action: ApiAction.QUERY, response: [], indexing: true});
    return;
  }
  const paths = index.pages.filter(entry => pageVisible(entry, levels)).map(entry => entry.path);
  searchLog("siteMapPages: returning", paths.length, "accessible page paths for levels", levels);
  res.status(200).json({action: ApiAction.QUERY, response: paths, indexing: false});
}

export async function search(req: Request, res: Response): Promise<void> {
  const rawQuery = ((req.query.q as string) || "").trim();
  if (rawQuery.length < MIN_QUERY_LENGTH) {
    res.status(200).json({action: ApiAction.QUERY, request: {query: rawQuery}, response: [], total: 0});
    return;
  }
  const scope = ((req.query.scope as string) || "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
  const exact = req.query.exact === "1";
  const matchQuery = exact && !isQuoted(rawQuery) ? `"${rawQuery}"` : rawQuery;
  const startedAt = dateTimeNowAsValue();
  try {
    const levels = accessibleLevels((req as any).user);
    const index = req.query.wait === "1" ? await ensureSearchIndexReady() : ensureSearchIndex();
    if (!index) {
      searchLog("search: query", JSON.stringify(rawQuery), "- index still building, returning indexing flag");
      res.status(200).json({action: ApiAction.QUERY, request: {query: rawQuery}, response: [], total: 0, indexing: true});
      return;
    }
    const pageResults = index.pages.map(entry => scanPage(entry, matchQuery, levels)).filter(result => !!result);
    const eventResults = index.events.map(entry => scanEvent(entry, matchQuery)).filter(result => !!result);
    const combined = pageResults.concat(eventResults);
    const scoped = scope ? combined.filter(result => result.path === scope || result.path.startsWith(`${scope}/`)) : combined;
    const ranked = dedupe(scoped.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title)));
    const response = ranked.slice(0, MAX_RESULTS);
    searchLog("search: query", JSON.stringify(rawQuery), "- matched", pageResults.length, "pages and", eventResults.length, "events, returning", response.length, "of", ranked.length, "total for levels", levels, "in", dateTimeNowAsValue() - startedAt, "ms");
    res.status(200).json({action: ApiAction.QUERY, request: {query: rawQuery}, response, total: ranked.length, indexing: false});
  } catch (error) {
    errorDebugLog("search failed for query", rawQuery, "after", dateTimeNowAsValue() - startedAt, "ms - error:", error);
    res.status(500).json({message: "Site search failed", request: {query: rawQuery}, error: error?.message || error});
  }
}
