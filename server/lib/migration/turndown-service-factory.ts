import TurndownService from "turndown";
import debug from "debug";
import he from "he";
import { envConfig } from "../env-config/env-config";

const debugLog = debug(envConfig.logNamespace("turndown-service-factory"));
debugLog.enabled = false;

const UNWANTED_ATTRIBUTES = [
  "class", "id", "style", "align", "border", "valign", "bgcolor",
  "cellpadding", "cellspacing", "hspace", "vspace", "frame", "rules",
  "width", "height", "onclick", "onload", "onerror", "onmouseover",
  "onmouseout", "onfocus", "onblur", "onchange", "onsubmit",
  "leftmargin", "topmargin", "background", "ref"
];

export function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced"
  });

  turndownService.remove(["style", "script", "noscript", "iframe", "object", "embed"]);

  return turndownService;
}

export function preprocessHtml(html: string, baseUrl?: string): string {
  let result = html;

  result = decodeHtmlEntities(result);
  result = stripClipboardCodeWrappers(result);
  result = unwrapAnchorsInAttributes(result);

  if (baseUrl) {
    result = resolveUrls(result, baseUrl);
  }

  result = normalizeImageSources(result);

  for (const attr of UNWANTED_ATTRIBUTES) {
    const re = new RegExp(`\\s${attr}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, "gim");
    result = result.replace(re, "");
  }

  return result;
}

export function decodeHtmlEntities(html: string): string {
  const decoded = he.decode(html);
  if (decoded !== html) {
    debugLog("decodeHtmlEntities: HTML was entity encoded, decoded length:", decoded.length);
  }
  return decoded;
}

export function stripClipboardCodeWrappers(html: string): string {
  if (!/(class\s*=\s*"[^"]*(line-content|html-tag)[^"]*"|<span>\s*<html>|<table[^>]*class\s*=\s*"[^"]*code[^"]*")/i.test(html)) {
    return html;
  }

  debugLog("stripClipboardCodeWrappers: detected clipboard HTML wrappers");

  let working = html;
  const match = working.match(/<table[^>]*class\s*=\s*"[^"]*code[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (match && match[1]) {
    working = `<html>${match[1]}</html>`;
  }

  working = working.replace(/<td[^>]*class\s*=\s*"[^"]*line-content[^"]*"[^>]*>([\s\S]*?)<\/td>/gi, (_match, group1) => group1);
  working = working.replace(/<td[^>]*class\s*=\s*"[^"]*line-number[^"]*"[^>]*>[\s\S]*?<\/td>/gi, "");
  working = working.replace(/<table[^>]*>/gi, "").replace(/<\/table>/gi, "");
  working = working.replace(/<tbody[^>]*>/gi, "").replace(/<\/tbody>/gi, "");
  working = working.replace(/<tr[^>]*>/gi, "").replace(/<\/tr>/gi, "");
  working = working.replace(/<td[^>]*>/gi, "").replace(/<\/td>/gi, "");
  working = working.replace(/<span[^>]*>/gi, "").replace(/<\/span>/gi, "");

  const decoded = he.decode(working);
  debugLog("stripClipboardCodeWrappers: cleaned length:", decoded.length);

  return decoded;
}

export function unwrapAnchorsInAttributes(html: string): string {
  const unwrap = (pattern: RegExp) => {
    html = html.replace(pattern, (_match, attr, value) => `${attr}="${value}"`);
  };
  unwrap(/(src|href)\s*=\s*"<a[^>]*>([\s\S]*?)<\/a>"/gi);
  unwrap(/(src|href)\s*=\s*'<a[^>]*>([\s\S]*?)<\/a>'/gi);
  return html;
}

function normalizeImageSources(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, match => {
    debugLog("normalizeImageSources: original tag:", match);
    const currentSrc = extractAttribute(match, "src");
    const requiresReplacement = !currentSrc || currentSrc.trim().length === 0 || currentSrc.trim().startsWith("data:");

    const candidateOrder = [
      "data-src",
      "data-original",
      "data-lazy-src",
      "data-lazyload",
      "data-srcset",
      "srcset"
    ];

    let fallbackSrc: string | null = null;

    for (const attributeName of candidateOrder) {
      const value = extractAttribute(match, attributeName);
      if (!value) {
        continue;
      }
      if (attributeName.endsWith("srcset")) {
        const parsed = extractFirstFromSrcset(value);
        if (parsed) {
          fallbackSrc = parsed;
          break;
        }
      } else if (value.trim().length > 0) {
        fallbackSrc = value.trim();
        break;
      }
    }

    if (!fallbackSrc || (!requiresReplacement && currentSrc && currentSrc.trim().length > 0 && !currentSrc.trim().startsWith("data:"))) {
      debugLog("normalizeImageSources: skipping replacement, currentSrc:", currentSrc, "fallbackSrc:", fallbackSrc, "requiresReplacement:", requiresReplacement);
      return match;
    }

    if (currentSrc) {
      const replaced = match.replace(/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/i, `src="${fallbackSrc}"`);
      debugLog("normalizeImageSources: replaced existing src tag:", replaced);
      return replaced;
    }

    const inserted = match.replace(/<img\b/i, `<img src="${fallbackSrc}" `);
    debugLog("normalizeImageSources: inserted src tag:", inserted);
    return inserted;
  });
}

function extractAttribute(tag: string, attribute: string): string | null {
  const regex = new RegExp(`${attribute}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i");
  const match = tag.match(regex);
  if (!match) {
    return null;
  }
  return match[2] ?? match[3] ?? match[4] ?? null;
}

function extractFirstFromSrcset(srcset: string): string | null {
  if (!srcset) {
    return null;
  }
  const candidates = srcset.split(",").map(item => item.trim()).filter(item => item.length > 0);
  if (candidates.length === 0) {
    return null;
  }
  const first = candidates[0];
  const parts = first.split(/\s+/);
  return parts.length > 0 ? parts[0] : null;
}

export function resolveUrls(html: string, baseUrl: string): string {
  if (!baseUrl) return html;

  let result = html;

  const srcPattern = /(<img[^>]+src\s*=\s*["'])([^"']+)(["'])/gi;
  result = result.replace(srcPattern, (match, prefix, url, suffix) => {
    try {
      const resolved = new URL(url, baseUrl).href;
      return `${prefix}${resolved}${suffix}`;
    } catch (e) {
      debugLog(`Failed to resolve image URL "${url}" with base "${baseUrl}":`, e instanceof Error ? e.message : String(e));
      return match;
    }
  });

  const hrefPattern = /(<a[^>]+href\s*=\s*["'])([^"']+)(["'])/gi;
  result = result.replace(hrefPattern, (match, prefix, url, suffix) => {
    try {
      const resolved = new URL(url, baseUrl).href;
      return `${prefix}${resolved}${suffix}`;
    } catch (e) {
      debugLog(`Failed to resolve link URL "${url}" with base "${baseUrl}":`, e instanceof Error ? e.message : String(e));
      return match;
    }
  });

  return result;
}

export function htmlToMarkdown(html: string, baseUrl?: string): string {
  debugLog("htmlToMarkdown: received html length:", html?.length ?? 0, "html:", html, "baseUrl:", baseUrl);
  const turndownService = createTurndownService();
  const cleanHtml = preprocessHtml(html, baseUrl);
  debugLog("htmlToMarkdown: cleanHtml length:", cleanHtml.length, "cleanHtml:", cleanHtml.slice(0, 500));
  const markdown = turndownService.turndown(cleanHtml);
  debugLog("htmlToMarkdown: markdown snippet:", markdown.slice(0, 500));

  return postProcessMarkdown(markdown);
}

function postProcessMarkdown(markdown: string): string {
  if (!markdown) {
    return "";
  }

  let result = markdown;

  result = result.replace(/<style[\s\S]*?<\/style>/gi, "");
  result = result.replace(/<script[\s\S]*?<\/script>/gi, "");
  result = result.replace(/<!--[\s\S]*?-->/g, "");
  result = result.replace(/<[^>]+>/g, "");
  result = result.replace(/&nbsp;/gi, " ");
  result = result.replace(/\u00A0/g, " ");
  result = result.replace(/&amp;/gi, "&");
  result = result.replace(/&lt;/gi, "<");
  result = result.replace(/&gt;/gi, ">");
  result = result.replace(/&quot;/gi, "\"");
  result = result.replace(/&#39;/gi, "'");
  result = result.replace(/['"]\s*,\s*(sans-serif|serif|monospace|cursive|fantasy)\s*['"]/gi, "");
  result = result.replace(/,\s*(sans-serif|serif|monospace|cursive|fantasy)(["'>]|\b)/gi, "$2");
  result = result.replace(/["']\s*>+/g, "");
  result = result.replace(/\b(font(-family|-size|-weight|-style)?|margin|padding|line-height|color|background(-color)?|text-align|width|height|border([^-]|$)|border-(top|right|bottom|left)(-width|-style|-color)?|vertical-align|white-space|display|position|top|left|right|bottom|z-index|float|clear|letter-spacing|word-spacing)\s*:\s*[^;\n]+;?/gi, "");
  result = result.replace(/\b[a-zA-Z-]+="[^"]*"/g, "");
  result = result.replace(/\b[a-zA-Z-]+='[^']*'/g, "");
  result = result.replace(/ {2,}/g, " ");
  result = result.replace(/^[ \t]+/gm, "");
  result = result.replace(/[ \t]+\n/g, "\n");
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.replace(/^>+\s*/gm, "");

  return result;
}
