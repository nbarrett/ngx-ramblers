import { Request, Response } from "express";
import { values } from "es-toolkit/compat";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { systemConfig } from "../config/system-config";
import { publicSitePaths } from "../mongo/controllers/site-search";
import { pageContent } from "../mongo/models/page-content";
import { PageContent } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { ContentExportFormat } from "../../../projects/ngx-ramblers/src/app/models/content-export.model";
import { StoredValue } from "../../../projects/ngx-ramblers/src/app/models/ui-actions";
import { renderMarkdownToHtml } from "../shared/markdown-renderer";
import { dateTimeNow } from "../shared/dates";
import {
  absolutiseMarkdownLinks,
  publicMarkdownFromRows,
  titleFromPath
} from "./content-export-renderer";
import {
  absoluteUrl,
  buildForAiMarkdown,
  buildLlmsTxt,
  buildReleaseFeed,
  pageExportUrl,
  parseReleaseEntriesFromMarkdown,
  siteContentPaths
} from "./ai-discovery";

const errorDebugLog = createErrorDebugLog("ai-discovery");

const CACHE_CONTROL = "public, max-age=3600";

async function siteIdentity(): Promise<{ siteName: string; baseUrl: string } | null> {
  const config = await systemConfig();
  const baseUrl = (config?.group?.href || "").replace(/\/+$/, "");
  const siteName = config?.group?.longName || config?.group?.shortName;
  if (!baseUrl || !siteName) {
    return null;
  }
  return {siteName, baseUrl};
}

async function pageMarkdownForPath(path: string, baseUrl: string): Promise<string> {
  const page = await pageContent.findOne({path}).lean().exec() as PageContent
    || await pageContent.findOne({path: path.toLowerCase()}).lean().exec() as PageContent;
  if (!page) {
    return "";
  }
  return absolutiseMarkdownLinks(publicMarkdownFromRows(page.rows), baseUrl);
}

function requestedFormat(req: Request, defaultFormat: ContentExportFormat): ContentExportFormat {
  const queryFormat = (req.query[StoredValue.FORMAT] as string) || "";
  if (values(ContentExportFormat).includes(queryFormat as ContentExportFormat)) {
    return queryFormat as ContentExportFormat;
  }
  const accept = (req.get("Accept") || "").toLowerCase();
  if (accept.includes("application/json")) {
    return ContentExportFormat.JSON;
  }
  if (accept.includes("text/markdown")) {
    return ContentExportFormat.MARKDOWN;
  }
  if (accept.includes("text/html")) {
    return ContentExportFormat.HTML;
  }
  return defaultFormat;
}

export async function llmsTxt(req: Request, res: Response): Promise<void> {
  try {
    const identity = await siteIdentity();
    if (!identity) {
      res.status(404).type("text/plain").send("llms.txt unavailable: site not configured");
      return;
    }
    const availablePaths = (await publicSitePaths()) || [];
    const body = buildLlmsTxt({
      ...identity,
      availablePaths,
      titleFromPath
    });
    res.setHeader("Cache-Control", CACHE_CONTROL);
    res.type("text/plain").send(body);
  } catch (error) {
    errorDebugLog("llmsTxt failed:", error);
    res.status(500).type("text/plain").send("llms.txt generation failed");
  }
}

export async function forAi(req: Request, res: Response): Promise<void> {
  try {
    const identity = await siteIdentity();
    if (!identity) {
      res.status(404).type("text/plain").send("AI guide unavailable: site not configured");
      return;
    }
    const availablePaths = (await publicSitePaths()) || [];
    const content = siteContentPaths(availablePaths);
    const markdown = buildForAiMarkdown({
      ...identity,
      availablePaths,
      titleFromPath
    });
    const format = requestedFormat(req, ContentExportFormat.MARKDOWN);
    res.setHeader("Cache-Control", CACHE_CONTROL);
    if (format === ContentExportFormat.HTML) {
      res.type("html").send(renderMarkdownToHtml(markdown));
    } else if (format === ContentExportFormat.JSON) {
      const links: Record<string, string> = {
        llmsTxt: `${identity.baseUrl}/llms.txt`,
        sitemap: `${identity.baseUrl}/sitemap.xml`
      };
      if (content.releaseNotesIndexPath) {
        links.releases = `${identity.baseUrl}/api/public/releases`;
        links.releaseNotes = absoluteUrl(identity.baseUrl, content.releaseNotesIndexPath);
        links.releaseNotesMarkdown = pageExportUrl(identity.baseUrl, content.releaseNotesIndexPath, "markdown");
      }
      if (content.releaseNotesHumansPath) {
        links.releaseNotesForHumans = absoluteUrl(identity.baseUrl, content.releaseNotesHumansPath);
      }
      res.json({
        title: `For AI assistants — ${identity.siteName}`,
        description: `Discovery guide for AI tools using ${identity.siteName}`,
        type: "ai-guide",
        generated: dateTimeNow().toISO(),
        path: "for-ai",
        contentMarkdown: markdown,
        contentHtml: renderMarkdownToHtml(markdown),
        links
      });
    } else {
      res.type("text/markdown").send(markdown);
    }
  } catch (error) {
    errorDebugLog("forAi failed:", error);
    res.status(500).type("text/plain").send("AI guide generation failed");
  }
}

export async function publicReleases(req: Request, res: Response): Promise<void> {
  try {
    const identity = await siteIdentity();
    if (!identity) {
      res.status(404).json({message: "Release feed unavailable: site not configured"});
      return;
    }
    const availablePaths = (await publicSitePaths()) || [];
    const content = siteContentPaths(availablePaths);
    if (!content.releaseNotesIndexPath) {
      res.status(404).json({message: "Release notes are not published on this site"});
      return;
    }
    const markdown = await pageMarkdownForPath(content.releaseNotesIndexPath, identity.baseUrl);
    if (!markdown.trim()) {
      res.status(404).json({message: "Release notes index has no public content"});
      return;
    }
    const limitParam = Number(req.query.limit);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 200) : undefined;
    const feed = buildReleaseFeed({
      siteName: identity.siteName,
      baseUrl: identity.baseUrl,
      generated: dateTimeNow().toISO(),
      indexPath: content.releaseNotesIndexPath,
      humansIndexPath: content.releaseNotesHumansPath,
      entries: parseReleaseEntriesFromMarkdown(markdown, content.releaseNotesIndexPath),
      limit
    });
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(feed);
  } catch (error) {
    errorDebugLog("publicReleases failed:", error);
    res.status(500).json({message: "Release feed generation failed"});
  }
}
