import debug from "debug";
import fs from "fs";
import { Response } from "express";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { dateTimeNowAsValue } from "./dates";
import { extractGoogleSiteVerificationId } from "../../../projects/ngx-ramblers/src/app/functions/google-search-console";

const debugLog = debug(envConfig.logNamespace("serve-index-html"));
debugLog.enabled = false;

interface HeadConfig {
  verificationId: string;
  baseHref: string;
}

const headConfigCacheTtlMs = 5 * 60 * 1000;
const headConfigCache: { value: HeadConfig; expiry: number } = {value: null, expiry: 0};

async function cachedHeadConfig(): Promise<HeadConfig> {
  if (dateTimeNowAsValue() < headConfigCache.expiry) {
    return headConfigCache.value;
  }
  try {
    const config = await systemConfig();
    headConfigCache.value = {
      verificationId: config?.googleSearchConsole?.verificationId || null,
      baseHref: (config?.group?.href || "").replace(/\/+$/, "") || null
    };
  } catch (error) {
    debugLog("Failed to read system config for head tags:", error);
    headConfigCache.value = {verificationId: null, baseHref: null};
  }
  headConfigCache.expiry = dateTimeNowAsValue() + headConfigCacheTtlMs;
  return headConfigCache.value;
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
  const canonicalUrl = canonicalUrlFor(baseHref, requestPath)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return html.replace("</head>", `  <link rel="canonical" href="${canonicalUrl}">\n</head>`);
}

export async function serveIndexHtml(indexPath: string, res: Response, requestPath?: string): Promise<void> {
  const html = fs.readFileSync(indexPath, "utf-8");
  const headConfig = await cachedHeadConfig();
  const withVerification = headConfig?.verificationId ? withGoogleSiteVerification(html, headConfig.verificationId) : html;
  const withCanonical = headConfig?.baseHref ? withCanonicalLink(withVerification, headConfig.baseHref, requestPath) : withVerification;
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.type("html").send(withCanonical);
}
