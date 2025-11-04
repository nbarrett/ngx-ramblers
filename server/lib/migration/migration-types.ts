export interface BaseHrefResult {
  baseHref: string | null;
}

export interface HtmlFetchResult {
  html: string;
  baseUrl: string;
}

export interface BrowserContext {
  browser: WebdriverIO.Browser;
}
