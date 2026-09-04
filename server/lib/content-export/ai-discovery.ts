import { isString } from "es-toolkit/compat";
import { RELEASE_FEED_TYPE, ReleaseFeed, ReleaseFeedEntry } from "../../../projects/ngx-ramblers/src/app/models/release-feed.model";

export { RELEASE_FEED_TYPE };
export type { ReleaseFeed, ReleaseFeedEntry };

export const FOR_AI_PATH = "for-ai";
export const DEFAULT_RELEASE_FEED_LIMIT = 50;

const RELEASE_ENTRY_LINE = /^-\s*\[([^\]]+)\]\(([^)]+)\)(\s*📸)?\s*$/;

const OPTIONAL_HUB_PATHS = [
  "how-to/committee/release-notes",
  "how-to/committee/release-notes-for-humans",
  "how-to/technical-articles",
  "how-to"
];

export interface AiDiscoverySite {
  siteName: string;
  baseUrl: string;
}

export interface ParsedReleaseEntry {
  title: string;
  path: string;
  hasImages: boolean;
}

export interface SiteContentPaths {
  availablePaths: string[];
  releaseNotesIndexPath: string | null;
  releaseNotesHumansPath: string | null;
  documentationHubs: string[];
  keyPages: string[];
}

export function absoluteUrl(baseUrl: string, sitePath: string): string {
  const normalisedBase = (baseUrl || "").replace(/\/+$/, "");
  const normalisedPath = (sitePath || "").replace(/^\/+/, "");
  if (!normalisedPath) {
    return normalisedBase;
  }
  return `${normalisedBase}/${normalisedPath}`;
}

export function pageExportUrl(baseUrl: string, sitePath: string, format: string): string {
  return `${absoluteUrl(baseUrl, sitePath)}?format=${format}`;
}

export function normaliseSitePath(rawPath: string): string {
  return (rawPath || "").replace(/^\/+/, "").replace(/\/+$/, "");
}

export function normaliseLinkedPath(rawHref: string): string {
  if (!isString(rawHref)) {
    return "";
  }
  const withoutHash = rawHref.split("#")[0].split("?")[0].trim();
  if (!withoutHash) {
    return "";
  }
  if (withoutHash.startsWith("http://") || withoutHash.startsWith("https://")) {
    try {
      return normaliseSitePath(new URL(withoutHash).pathname);
    } catch {
      return "";
    }
  }
  return normaliseSitePath(withoutHash);
}

export function availablePathSet(availablePaths: string[]): Set<string> {
  return new Set((availablePaths || []).map(normaliseSitePath).filter(path => path.length > 0));
}

export function pathPresent(availablePaths: string[], sitePath: string): boolean {
  return availablePathSet(availablePaths).has(normaliseSitePath(sitePath));
}

export function discoverPathsBySuffix(availablePaths: string[], suffix: string): string[] {
  const normalisedSuffix = normaliseSitePath(suffix);
  return Array.from(availablePathSet(availablePaths))
    .filter(path => path === normalisedSuffix || path.endsWith(`/${normalisedSuffix}`))
    .sort((left, right) => left.localeCompare(right));
}

export function releaseNotesIndexPathFrom(availablePaths: string[]): string | null {
  const exactPreferred = OPTIONAL_HUB_PATHS.find(path =>
    path.endsWith("/release-notes") && pathPresent(availablePaths, path)
  );
  if (exactPreferred) {
    return exactPreferred;
  }
  const discovered = discoverPathsBySuffix(availablePaths, "release-notes")
    .filter(path => !path.endsWith("release-notes-for-humans"));
  return discovered[0] || null;
}

export function releaseNotesHumansPathFrom(availablePaths: string[]): string | null {
  const exactPreferred = OPTIONAL_HUB_PATHS.find(path =>
    path.endsWith("release-notes-for-humans") && pathPresent(availablePaths, path)
  );
  if (exactPreferred) {
    return exactPreferred;
  }
  const discovered = discoverPathsBySuffix(availablePaths, "release-notes-for-humans");
  return discovered[0] || null;
}

export function preferredDocumentationPaths(availablePaths: string[]): string[] {
  const available = availablePathSet(availablePaths);
  return OPTIONAL_HUB_PATHS.filter(path => available.has(path));
}

export function topLevelKeyPages(availablePaths: string[], limit = 30): string[] {
  return Array.from(availablePathSet(availablePaths))
    .filter(path => !path.includes("/"))
    .sort()
    .slice(0, limit);
}

