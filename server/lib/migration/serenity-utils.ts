import { Actor, Cast, TakeNotes } from "@serenity-js/core";
import { BrowseTheWebWithWebdriverIO } from "@serenity-js/webdriverio";
import { remote } from "webdriverio";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { Environment } from "../env-config/environment-model";

const debugLog = debug(envConfig.logNamespace("serenity-utils"));

interface NotepadData {
  [key: string]: string | number | boolean | null | undefined;
}

export class MigrationActors extends Cast {
  constructor(private browser: WebdriverIO.Browser) {
    super();
  }

  prepare(actor: Actor): Actor {
    return actor.whoCan(BrowseTheWebWithWebdriverIO.using(this.browser)).whoCan(TakeNotes.usingAnEmptyNotepad<NotepadData>());
  }
}

export interface BrowserInstance {
  browser: WebdriverIO.Browser;
  actor: Actor;
}

interface ChromeOptions {
  args: string[];
  binary?: string;
}

interface ChromeDriverOptions {
  binary: string;
}

interface RemoteCapabilities {
  browserName: "chrome";
  "goog:chromeOptions": ChromeOptions;
  "wdio:chromedriverOptions"?: ChromeDriverOptions;
}

interface RemoteOptions {
  capabilities: RemoteCapabilities;
}

export async function launchBrowser(): Promise<WebdriverIO.Browser> {
  const chromeBinary = envConfig.value(Environment.CHROME_BIN);
  const chromedriverPath = envConfig.value(Environment.CHROMEDRIVER_PATH);

  const chromeOptions: ChromeOptions = {
    args: [
      "--headless=new",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu"
    ]
  };

  if (chromeBinary) {
    chromeOptions.binary = chromeBinary;
  }

  const options: RemoteOptions = {
    capabilities: {
      browserName: "chrome" as const,
      "goog:chromeOptions": chromeOptions
    }
  };

  if (chromedriverPath) {
    options.capabilities["wdio:chromedriverOptions"] = {
      binary: chromedriverPath
    };
  }

  return remote(options);
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
