import debug from "debug";
import { envConfig } from "../env-config/env-config";
import { convertBufferToMarkdown } from "../document-conversion/document-conversion";
import { htmlToMarkdown } from "../migration/turndown-service-factory";
import { fetchPublicSiteDocument, fetchPublicSiteHtml } from "./public-site-fetch";

const debugLog = debug(envConfig.logNamespace("site-registration-documents"));

const GOOGLE_DOCUMENT = /docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/;
const DOCUMENT_FILE = /\.(pdf|docx)(?:$|[?#])/i;

export function googleDocumentId(url: string): string {
  return (url || "").match(GOOGLE_DOCUMENT)?.[1] || null;
}

export function isDocumentUrl(url: string): boolean {
  return !!googleDocumentId(url) || DOCUMENT_FILE.test(url || "");
}

export function documentFileName(url: string): string {
  const path = (url || "").split(/[?#]/)[0];
  return path.split("/").filter(Boolean).pop() || "document";
}

const GOOGLE_REDIRECT = /https:\/\/www\.google\.com\/url\?q=([^)&\s]+)[^)\s]*/g;
const MAXIMUM_HEADING_LENGTH = 120;

export function withoutGoogleRedirects(markdown: string): string {
  return (markdown || "").replace(GOOGLE_REDIRECT, (match, target) => decodeURIComponent(target));
}

export function withDocumentHeadings(markdown: string): string {
  const blocks = (markdown || "").split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
  return blocks.map((block, index) => {
    const alreadyMarkedUp = /^[#>*\-\d|]/.test(block) || block.includes("\n");
    if (alreadyMarkedUp || block.length > MAXIMUM_HEADING_LENGTH) {
      return block;
    } else if (block.endsWith("?")) {
      return `#### ${block}`;
    } else if (index === 0) {
      return `## ${block}`;
    } else {
      return block;
    }
  }).join("\n\n");
}

export async function documentMarkdown(url: string): Promise<string> {
  const googleId = googleDocumentId(url);
  if (googleId) {
    const html = await fetchPublicSiteHtml(`https://docs.google.com/document/d/${googleId}/export?format=html`);
    debugLog("google document %s exported %s characters of html", googleId, html.length);
    return withDocumentHeadings(withoutGoogleRedirects(htmlToMarkdown(html)));
  } else {
    const buffer = await fetchPublicSiteDocument(url);
    const converted = await convertBufferToMarkdown(buffer, documentFileName(url));
    debugLog("converted %s to %s characters of markdown", url, converted.markdown?.length || 0);
    return withDocumentHeadings(withoutGoogleRedirects(converted.markdown || ""));
  }
}