export function siteContentPaths(availablePaths: string[]): SiteContentPaths {
  return {
    availablePaths: Array.from(availablePathSet(availablePaths)).sort(),
    releaseNotesIndexPath: releaseNotesIndexPathFrom(availablePaths),
    releaseNotesHumansPath: releaseNotesHumansPathFrom(availablePaths),
    documentationHubs: preferredDocumentationPaths(availablePaths),
    keyPages: topLevelKeyPages(availablePaths)
  };
}

export function parseReleaseEntriesFromMarkdown(markdown: string, indexPath: string): ParsedReleaseEntry[] {
  const normalisedIndex = normaliseSitePath(indexPath);
  if (!normalisedIndex) {
    return [];
  }
  const childPrefix = `${normalisedIndex}/`;
  const lines = (markdown || "").split("\n");
  const entries = lines.reduce((accumulator: ParsedReleaseEntry[], line) => {
    const match = line.trim().match(RELEASE_ENTRY_LINE);
    if (!match) {
      return accumulator;
    }
    const title = match[1].trim();
    const path = normaliseLinkedPath(match[2]);
    if (!title || !path.startsWith(childPrefix)) {
      return accumulator;
    }
    const tail = path.slice(childPrefix.length);
    if (!tail || tail.includes("/")) {
      return accumulator;
    }
    return accumulator.concat([{
      title,
      path,
      hasImages: Boolean(match[3])
    }]);
  }, []);
  return entries.reduce((unique: ParsedReleaseEntry[], entry) => {
    if (unique.some(existing => existing.path === entry.path)) {
      return unique;
    }
    return unique.concat([entry]);
  }, []);
}

export function buildReleaseFeed(params: {
  siteName: string;
  baseUrl: string;
  generated: string;
  indexPath: string;
  humansIndexPath?: string | null;
  entries: ParsedReleaseEntry[];
  limit?: number;
}): ReleaseFeed {
  const limit = params.limit ?? DEFAULT_RELEASE_FEED_LIMIT;
  const humansIndexPath = params.humansIndexPath || null;
  const entries = params.entries.slice(0, limit).map(entry => ({
    title: entry.title,
    path: entry.path,
    url: absoluteUrl(params.baseUrl, entry.path),
    markdownUrl: pageExportUrl(params.baseUrl, entry.path, "markdown"),
    jsonUrl: pageExportUrl(params.baseUrl, entry.path, "json"),
    htmlUrl: pageExportUrl(params.baseUrl, entry.path, "html"),
    hasImages: entry.hasImages
  }));
  return {
    title: `${params.siteName} Release Notes`,
    description: `Recent releases of ${params.siteName}, newest first`,
    type: RELEASE_FEED_TYPE,
    generated: params.generated,
    indexPath: params.indexPath,
    indexUrl: absoluteUrl(params.baseUrl, params.indexPath),
    humansIndexPath,
    humansIndexUrl: humansIndexPath ? absoluteUrl(params.baseUrl, humansIndexPath) : null,
    entries
  };
}

function releaseStartHereLines(baseUrl: string, content: SiteContentPaths): string[] {
  if (!content.releaseNotesIndexPath) {
    return [];
  }
  const lines = [
    `- Release notes index: ${absoluteUrl(baseUrl, content.releaseNotesIndexPath)}`,
    `- Release notes as Markdown: ${pageExportUrl(baseUrl, content.releaseNotesIndexPath, "markdown")}`,
    `- Release notes as JSON: ${pageExportUrl(baseUrl, content.releaseNotesIndexPath, "json")}`,
    `- Machine-readable release feed: ${absoluteUrl(baseUrl, "api/public/releases")}`
  ];
  if (content.releaseNotesHumansPath) {
    lines.splice(1, 0, `- Curated release notes: ${absoluteUrl(baseUrl, content.releaseNotesHumansPath)}`);
  }
  return lines;
}

