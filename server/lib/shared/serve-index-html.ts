import debug from "debug";
import fs from "fs";
import { Response } from "express";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { dateTimeNowAsValue } from "./dates";
import { extractGoogleSiteVerificationId } from "../../../projects/ngx-ramblers/src/app/functions/google-search-console";
import { pageSeoDescriptorForPath } from "../content-export/content-export";
import { PageSeoDescriptor } from "../../../projects/ngx-ramblers/src/app/models/content-export.model";
import { S3_BASE_URL } from "../../../projects/ngx-ramblers/src/app/models/content-metadata.model";

const debugLog = debug(envConfig.logNamespace("serve-index-html"));
debugLog.enabled = false;

interface HeadConfig {
  verificationId: string;
  baseHref: string;
  siteName: string;
  faviconUrl: string;
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
const noscriptContentMaxLength = 20000;

async function cachedHeadConfig(): Promise<HeadConfig> {
  if (dateTimeNowAsValue() < headConfigCache.expiry) {
    return headConfigCache.value;
  }
  try {
    const config = await systemConfig();
    const selectedLogo = config?.logos?.images?.find(image => image.originalFileName === config?.header?.selectedLogo);
    headConfigCache.value = {
      verificationId: config?.googleSearchConsole?.verificationId || null,
      baseHref: (config?.group?.href || "").replace(/\/+$/, "") || null,
      siteName: config?.group?.shortName || config?.group?.longName || null,
      faviconUrl: selectedLogo?.awsFileName ? `/${S3_BASE_URL}/${selectedLogo.awsFileName}` : null
    };
  } catch (error) {
    debugLog("Failed to read system config for head tags:", error);
    headConfigCache.value = {verificationId: null, baseHref: null, siteName: null, faviconUrl: null};
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

function withMarkdownAlternate(html: string, descriptor: PageSeoDescriptor): string {
  if (!descriptor?.exportablePath) {
    return html;
  }
  const markdownUrl = escapeHtml(`/api/public/content/path/${descriptor.exportablePath}?format=markdown`);
  return html.replace("</head>", `  <link rel="alternate" type="text/markdown" href="${markdownUrl}">\n</head>`);
}

function withNoscriptContent(html: string, descriptor: PageSeoDescriptor): string {
  if (!descriptor?.contentHtml) {
    return html;
  }
  const contentStartsWithHeading = descriptor.contentHtml.trimStart().startsWith("<h1");
  const heading = descriptor.title && !contentStartsWithHeading ? `<h1>${escapeHtml(descriptor.title)}</h1>` : "";
  const content = descriptor.contentHtml.length > noscriptContentMaxLength
    ? descriptor.contentHtml.slice(0, noscriptContentMaxLength)
    : descriptor.contentHtml;
  return html.replace("<app-root></app-root>", `<app-root></app-root>\n<noscript>${heading}${content}</noscript>`);
}

function withFavicon(html: string, faviconUrl: string): string {
  if (!faviconUrl) {
    return html;
  }
  const withoutStaticIcons = html.replace(/[ \t]*<link[^>]*rel="icon"[^>]*>\n?/g, "");
  return withoutStaticIcons.replace("</head>", `  <link rel="icon" href="${escapeHtml(faviconUrl)}">\n</head>`);
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
    input => withMarkdownAlternate(input, seoDescriptor),
    input => withNoscriptContent(input, seoDescriptor),
    input => withFavicon(input, headConfig?.faviconUrl)
  ];
  const transformed = transformations.reduce((current, transformation) => transformation(current), html);
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.type("html").send(transformed);
}
