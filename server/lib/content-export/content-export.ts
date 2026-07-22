import { NextFunction, Request, Response } from "express";
import debug from "debug";
import { isValidObjectId } from "mongoose";
import { envConfig } from "../env-config/env-config";
import { createErrorDebugLog } from "../shared/error-debug-log";
import { pageContent } from "../mongo/models/page-content";
import { extendedGroupEvent } from "../mongo/models/extended-group-event";
import { PageContent } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { ContentExport, ContentExportFormat, PageSeoDescriptor } from "../../../projects/ngx-ramblers/src/app/models/content-export.model";
import { EventSource, ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { DocumentField, GroupEventField } from "../../../projects/ngx-ramblers/src/app/models/walk.model";
import { values } from "es-toolkit/compat";
import { StoredValue } from "../../../projects/ngx-ramblers/src/app/models/ui-actions";
import { renderMarkdownToHtml } from "../shared/markdown-renderer";
import { siteBaseUrl } from "../config/site-base-url";
import {
  absolutiseMarkdownLinks,
  descriptionFromMarkdown,
  normalisePath,
  publicMarkdownFromRows,
  titleFromPath
} from "./content-export-renderer";

const debugLog = debug(envConfig.logNamespace("content-export"));
debugLog.enabled = false;
const errorDebugLog = createErrorDebugLog("content-export");

const CACHE_CONTROL = "public, max-age=300";

async function pageContentForPath(rawPath: string): Promise<PageContent> {
  const path = normalisePath(rawPath);
  if (!path) {
    return null;
  }
  const exactMatch = await pageContent.findOne({path}).lean().exec() as PageContent;
  return exactMatch || await pageContent.findOne({path: path.toLowerCase()}).lean().exec() as PageContent;
}

function contentExportFrom(page: PageContent, baseUrl: string): ContentExport {
  const contentMarkdown = absolutiseMarkdownLinks(publicMarkdownFromRows(page.rows), baseUrl);
  return {
    id: page.id || (page as any)._id?.toString(),
    title: titleFromPath(page.path),
    path: page.path,
    contentMarkdown,
    contentHtml: renderMarkdownToHtml(contentMarkdown)
  };
}

function sendInFormat(contentExport: ContentExport, format: string, res: Response): void {
  res.setHeader("Cache-Control", CACHE_CONTROL);
  if (format === ContentExportFormat.HTML) {
    res.type("html").send(contentExport.contentHtml);
  } else if (format === ContentExportFormat.MARKDOWN) {
    res.type("text/markdown").send(contentExport.contentMarkdown);
  } else {
    res.json(contentExport);
  }
}

async function respondWith(page: PageContent, req: Request, res: Response): Promise<void> {
  if (!page) {
    res.status(404).json({message: "Page not found"});
    return;
  }
  const contentExport = contentExportFrom(page, await siteBaseUrl());
  if (!contentExport.contentMarkdown.trim()) {
    res.status(404).json({message: "Page has no public content"});
    return;
  }
  const format = (req.query[StoredValue.FORMAT] as string) || ContentExportFormat.JSON;
  if (values(ContentExportFormat).includes(format as ContentExportFormat)) {
    sendInFormat(contentExport, format, res);
  } else {
    res.status(400).json({message: `Invalid format: ${format} - valid values are ${values(ContentExportFormat).join(", ")}`});
  }
}

export async function contentExportForPageUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  const format = (req.query[StoredValue.FORMAT] as string) || "";
  if (req.method !== "GET" || req.path.startsWith("/api/") || !values(ContentExportFormat).includes(format as ContentExportFormat)) {
    next();
    return;
  }
  try {
    const page = await pageContentForPath(req.path);
    const contentExport = page ? contentExportFrom(page, await siteBaseUrl()) : null;
    if (contentExport?.contentMarkdown.trim()) {
      sendInFormat(contentExport, format, res);
    } else {
      next();
    }
  } catch (error) {
    errorDebugLog("contentExportForPageUrl failed for", req.path, "error:", error);
    next();
  }
}

export async function contentForPath(req: Request, res: Response): Promise<void> {
  try {
    const page = await pageContentForPath(req.params[0]);
    await respondWith(page, req, res);
  } catch (error) {
    errorDebugLog("contentForPath failed for", req.params[0], "error:", error);
    res.status(500).json({message: "Content export failed"});
  }
}

export async function contentForId(req: Request, res: Response): Promise<void> {
  try {
    const pageId = req.params.pageId;
    if (!isValidObjectId(pageId)) {
      res.status(404).json({message: "Page not found"});
      return;
    }
    const page = await pageContent.findById(pageId).lean().exec() as PageContent;
    await respondWith(page, req, res);
  } catch (error) {
    errorDebugLog("contentForId failed for", req.params.pageId, "error:", error);
    res.status(500).json({message: "Content export failed"});
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function eventForSlug(slug: string): Promise<ExtendedGroupEvent> {
  const activeFilter = {
    $or: [
      {[DocumentField.SOURCE]: {$ne: EventSource.LOCAL}},
      {[DocumentField.SOURCE]: EventSource.LOCAL, [GroupEventField.STATUS]: {$ne: "deleted"}}
    ]
  };
  const bySlug = await extendedGroupEvent.findOne({
    ...activeFilter,
    [GroupEventField.URL]: {$regex: `/${escapeRegExp(slug)}$`}
  }).select(`${GroupEventField.TITLE} ${GroupEventField.DESCRIPTION}`).lean().exec() as ExtendedGroupEvent;
  if (bySlug) {
    return bySlug;
  } else if (isValidObjectId(slug)) {
    return await extendedGroupEvent.findById(slug).select(`${GroupEventField.TITLE} ${GroupEventField.DESCRIPTION}`).lean().exec() as ExtendedGroupEvent;
  } else {
    return null;
  }
}

export async function pageSeoDescriptorForPath(rawPath: string): Promise<PageSeoDescriptor> {
  const path = normalisePath(rawPath) || "home";
  const page = await pageContentForPath(path);
  if (page) {
    const contentMarkdown = publicMarkdownFromRows(page.rows);
    if (contentMarkdown.trim()) {
      return {
        title: titleFromPath(page.path),
        description: descriptionFromMarkdown(contentMarkdown),
        contentHtml: renderMarkdownToHtml(absolutiseMarkdownLinks(contentMarkdown, await siteBaseUrl())),
        exportablePath: page.path
      };
    } else {
      return null;
    }
  }
  const pathSegments = path.split("/").filter(segment => segment.length > 0);
  if (pathSegments.length >= 2) {
    const event = await eventForSlug(pathSegments[pathSegments.length - 1]);
    const eventDescription = event?.groupEvent?.description || "";
    if (event?.groupEvent?.title) {
      return {
        title: event.groupEvent.title,
        description: descriptionFromMarkdown(eventDescription),
        contentHtml: renderMarkdownToHtml(eventDescription)
      };
    }
  }
  return null;
}