export function buildLlmsTxt(params: AiDiscoverySite & {
  availablePaths: string[];
  titleFromPath: (path: string) => string;
}): string {
  const content = siteContentPaths(params.availablePaths);
  const startHere = [
    `- AI landing page: ${absoluteUrl(params.baseUrl, FOR_AI_PATH)}`,
    ...releaseStartHereLines(params.baseUrl, content)
  ];
  const lines = [
    `# ${params.siteName}`,
    "",
    `> ${params.siteName} is an NGX-Ramblers walking-group website. Public CMS pages are available as HTML, Markdown and JSON.`,
    "",
    "## Start here",
    "",
    ...startHere,
    "",
    "## Content access",
    "",
    `- Any CMS page as Markdown: ${params.baseUrl}/api/public/content/path/{page-path}?format=markdown`,
    `- Same formats via the page address: ${params.baseUrl}/{page-path}?format=markdown (also json, html)`,
    `- Formats: json (default for the API), html, markdown`,
    `- Sitemap of all public page addresses: ${params.baseUrl}/sitemap.xml`,
    `- This file: ${params.baseUrl}/llms.txt`
  ];
  if (content.documentationHubs.length > 0) {
    lines.push(
      "",
      "## Documentation hubs",
      "",
      ...content.documentationHubs.map(path =>
        `- [${params.titleFromPath(path)}](${absoluteUrl(params.baseUrl, path)}) — Markdown: ${pageExportUrl(params.baseUrl, path, "markdown")}`
      )
    );
  }
  if (content.keyPages.length > 0) {
    lines.push(
      "",
      "## Key pages",
      "",
      ...content.keyPages.map(path => `- [${params.titleFromPath(path)}](${absoluteUrl(params.baseUrl, path)})`)
    );
  }
  return lines.join("\n");
}

export function buildForAiMarkdown(params: AiDiscoverySite & {
  availablePaths: string[];
  titleFromPath: (path: string) => string;
}): string {
  const content = siteContentPaths(params.availablePaths);
  const sections = [
    `# For AI assistants`,
    "",
    `If you are an AI assistant looking for information about **${params.siteName}** or NGX-Ramblers, start here.`,
    ""
  ];
  if (content.releaseNotesIndexPath) {
    sections.push(
      `## Recent releases`,
      "",
      `This site publishes release notes in the CMS. Prefer these entry points:`,
      "",
      `1. Machine-readable feed: ${absoluteUrl(params.baseUrl, "api/public/releases")}`,
      `2. Release-notes index (newest first): ${absoluteUrl(params.baseUrl, content.releaseNotesIndexPath)}`
    );
    if (content.releaseNotesHumansPath) {
      sections.push(`3. Curated notes with screenshots: ${absoluteUrl(params.baseUrl, content.releaseNotesHumansPath)}`);
      sections.push(`4. Markdown export of the index: ${pageExportUrl(params.baseUrl, content.releaseNotesIndexPath, "markdown")}`);
    } else {
      sections.push(`3. Markdown export of the index: ${pageExportUrl(params.baseUrl, content.releaseNotesIndexPath, "markdown")}`);
    }
    sections.push(
      "",
      `Each individual release page also supports \`?format=markdown\`, \`?format=json\` and \`?format=html\`.`,
      ""
    );
  }
  sections.push(
    `## Content formats`,
    "",
    `Every public CMS page can be fetched without running JavaScript:`,
    "",
    `- HTML page: ${params.baseUrl}/{page-path}`,
    `- Markdown: ${params.baseUrl}/{page-path}?format=markdown`,
    `- JSON: ${params.baseUrl}/{page-path}?format=json`,
    `- Explicit API: ${params.baseUrl}/api/public/content/path/{page-path}?format=markdown`,
    "",
    `CMS pages advertise these alternates with \`rel="alternate"\` link tags and HTTP \`Link\` headers.`,
    ""
  );
  if (content.documentationHubs.length > 0 || content.keyPages.length > 0) {
    sections.push(`## Documentation`, "");
    content.documentationHubs.forEach(path => {
      sections.push(`- [${params.titleFromPath(path)}](${absoluteUrl(params.baseUrl, path)}) (\`?format=markdown\`)`);
    });
    if (content.documentationHubs.length === 0) {
      content.keyPages.slice(0, 10).forEach(path => {
        sections.push(`- [${params.titleFromPath(path)}](${absoluteUrl(params.baseUrl, path)}) (\`?format=markdown\`)`);
      });
    }
    sections.push("");
  }
  sections.push(
    `## Discovery files`,
    "",
    `- [\`/llms.txt\`](${params.baseUrl}/llms.txt) — short index for language models`,
    `- [\`/sitemap.xml\`](${params.baseUrl}/sitemap.xml) — all public page addresses`,
    `- [\`/robots.txt\`](${params.baseUrl}/robots.txt)`,
    "",
    `## What this site is`,
    "",
    `${params.siteName} runs on NGX-Ramblers: an Angular + Node platform for Ramblers walking groups, with walks management, committee tools, email, and a public CMS.`
  );
  return sections.join("\n");
}
