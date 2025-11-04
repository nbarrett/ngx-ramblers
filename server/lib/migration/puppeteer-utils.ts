import puppeteer, { Browser } from "puppeteer";
import debug from "debug";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("puppeteer-utils"));

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu"
    ]
  });
}

export function deriveBaseUrl(pageUrl: string, docBaseHref?: string): string {
  try {
    const base = new URL(docBaseHref || pageUrl, pageUrl);
    const path = base.pathname || "/";
    if (path.endsWith("/")) {
      base.pathname = path;
    } else {
      const lastSlash = path.lastIndexOf("/");
      const directory = lastSlash >= 0 ? path.substring(0, lastSlash + 1) : "/";
      base.pathname = directory || "/";
    }
    return base.toString();
  } catch (e) {
    debugLog(`Failed to parse URL "${pageUrl}" with baseHref "${docBaseHref}":`, e instanceof Error ? e.message : String(e));
    return pageUrl.endsWith("/") ? pageUrl : `${pageUrl}/`;
  }
}

