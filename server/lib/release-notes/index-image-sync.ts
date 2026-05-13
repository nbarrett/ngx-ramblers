import { isString } from "es-toolkit/compat";
import * as cms from "./cms-client.js";
import type { PageContent } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { pageHasImages } from "./image-detection.js";
import { refreshIndexPageContent, updateIndexPageContent } from "./content-generator.js";

export const REGULAR_INDEX_PATH = "how-to/committee/release-notes";
export const HUMANS_INDEX_PATH = "how-to/committee/release-notes-for-humans";
export const SUB_PAGE_PREFIX = "how-to/committee/release-notes/";

const ENTRY_LINE_REGEX = /^-\s*\[(.+?)\]\((.+?)\)(\s*📸)?\s*$/;

export interface IndexSyncStats {
  added: string[];
  removed: string[];
  appendedToHumans: string[];
}

export interface IndexSyncResult {
  inspected: number;
  withImages: number;
  regular: IndexSyncStats;
  humans: IndexSyncStats;
}

export interface IndexSyncOptions {
  dryRun?: boolean;
  log?: (message: string) => void;
}

interface IndexEntryFields {
  date: string;
  title: string;
  path: string;
  issueNumber: string | null;
}

const noopLog = (_: string): void => undefined;

export async function syncReleaseNotesIndexImages(
  auth: cms.CMSAuth,
  options: IndexSyncOptions = {}
): Promise<IndexSyncResult> {
  const log = options.log || noopLog;
  const dryRun = Boolean(options.dryRun);

  const allPages = await cms.fetchAllPages(auth);
  const imageStatusByPath = new Map<string, boolean>();
  for (const page of allPages) {
    if (!isString(page.path)) continue;
    if (!page.path.startsWith(SUB_PAGE_PREFIX)) continue;
    const tail = page.path.slice(SUB_PAGE_PREFIX.length);
    if (tail.length === 0 || tail.includes("/")) continue;
    imageStatusByPath.set(page.path, pageHasImages(page));
  }

  const inspected = imageStatusByPath.size;
  const withImages = Array.from(imageStatusByPath.values()).filter(Boolean).length;
  log(`Inspected ${inspected} top-level release-notes sub-pages; ${withImages} contain images.`);

  const regularPage = await cms.pageContent(auth, REGULAR_INDEX_PATH);
  if (!regularPage) {
    throw new Error(`Regular index page not found: ${REGULAR_INDEX_PATH}`);
  }

  const regularStats = await applyIndexRefresh(auth, regularPage, REGULAR_INDEX_PATH, imageStatusByPath, dryRun, log);

  const humansPage = await cms.pageContent(auth, HUMANS_INDEX_PATH);
  let humansStats: IndexSyncStats = { added: [], removed: [], appendedToHumans: [] };
  if (!humansPage) {
    log(`For-humans index page not found: ${HUMANS_INDEX_PATH} — skipping.`);
  } else {
    const regularEntries = extractIndexEntries(regularPage);
    const humansPaths = new Set(extractIndexEntries(humansPage).map(entry => entry.path));
    const missing = regularEntries.filter(entry =>
      imageStatusByPath.get(entry.path) === true && !humansPaths.has(entry.path)
    );

    log(`${HUMANS_INDEX_PATH}: ${missing.length} image-bearing entries missing from for-humans index.`);
    let merged = humansPage;
    for (const entry of missing) {
      log(`    + ${entry.path}`);
      merged = updateIndexPageContent(
        merged,
        { date: entry.date, title: entry.title, path: entry.path, issueNumber: entry.issueNumber },
        { allowUnassigned: true }
      );
    }

    const refreshStats = await applyIndexRefresh(auth, merged, HUMANS_INDEX_PATH, imageStatusByPath, dryRun, log);
    humansStats = {
      added: refreshStats.added,
      removed: refreshStats.removed,
      appendedToHumans: missing.map(entry => entry.path)
    };
  }

  return {
    inspected,
    withImages,
    regular: regularStats,
    humans: humansStats
  };
}

async function applyIndexRefresh(
  auth: cms.CMSAuth,
  page: PageContent,
  indexPath: string,
  imageStatusByPath: Map<string, boolean>,
  dryRun: boolean,
  log: (message: string) => void
): Promise<IndexSyncStats> {
  const beforeText = page.rows?.[0]?.columns?.[0]?.contentText ?? "";
  const refreshed = refreshIndexPageContent(page, {
    allowUnassigned: true,
    imageStatusByPath
  });
  const afterText = refreshed.rows?.[0]?.columns?.[0]?.contentText ?? "";

  const { added, removed } = diffCameraMarkers(beforeText, afterText);
  log(`${indexPath}: ${added.length} 📸 added, ${removed.length} 📸 removed.`);
  if (added.length > 0) {
    log("  + Added 📸 to:");
    for (const path of added) log(`    - ${path}`);
  }
  if (removed.length > 0) {
    log("  - Removed 📸 from:");
    for (const path of removed) log(`    - ${path}`);
  }

  if (beforeText === afterText) {
    log(`${indexPath}: no changes.`);
    return { added, removed, appendedToHumans: [] };
  }

  if (dryRun) {
    log(`${indexPath}: dry run - not saving.`);
    return { added, removed, appendedToHumans: [] };
  }

  if (!refreshed.id) {
    throw new Error(`Index page ${indexPath} has no id; cannot update.`);
  }

  await cms.updatePageContent(auth, refreshed.id, refreshed);
  log(`${indexPath}: saved.`);
  return { added, removed, appendedToHumans: [] };
}

function diffCameraMarkers(before: string, after: string): { added: string[]; removed: string[] } {
  const beforeMap = parseEntryCameraStatus(before);
  const afterMap = parseEntryCameraStatus(after);
  const added: string[] = [];
  const removed: string[] = [];
  for (const [path, hasCamera] of afterMap) {
    const previous = beforeMap.get(path);
    if (hasCamera && !previous) added.push(path);
    if (!hasCamera && previous) removed.push(path);
  }
  added.sort();
  removed.sort();
  return { added, removed };
}

function parseEntryCameraStatus(text: string): Map<string, boolean> {
  const status = new Map<string, boolean>();
  for (const rawLine of text.split("\n")) {
    const match = rawLine.trim().match(ENTRY_LINE_REGEX);
    if (!match) continue;
    const path = match[2].replace(/^\//, "");
    status.set(path, Boolean(match[3]));
  }
  return status;
}

function extractIndexEntries(page: PageContent): IndexEntryFields[] {
  const text = page.rows?.[0]?.columns?.[0]?.contentText ?? "";
  const entries: IndexEntryFields[] = [];
  for (const rawLine of text.split("\n")) {
    const fields = parseIndexEntry(rawLine);
    if (fields) entries.push(fields);
  }
  return entries;
}

function parseIndexEntry(line: string): IndexEntryFields | null {
  const match = line.trim().match(ENTRY_LINE_REGEX);
  if (!match) return null;
  const label = match[1];
  const path = match[2].replace(/^\//, "");
  const [dateSegment, ...rest] = label.split(" — ");
  const remainder = rest.join(" — ").trim();

  let title = remainder;
  let issueNumber: string | null = null;
  const issuePrefix = remainder.match(/^#(\d+)\s+—\s+(.*)$/);
  if (issuePrefix) {
    issueNumber = issuePrefix[1];
    title = issuePrefix[2];
  } else {
    const fromPath = path.match(/-issue-(\d+)$/);
    if (fromPath) issueNumber = fromPath[1];
  }

  return {
    date: dateSegment.trim(),
    title,
    path,
    issueNumber
  };
}
