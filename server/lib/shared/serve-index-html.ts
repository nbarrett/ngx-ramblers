import debug from "debug";
import fs from "fs";
import { Response } from "express";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { dateTimeNowAsValue } from "./dates";
import { extractGoogleSiteVerificationId } from "../../../projects/ngx-ramblers/src/app/functions/google-search-console";
import { pageSeoDescriptorForPath } from "../content-export/content-export";
import { PageSeoDescriptor } from "../../../projects/ngx-ramblers/src/app/models/content-export.model";

const debugLog = debug(envConfig.logNamespace("serve-index-html"));
debugLog.enabled = false;

interface HeadConfig {
  verificationId: string;
  baseHref: string;
  siteName: string;
}

interface CachedSeoDescriptor {
  value: PageSeoDescriptor;
  expiry: number;
}

const headConfigCacheTtlMs = 5 * 60 * 1000;
const headConfigCache: { value: HeadConfig; expiry: number } = {value: null, expiry: 0};
const seoCacheTtlMs = 5 * 60 * 1000;
const seoCacheMaxEntries = 200;
const seoCache = new Map<string, CachedSeoDescriptor>();

async function cachedHeadConfig(): Promise<HeadConfig> {
  if (dateTimeNowAsValue() < headConfigCache.expiry) {
    return headConfigCache.value;
  }
  try {
    const config = await systemConfig();
    headConfigCache.value = {
      verificationId: config?.googleSearchConsole?.verificationId || null,
      baseHref: (config?.group?.href || "").replace(/\/+$/, "") || null,
      siteName: config?.group?.shortName || config?.group?.longName || null
    };
  } catch (error) {
    debugLog("Failed to read system config for head tags:", error);
    headConfigCache.value = {verificationId: null, baseHref: null, siteName: null};
  }
  headConfigCache.expiry = dateTimeNowAsValue() + headConfigCacheTtlMs;
  return headConfigCache.value;
}

async function cachedSeoDescriptor(requestPath: string): Promise<PageSeoDescriptor> {
  const cached = seoCache.get(requestPath);
  if (cached && dateTimeNowAsValue() < cached.expiry) {
    return cached.value;
  }
  let descriptor: PageSeoDescriptor = null;
  try {
    descriptor = await pageSeoDescriptorForPath(requestPath);
  } catch (error) {
    debugLog("Failed to derive page SEO descriptor for", requestPath, error);
  }
  if (seoCache.size >= seoCacheMaxEntries) {
    seoCache.delete(seoCache.keys().next().value);
  }
  seoCache.set(requestPath, {value: descriptor, expiry: dateTimeNowAsValue() + seoCacheTtlMs});
  return descriptor;
}

function escapeHtml(value: string): string {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function withGoogleSiteVerification(html: string, verificationId: string): string {
  const safeId = extractGoogleSiteVerificationId(verificationId).replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeId) {
    return html;
  }
  return html.replace("</head>", `  <meta name="google-site-verification" content="${safeId}">\n</head>`);
}

function canonicalUrlFor(baseHref: string, requestPath: string): string {
  const normalisedPath = (requestPath || "/").replace(/\/+$/, "") || "/";
  return normalisedPath === "/" ? baseHref : `${baseHref}${normalisedPath}`;
}

function withCanonicalLink(html: string, baseHref: string, requestPath: string): string {
  const canonicalUrl = escapeHtml(canonicalUrlFor(baseHref, requestPath));
  return html.replace("</head>", `  <link rel="canonical" href="${canonicalUrl}">\n</head>`);
}

function withTitle(html: string, siteName: string, pageTitle: string): string {
  const fullTitle = [siteName, pageTitle].filter(part => part && part.trim().length > 0).join(" — ");
  if (!fullTitle) {
    return html;
  }
  return html.replace("</head>", `  <title>${escapeHtml(fullTitle)}</title>\n</head>`);
}

function withMetaDescription(html: string, description: string): string {
  if (!description) {
    return html;
  }
  return html.replace("</head>", `  <meta name="description" content="${escapeHtml(description)}">\n</head>`);
}

function representationUrl(baseHref: string, exportablePath: string, format: string): string {
  return `${canonicalUrlFor(baseHref, `/${exportablePath}`)}?format=${format}`;
}

export function withRepresentationAlternates(html: string, baseHref: string, descriptor: PageSeoDescriptor): string {
  if (!descriptor?.exportablePath) {
    return html;
  }
  const alternates = [
    {format: "markdown", type: "text/markdown"},
    {format: "html", type: "text/html"},
    {format: "json", type: "application/json"}
  ].map(alternate => `  <link rel="alternate" type="${alternate.type}" href="${escapeHtml(representationUrl(baseHref, descriptor.exportablePath, alternate.format))}">`).join("\n");
  return html.replace("</head>", `${alternates}\n</head>`);
}

export function withServerContent(html: string, descriptor: PageSeoDescriptor): string {
  if (!descriptor?.contentHtml) {
    return html;
  }
  const contentStartsWithHeading = descriptor.contentHtml.trimStart().startsWith("<h1");
  const heading = descriptor.title && !contentStartsWithHeading ? `<h1>${escapeHtml(descriptor.title)}</h1>` : "";
  const serverContent = `<main id="server-rendered-content">${heading}${descriptor.contentHtml}</main>`;
  const visibilityStyle = "<style>app-root:not(:empty) + #server-rendered-content{display:none}</style>";
  return html
    .replace("</head>", `  ${visibilityStyle}\n</head>`)
    .replace("<app-root></app-root>", `<app-root></app-root>\n${serverContent}`);
}

export async function serveIndexHtml(indexPath: string, res: Response, requestPath?: string): Promise<void> {
  const html = fs.readFileSync(indexPath, "utf-8");
  const headConfig = await cachedHeadConfig();
  const seoDescriptor = await cachedSeoDescriptor(requestPath || "/");
  const transformations: ((input: string) => string)[] = [
    input => headConfig?.verificationId ? withGoogleSiteVerification(input, headConfig.verificationId) : input,
    input => headConfig?.baseHref ? withCanonicalLink(input, headConfig.baseHref, requestPath) : input,
    input => withTitle(input, headConfig?.siteName, seoDescriptor?.title),
    input => withMetaDescription(input, seoDescriptor?.description),
    input => headConfig?.baseHref ? withRepresentationAlternates(input, headConfig.baseHref, seoDescriptor) : input,
    input => withServerContent(input, seoDescriptor)
  ];
  const transformed = transformations.reduce((current, transformation) => transformation(current), html);
  if (headConfig?.baseHref && seoDescriptor?.exportablePath) {
    const links = [
      `<${representationUrl(headConfig.baseHref, seoDescriptor.exportablePath, "markdown")}>; rel="alternate"; type="text/markdown"`,
      `<${representationUrl(headConfig.baseHref, seoDescriptor.exportablePath, "html")}>; rel="alternate"; type="text/html"`,
      `<${representationUrl(headConfig.baseHref, seoDescriptor.exportablePath, "json")}>; rel="alternate"; type="application/json"`
    ];
    res.setHeader("Link", links.join(", "));
  }
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.type("html").send(transformed);
}
