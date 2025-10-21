import puppeteer, { Browser } from "puppeteer";

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
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
  } catch {
    const fallback = pageUrl.endsWith("/") ? pageUrl : `${pageUrl}/`;
    return fallback;
  }
}

