import { Request, Response } from "express";
import debug from "debug";
import { isString } from "es-toolkit/compat";
import { envConfig } from "../../env-config/env-config";
import { logBrevoError } from "../common/error-log";

const debugLog = debug(envConfig.logNamespace("brevo:resolve-tracking-url"));
debugLog.enabled = false;

const MAX_REDIRECTS = 10;
const REQUEST_TIMEOUT_MS = 8000;

const ALLOWED_TRACKING_HOST_PATTERNS = [
  /^[^\s/]*\.sendibt2\.com$/i,
  /^[^\s/]*\.sendinblue\.com$/i,
  /^[^\s/]*\.brevo\.com$/i,
  /^link\.mailinblue\.com$/i,
  /^[^\s/]*\.list-manage\.com$/i,
  /^mailchi\.mp$/i,
  /^[^\s/]*\.campaign-archive\.com$/i
];

function isAllowedTrackingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return ALLOWED_TRACKING_HOST_PATTERNS.some(pattern => pattern.test(parsed.hostname));
  } catch (error) {
    logBrevoError("brevo:resolve-tracking-url", error, {url});
    return false;
  }
}

async function followRedirectsOnce(targetUrl: string): Promise<{ status: number; location: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(targetUrl, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal
    });
    return { status: response.status, location: response.headers.get("location") };
  } finally {
    clearTimeout(timer);
  }
}

async function resolveUrl(originalUrl: string): Promise<{ resolvedUrl: string; hops: number } | { error: string; lastUrl: string }> {
  const attempt = async (currentUrl: string, hopsTaken: number): Promise<{ resolvedUrl: string; hops: number } | { error: string; lastUrl: string }> => {
    if (hopsTaken >= MAX_REDIRECTS) {
      return { error: `More than ${MAX_REDIRECTS} redirects`, lastUrl: currentUrl };
    }
    const { status, location } = await followRedirectsOnce(currentUrl);
    if (status >= 200 && status < 300) {
      return { resolvedUrl: currentUrl, hops: hopsTaken };
    }
    if (status >= 300 && status < 400 && location) {
      const next = new URL(location, currentUrl).toString();
      if (next === currentUrl) {
        return { error: "Redirect loop", lastUrl: currentUrl };
      }
      return attempt(next, hopsTaken + 1);
    }
    return { error: `Tracker returned ${status} with no redirect`, lastUrl: currentUrl };
  };
  return attempt(originalUrl, 0);
}

export async function resolveTrackingUrl(req: Request, res: Response): Promise<void> {
  const url: string = req.body?.url;
  if (!isString(url) || !url.trim()) {
    res.status(400).json({ error: "Missing url" });
    return;
  }
  if (!isAllowedTrackingUrl(url)) {
    res.status(400).json({ error: "URL is not on the recognised tracking-redirect allow-list" });
    return;
  }
  try {
    const outcome = await resolveUrl(url);
    if ("resolvedUrl" in outcome) {
      debugLog("resolved", url, "->", outcome.resolvedUrl, "in", outcome.hops, "hops");
      res.status(200).json({ originalUrl: url, resolvedUrl: outcome.resolvedUrl, hops: outcome.hops });
      return;
    }
    debugLog("resolve failed for", url, ":", outcome.error, "lastUrl:", outcome.lastUrl);
    res.status(200).json({ originalUrl: url, resolvedUrl: null, error: outcome.error, lastUrl: outcome.lastUrl });
  } catch (error: any) {
    logBrevoError("brevo:resolve-tracking-url", error, {url});
    debugLog("resolve threw for", url, ":", error?.message || error);
    res.status(200).json({ originalUrl: url, resolvedUrl: null, error: error?.message ?? String(error) });
  }
}
