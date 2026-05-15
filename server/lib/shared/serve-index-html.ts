import debug from "debug";
import fs from "fs";
import { Response } from "express";
import { envConfig } from "../env-config/env-config";
import { systemConfig } from "../config/system-config";
import { dateTimeNowAsValue } from "./dates";
import { extractGoogleSiteVerificationId } from "../../../projects/ngx-ramblers/src/app/functions/google-search-console";

const debugLog = debug(envConfig.logNamespace("serve-index-html"));
debugLog.enabled = false;

const verificationIdCacheTtlMs = 5 * 60 * 1000;
const verificationIdCache: { value: string; expiry: number } = {value: null, expiry: 0};

async function googleSiteVerificationId(): Promise<string> {
  if (dateTimeNowAsValue() < verificationIdCache.expiry) {
    return verificationIdCache.value;
  }
  try {
    const config = await systemConfig();
    verificationIdCache.value = config?.googleSearchConsole?.verificationId || null;
  } catch (error) {
    debugLog("Failed to read system config for Google site verification:", error);
    verificationIdCache.value = null;
  }
  verificationIdCache.expiry = dateTimeNowAsValue() + verificationIdCacheTtlMs;
  return verificationIdCache.value;
}

function withGoogleSiteVerification(html: string, verificationId: string): string {
  const safeId = extractGoogleSiteVerificationId(verificationId).replace(/[^A-Za-z0-9_-]/g, "");
  if (!safeId) {
    return html;
  }
  return html.replace("</head>", `  <meta name="google-site-verification" content="${safeId}">\n</head>`);
}

export async function serveIndexHtml(indexPath: string, res: Response): Promise<void> {
  const html = fs.readFileSync(indexPath, "utf-8");
  const verificationId = await googleSiteVerificationId();
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.type("html").send(verificationId ? withGoogleSiteVerification(html, verificationId) : html);
}
