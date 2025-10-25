import { inject, Injectable } from "@angular/core";
import { Logger, LoggerFactory } from "./logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Injectable({
  providedIn: "root"
})
export class PasteDetectionService {
  private logger: Logger = inject(LoggerFactory).createLogger("PasteDetectionService", NgxLoggerLevel.INFO);

  isSignificantHtml(html: string, plainText: string): boolean {
    if (!html || html.trim().length === 0) {
      console.log("[PasteDetection] No HTML, returning false");
      return false;
    }

    const trimmedHtml = html.trim();
    const trimmedPlain = (plainText || "").trim();

    console.log("[PasteDetection] HTML length:", trimmedHtml.length);
    console.log("[PasteDetection] Plain length:", trimmedPlain.length);
    console.log("[PasteDetection] HTML (first 300):", trimmedHtml.substring(0, 300));
    console.log("[PasteDetection] Plain (first 300):", trimmedPlain.substring(0, 300));

    if (!trimmedPlain || trimmedPlain.length === 0) {
      console.log("[PasteDetection] No plain text, HTML is significant");
      return true;
    }

    const hasSignificantTags = this.hasSignificantHtmlTags(trimmedHtml);
    console.log("[PasteDetection] Has significant tags?", hasSignificantTags);

    if (!hasSignificantTags) {
      const isBrowserWrapperHtml = this.matchesBrowserWrapperPattern(trimmedHtml, trimmedPlain);
      if (isBrowserWrapperHtml) {
        console.log("[PasteDetection] Browser wrapper detected, returning false");
        return false;
      }
    }

    const strippedHtml = this.stripTags(trimmedHtml).trim();
    const normalizedPlain = trimmedPlain.replace(/\r\n/g, "\n").trim();
    const normalizedStripped = strippedHtml.replace(/\r\n/g, "\n").trim();

    console.log("[PasteDetection] Stripped HTML (first 300):", normalizedStripped.substring(0, 300));
    console.log("[PasteDetection] Stripped === Plain?", normalizedStripped === normalizedPlain);

    if (normalizedStripped === normalizedPlain && !hasSignificantTags) {
      console.log("[PasteDetection] Stripped matches plain and no significant tags, returning false");
      return false;
    }

    if (hasSignificantTags) {
      const onlyFormatting = this.isOnlyFormattingTags(trimmedHtml, normalizedStripped, normalizedPlain);
      console.log("[PasteDetection] Only formatting tags?", onlyFormatting);
      if (onlyFormatting) {
        console.log("[PasteDetection] Only formatting, returning false");
        return false;
      }

      console.log("[PasteDetection] Has significant tags, returning true");
      return true;
    }

    const plainTextLength = trimmedPlain.length;
    const htmlLength = trimmedHtml.length;
    const isSubstantiallyLonger = htmlLength > plainTextLength * 1.5;

    console.log("[PasteDetection] Substantially longer?", isSubstantiallyLonger, `(${htmlLength} vs ${plainTextLength})`);
    return isSubstantiallyLonger;
  }

  private isOnlyFormattingTags(html: string, strippedText: string, plainText: string): boolean {
    const withoutFormatting = html.replace(/<\/?(?:p|br|span|div)[^>]*>/gi, "");
    const hasStructuralTags = /<(?:table|img|a|h[1-6]|ul|ol|li|strong|b|em|i|code|pre|blockquote)[\s>]/i.test(withoutFormatting);

    if (hasStructuralTags) {
      return false;
    }

    if (strippedText === plainText) {
      return true;
    }

    const hasMultipleParagraphs = (html.match(/<p[\s>]/gi) || []).length > 1;
    if (hasMultipleParagraphs) {
      return false;
    }

    return true;
  }

  private matchesBrowserWrapperPattern(html: string, plainText: string): boolean {
    const chromeWrapperPattern = /^<meta[^>]*charset[^>]*>(<[^>]+>)?.*?(<\/[^>]+>)?$/i;
    if (chromeWrapperPattern.test(html)) {
      return true;
    }

    const simpleSpanPattern = /^<span[^>]*>.*<\/span>$/is;
    if (simpleSpanPattern.test(html) && this.stripTags(html).trim() === plainText) {
      return true;
    }

    const simpleDivPattern = /^<div[^>]*>.*<\/div>$/is;
    if (simpleDivPattern.test(html) && this.stripTags(html).trim() === plainText) {
      return true;
    }

    return false;
  }

  private hasSignificantHtmlTags(html: string): boolean {
    const significantTags = [
      /<table[\s>]/i,
      /<img[\s>]/i,
      /<a[\s>][^>]*href/i,
      /<h[1-6][\s>]/i,
      /<ul[\s>]/i,
      /<ol[\s>]/i,
      /<li[\s>]/i,
      /<p[\s>]/i,
      /<br[\s/>]/i,
      /<strong[\s>]/i,
      /<b[\s>]/i,
      /<em[\s>]/i,
      /<i[\s>]/i,
      /<code[\s>]/i,
      /<pre[\s>]/i,
      /<blockquote[\s>]/i
    ];

    return significantTags.some(pattern => pattern.test(html));
  }

  private stripTags(html: string): string {
    const withoutTags = html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<p[^>]*>/gi, "")
      .replace(/<\/p>/gi, "")
      .replace(/<[^>]*>/g, "");

    const textarea = document.createElement("textarea");
    textarea.innerHTML = withoutTags;
    return textarea.value;
  }

  hasMarkdownImages(markdown: string): boolean {
    return /!\[([^\]]*)]\(([^)]+)\)/.test(markdown);
  }

  isLocalPath(text: string): boolean {
    const trimmed = text.trim();
    return /^\/[A-Za-z0-9\-\/._~#?=&%]+$/.test(trimmed) && !/^\/\//.test(trimmed);
  }

  isViewSourceUrl(text: string): boolean {
    const trimmed = text.trim();
    const isViewSourceUrl = /^view-source:https?:\/\//i.test(trimmed);
    this.logger.info("given text:", text, "isViewSourceUrl:", isViewSourceUrl);
    return isViewSourceUrl;
  }
}
