import type { Browser } from "playwright";

export interface BaseHrefResult {
  baseHref: string | null;
}

export interface HtmlFetchResult {
  html: string;
  baseUrl: string;
}

export interface BrowserContext {
  browser: Browser;
}

export enum ExtractedContentKind {
  TEXT = "text",
  IMAGE = "image"
}
