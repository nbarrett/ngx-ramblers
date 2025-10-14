import debug from "debug";
import { envConfig } from "../env-config/env-config";
import {
  ContentMatcher,
  ContentMatchType,
  ImageMatchPattern,
  NestedRowsConfig,
  PageTransformationConfig,
  SegmentType,
  TextMatchPattern,
  TransformationAction,
  TransformationActionType,
  TransformationContext
} from "../../../projects/ngx-ramblers/src/app/models/page-transformation.model";
import {
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {
  ScrapedImage,
  ScrapedPage,
  ScrapedSegment
} from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import * as exclusions from "./text-exclusions";
import { humaniseFileStemFromUrl } from "../shared/string-utils";
import { DateTime } from "luxon";

const debugLog = debug(envConfig.logNamespace("page-transformation-engine"));
debugLog.enabled = true;

export class PageTransformationEngine {
  private imageAltFrom(image: ScrapedImage, fallbackText?: string): string {
    const preferred = (image?.alt || "").trim() || (fallbackText || "").trim();
    return preferred || humaniseFileStemFromUrl(image?.src || "");
  }

  private filenameFromUrl(url: string): string {
    try {
      return decodeURIComponent(new URL(url || "").pathname.split("/").pop() || "");
    } catch {
      return decodeURIComponent((url || "").split("/").pop() || "");
    }
  }

  private matchesGlobList(text: string, patternList?: string): boolean {
    if (!patternList) return true;
    const items = String(patternList)
      .split(/[,;|]/)
      .map(s => s.trim())
      .filter(Boolean);
    if (items.length === 0) return true;
    const tl = (text || "").toLowerCase();
    return items.some(p => {
      const esc = p
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      try {
        return new RegExp(`^${esc}$`, "i").test(text);
      } catch {
        const pl = p.replace(/\*/g, "").toLowerCase();
        return tl.includes(pl);
      }
    });
  }

  async transform(scrapedPage: ScrapedPage, config: PageTransformationConfig, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<PageContent> {
    const ctx: TransformationContext = {
      originalHtml: "",
      markdown: "",
      originalUrl: scrapedPage.path,
      segments: scrapedPage.segments || [],
      rows: [],
      remainingText: [],
      remainingImages: [],
      usedTextIndices: new Set(),
      usedImageIndices: new Set()
    };

    debugLog(`✅ Starting transformation: ${config.name} for page: ${scrapedPage.path}`);
    debugLog(`   Segments: ${ctx.segments.length}`);
    debugLog(`   First 3 segments:`, ctx.segments.slice(0, 3).map((s, i) => ({
      index: i,
      hasText: !!s.text,
      hasImage: !!s.image,
      textPreview: s.text ? s.text.substring(0, 50) : null,
      imageSrc: s.image ? s.image.src : null
    })));

    for (const step of config.steps) {
      await this.executeStep(step, ctx, uploadImageFn);
    }

    return {
      path: "",
      rows: ctx.rows
    };
  }

  private async executeStep(step: TransformationAction, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<void> {
    debugLog(`✅ Executing step: ${step.type}`);

    switch (step.type) {
      case TransformationActionType.CONVERT_TO_MARKDOWN:
        this.convertToMarkdown(ctx);
        break;

      case TransformationActionType.CREATE_PAGE:
        break;

      case TransformationActionType.ADD_ROW:
        await this.addRow(step, ctx, uploadImageFn);
        break;

      case TransformationActionType.ADD_COLUMN:
        await this.addColumn(step, ctx, uploadImageFn);
        break;

      case TransformationActionType.ADD_NESTED_ROWS:
        await this.addNestedRows(step, ctx, uploadImageFn);
        break;

      case TransformationActionType.ADD_MIGRATION_NOTE: {
        const prefix = step.notePrefix || "Migrated from";
        const fmt = step.dateFormat || "yyyy-LL-dd HH:mm";
        const when = DateTime.now().toFormat(fmt);
        const url = (ctx as any).originalUrl || "";
        const safeUrlText = url;
        const note = `${prefix} [${safeUrlText}](${url}) on ${when}`;
        ctx.rows.push({
          type: PageContentType.TEXT,
          maxColumns: 1,
          showSwiper: false,
          columns: [{ columns: 12, contentText: note }]
        });
        break;
      }


      case TransformationActionType.FIND_AND_ADD_TEXT:
        await this.findAndAddText(step, ctx);
        break;

      case TransformationActionType.FIND_AND_ADD_IMAGE:
        await this.findAndAddImage(step, ctx, uploadImageFn);
        break;

      case TransformationActionType.SPLIT_TEXT_BY_IMAGES:
        await this.splitTextByImages(step, ctx, uploadImageFn);
        break;

      default:
        debugLog(`⚠️ Unknown step type: ${step.type}`);
    }
  }

  private convertToMarkdown(ctx: TransformationContext): void {
    debugLog("Converting to markdown");
    const textSegments = ctx.segments.filter(s => s.text && !s.image);
    ctx.markdown = textSegments.map(s => exclusions.cleanMarkdown(s.text)).join("\n\n");
    ctx.remainingText = textSegments.map(s => exclusions.cleanMarkdown(s.text));
    ctx.remainingImages = ctx.segments.filter(s => s.image).map(s => s.image);
    debugLog(`   Text segments: ${ctx.remainingText.length}, Images: ${ctx.remainingImages.length}`);
  }

  private async addRow(step: TransformationAction, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<void> {
    if (!step.rowConfig) {
      debugLog("⚠️ No row config provided");
      return;
    }

    debugLog(`Adding row: ${step.rowConfig.description || "no description"}`);

    const row: PageContentRow = {
      type: step.rowConfig.type || PageContentType.TEXT,
      maxColumns: step.rowConfig.maxColumns || 1,
      showSwiper: step.rowConfig.showSwiper || false,
      columns: [],
      marginTop: step.rowConfig.marginTop,
      marginBottom: step.rowConfig.marginBottom
    };

    for (const colConfig of step.rowConfig.columns) {
      const column = await this.buildColumn(colConfig, ctx, uploadImageFn);
      if (column) {
        row.columns.push(column);
      }
    }

    ctx.rows.push(row);
    debugLog(`   Row added with ${row.columns.length} columns`);
  }

  private async buildColumn(colConfig: any, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<PageContentColumn | null> {
    const column: PageContentColumn = {
      columns: colConfig.columns || 12,
      accessLevel: AccessLevel.public
    };

    if (colConfig.content) {
      const content = await this.matchContent(colConfig.content, ctx, uploadImageFn);
      if (content) {
        Object.assign(column, content);
      }
    }

    if (colConfig.nestedRows) {
      column.rows = await this.buildNestedRows(colConfig.nestedRows, ctx, uploadImageFn);
    }

    if (colConfig.rows && colConfig.rows.length > 0) {
      column.rows = await this.buildExplicitNestedRows(colConfig.rows, ctx, uploadImageFn);
    }

    return column;
  }

  private async buildExplicitNestedRows(rowConfigs: any[], ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<PageContentRow[]> {
    const rows: PageContentRow[] = [];

    debugLog(`Building ${rowConfigs.length} explicit nested rows`);

    for (const rowConfig of rowConfigs) {
      if (rowConfig.type === PageContentType.SHARED_FRAGMENT) {
        const row: PageContentRow = {
          type: rowConfig.type,
          maxColumns: rowConfig.maxColumns || 1,
          showSwiper: rowConfig.showSwiper || false,
          columns: [],
          fragment: rowConfig.fragment
        };
        rows.push(row);
        debugLog(`   Added shared fragment row: ${rowConfig.fragment?.pageContentId}`);
      } else {
        const row: PageContentRow = {
          type: rowConfig.type || PageContentType.TEXT,
          maxColumns: rowConfig.maxColumns || 1,
          showSwiper: rowConfig.showSwiper || false,
          columns: []
        };

        for (const colConfig of rowConfig.columns) {
          const column = await this.buildColumn(colConfig, ctx, uploadImageFn);
          if (column) {
            row.columns.push(column);
          }
        }

        rows.push(row);
        debugLog(`   Added explicit nested row with ${row.columns.length} columns`);
      }
    }

    return rows;
  }

  private async buildNestedRows(nestedRowsConfig: NestedRowsConfig, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<PageContentRow[]> {
    const rows: PageContentRow[] = [];
    const matcher = nestedRowsConfig.contentMatcher;
    const defaultTemplate = {
      type: PageContentType.TEXT,
      maxColumns: 1,
      showSwiper: false
    };

    const textTemplate = nestedRowsConfig.textRowTemplate || nestedRowsConfig.rowTemplate || defaultTemplate;
    const imageTemplate = nestedRowsConfig.imageRowTemplate || nestedRowsConfig.rowTemplate || defaultTemplate;

    debugLog(`Building nested rows with matcher type: ${matcher.type}`);

    if (matcher.type === ContentMatchType.COLLECT_WITH_BREAKS) {
      return this.collectWithBreaks(matcher, textTemplate, imageTemplate, ctx, uploadImageFn);
    }

    return rows;
  }

  private async matchContent(matcher: ContentMatcher, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<Partial<PageContentColumn> | null> {
    debugLog(`Matching content: type=${matcher.type}, textPattern=${matcher.textPattern}, imagePattern=${matcher.imagePattern}`);

    switch (matcher.type) {
      case ContentMatchType.TEXT:
        return this.matchText(matcher, ctx);

      case ContentMatchType.IMAGE:
        return this.matchImage(matcher, ctx, uploadImageFn);

      case ContentMatchType.ALL_CONTENT:
        return this.matchAll(ctx, uploadImageFn);

      case ContentMatchType.HEADING:
        return this.matchHeading(ctx);

      case ContentMatchType.REMAINING:
        return this.matchRemaining(ctx);

      case ContentMatchType.COLLECT_WITH_BREAKS:
        debugLog("⚠️ COLLECT_WITH_BREAKS should be used in nestedRows config, not as direct content matcher");
        return null;

      default:
        debugLog(`⚠️ Unknown content match type: ${matcher.type}`);
        return null;
    }
  }

  private matchText(matcher: ContentMatcher, ctx: TransformationContext): Partial<PageContentColumn> | null {
    debugLog(`Matching text with pattern: ${matcher.textPattern}`);

    switch (matcher.textPattern) {
      case TextMatchPattern.STARTS_WITH_HEADING: {
        for (let i = 0; i < ctx.segments.length; i++) {
          const seg = ctx.segments[i];
          if (seg.text && !seg.image && !ctx.usedTextIndices.has(i)) {
            const cleaned = exclusions.cleanMarkdown(seg.text);
            if (this.isHeadingText(cleaned)) {
              ctx.usedTextIndices.add(i);
              debugLog(`   Found heading start at index ${i}`);
              return {contentText: cleaned};
            }
          }
        }
        return null;
      }

      case TextMatchPattern.ALL_TEXT_UNTIL_IMAGE: {
        const textBeforeFirstImage: string[] = [];
        for (let i = 0; i < ctx.segments.length; i++) {
          const seg = ctx.segments[i];
          if (seg.image) break;
          if (seg.text && !ctx.usedTextIndices.has(i)) {
            textBeforeFirstImage.push(exclusions.cleanMarkdown(seg.text));
            ctx.usedTextIndices.add(i);
          }
        }
        const contentText = textBeforeFirstImage.join("\n\n");
        debugLog(`   Found ${textBeforeFirstImage.length} text segments before first image`);
        return contentText ? {contentText} : null;
      }

      case TextMatchPattern.ALL_TEXT_AFTER_HEADING: {
        let foundHeading = false;
        const textAfterHeading: string[] = [];
        for (let i = 0; i < ctx.segments.length; i++) {
          const seg = ctx.segments[i];
          if (seg.text && !seg.image) {
            const cleaned = exclusions.cleanMarkdown(seg.text);
            const isHeading = this.isHeadingText(cleaned);
            if (isHeading) {
              foundHeading = true;
              textAfterHeading.push(cleaned);
              ctx.usedTextIndices.add(i);
            } else if (foundHeading && !ctx.usedTextIndices.has(i)) {
              textAfterHeading.push(cleaned);
              ctx.usedTextIndices.add(i);
              if (ctx.segments[i + 1]?.image) break;
            }
          }
        }
        const contentText = textAfterHeading.join("\n\n");
        debugLog(`   Found ${textAfterHeading.length} text segments after heading`);
        return contentText ? {contentText} : null;
      }

      case TextMatchPattern.CUSTOM_REGEX: {
        if (!matcher.customRegex) {
          debugLog("⚠️ No customRegex provided");
          return null;
        }
        const unused: { index: number; text: string }[] = [];
        for (let i = 0; i < ctx.segments.length; i++) {
          const seg = ctx.segments[i];
          if (seg.text && !seg.image && !ctx.usedTextIndices.has(i)) {
            unused.push({ index: i, text: exclusions.cleanMarkdown(seg.text) });
          }
        }
        const joined = unused.map(u => u.text).join("\n\n");
        const regex = new RegExp(matcher.customRegex, "ms");
        const m = joined.match(regex);
        if (!m) {
          debugLog("   ⚠️ customRegex did not match any text");
          return null;
        }
        const matched = m[0];
        let remaining = matched.length;
        for (const u of unused) {
          if (remaining <= 0) break;
          if (u.text.length <= remaining) {
            ctx.usedTextIndices.add(u.index);
            remaining -= u.text.length + 2;
          } else {
            ctx.usedTextIndices.add(u.index);
            remaining = 0;
          }
        }
        debugLog(`   Matched customRegex length ${matched.length}`);
        return {contentText: matched};
      }

      case TextMatchPattern.REMAINING_TEXT: {
        const remainingText: string[] = [];
        for (let i = 0; i < ctx.segments.length; i++) {
          const seg = ctx.segments[i];
          if (seg.text && !seg.image && !ctx.usedTextIndices.has(i)) {
            remainingText.push(exclusions.cleanMarkdown(seg.text));
            ctx.usedTextIndices.add(i);
          }
        }
        const contentText = remainingText.join("\n\n");
        debugLog(`   Found ${remainingText.length} remaining text segments`);
        return contentText ? {contentText} : null;
      }

      case TextMatchPattern.PARAGRAPH: {
        for (let i = 0; i < ctx.segments.length; i++) {
          const seg = ctx.segments[i];
          if (seg.text && !seg.image && !ctx.usedTextIndices.has(i)) {
            const contentText = exclusions.cleanMarkdown(seg.text);
            ctx.usedTextIndices.add(i);
            debugLog(`   Found paragraph at index ${i}`);
            return {contentText};
          }
        }
        return null;
      }

      default:
        debugLog(`⚠️ Unknown text pattern: ${matcher.textPattern}`);
        return null;
    }
  }

  private async matchImage(matcher: ContentMatcher, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<Partial<PageContentColumn> | null> {
    debugLog(`Matching image with pattern: ${matcher.imagePattern}, filenamePattern: ${matcher.filenamePattern}`);

    switch (matcher.imagePattern) {
      case ImageMatchPattern.FILENAME_PATTERN: {
        if (!matcher.filenamePattern) {
          debugLog("⚠️ No filename pattern provided");
          return null;
        }
        for (let i = 0; i < ctx.segments.length; i++) {
          const seg = ctx.segments[i];
          if (seg.image && !ctx.usedImageIndices.has(i)) {
            const filename = this.filenameFromUrl(seg.image.src || "");
            debugLog(`   Checking image: ${filename} against pattern(s): ${matcher.filenamePattern}`);
            if (this.matchesGlobList(filename, matcher.filenamePattern)) {
              const imageSource = await uploadImageFn(seg.image);
              const alt = this.imageAltFrom(seg.image);
              ctx.usedImageIndices.add(i);

              let contentText: string | undefined;
              let showTextAfterImage: boolean | undefined;

              if (matcher.groupTextWithImage && i + 1 < ctx.segments.length) {
                const nextSegment = ctx.segments[i + 1];
                if (nextSegment.text && !nextSegment.image && !ctx.usedTextIndices.has(i + 1)) {
                  const nextText = exclusions.cleanMarkdown(nextSegment.text);
                  if (nextText.length <= 100 && !this.isHeadingText(nextText)) {
                    contentText = nextText;
                    showTextAfterImage = true;
                    ctx.usedTextIndices.add(i + 1);
                    debugLog(`   Grouped caption with image: "${contentText}"`);
                  }
                }
              }

              debugLog(`   ✅ Matched image: ${filename}`);
              return {imageSource, alt, imageBorderRadius: 6, contentText, showTextAfterImage};
            }
          }
        }
        debugLog(`   ⚠️ No image matched pattern(s): ${matcher.filenamePattern}`);
        return null;
      }

      case ImageMatchPattern.ALT_TEXT_PATTERN: {
        if (!matcher.altTextPattern) {
          debugLog("⚠️ No altText pattern provided");
          return null;
        }
        const regex = new RegExp(matcher.altTextPattern, "i");
        for (let i = 0; i < ctx.segments.length; i++) {
          const seg = ctx.segments[i];
          if (seg.image && !ctx.usedImageIndices.has(i)) {
            const alt = seg.image.alt || "";
            if (regex.test(alt)) {
              const imageSource = await uploadImageFn(seg.image);
              ctx.usedImageIndices.add(i);
              debugLog(`   ✅ Matched image by alt at index ${i}`);
              return {imageSource, alt: alt || "Image", imageBorderRadius: 6};
            }
          }
        }
        debugLog("   ⚠️ No image matched alt text pattern");
        return null;
      }

      case ImageMatchPattern.FIRST_IMAGE: {
        for (let i = 0; i < ctx.segments.length; i++) {
          const seg = ctx.segments[i];
          if (seg.image && !ctx.usedImageIndices.has(i)) {
            const imageSource = await uploadImageFn(seg.image);
            const alt = this.imageAltFrom(seg.image);
            ctx.usedImageIndices.add(i);
            debugLog(`   Found first image at index ${i}`);
            return {imageSource, alt, imageBorderRadius: 6};
          }
        }
        return null;
      }

      case ImageMatchPattern.REMAINING_IMAGES: {
        for (let i = 0; i < ctx.segments.length; i++) {
          const seg = ctx.segments[i];
          if (seg.image && !ctx.usedImageIndices.has(i)) {
            const imageSource = await uploadImageFn(seg.image);
            const alt = seg.image.alt || "Image";
            ctx.usedImageIndices.add(i);
            debugLog(`   Returned remaining image at index ${i}`);
            return {imageSource, alt, imageBorderRadius: 6};
          }
        }
        return null;
      }

      case ImageMatchPattern.ALL_IMAGES: {
        const imagesMarkdown: string[] = [];
        for (let i = 0; i < ctx.segments.length; i++) {
          const seg = ctx.segments[i];
          if (seg.image) {
            const imageSource = await uploadImageFn(seg.image);
            const alt = this.imageAltFrom(seg.image, seg.text);
            imagesMarkdown.push(`![${alt}](${imageSource})`);
          }
        }
        const contentText = imagesMarkdown.join("\n\n");
        debugLog(`   Returned ALL_IMAGES as markdown: ${imagesMarkdown.length}`);
        return contentText ? {contentText} : null;
      }

      default:
        debugLog(`⚠️ Unknown image pattern: ${matcher.imagePattern}`);
        return null;
    }
  }

  private async matchAll(ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<Partial<PageContentColumn> | null> {
    const allContent: string[] = [];
    for (let i = 0; i < ctx.segments.length; i++) {
      const seg = ctx.segments[i];
      if (seg.text && !seg.image) {
        // Text-only segment
        allContent.push(exclusions.cleanMarkdown(seg.text));
      } else if (seg.image) {
        // Image segment - upload to S3 if configured, then include as markdown image syntax
        const imageSource = await uploadImageFn(seg.image);
        const alt = this.imageAltFrom(seg.image, seg.text);
        allContent.push(`![${alt}](${imageSource})`);
      }
    }
    const contentText = allContent.join("\n\n");
    debugLog(`   Matched all content: ${allContent.length} segments (including images)`);
    return contentText ? {contentText} : null;
  }

  private matchHeading(ctx: TransformationContext): Partial<PageContentColumn> | null {
    for (let i = 0; i < ctx.segments.length; i++) {
      const seg = ctx.segments[i];
      if (seg.text && !seg.image && !ctx.usedTextIndices.has(i)) {
        const cleaned = exclusions.cleanMarkdown(seg.text);
        const isHeading = this.isHeadingText(cleaned);
        if (isHeading) {
          ctx.usedTextIndices.add(i);
          debugLog(`   Found heading at index ${i}`);
          return {contentText: cleaned};
        }
      }
    }
    return null;
  }

  private matchRemaining(ctx: TransformationContext): Partial<PageContentColumn> | null {
    const remaining: string[] = [];
    for (let i = 0; i < ctx.segments.length; i++) {
      const seg = ctx.segments[i];
      if (seg.text && !seg.image && !ctx.usedTextIndices.has(i)) {
        remaining.push(exclusions.cleanMarkdown(seg.text));
        ctx.usedTextIndices.add(i);
      }
    }
    const contentText = remaining.join("\n\n");
    debugLog(`   Matched remaining: ${remaining.length} segments`);
    return contentText ? {contentText} : null;
  }

  private async addColumn(step: TransformationAction, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<void> {
    if (!step.columnConfig) {
      debugLog("⚠️ No column config provided");
      return;
    }

    if (step.targetRow === undefined) {
      debugLog("⚠️ No target row specified");
      return;
    }

    const rowIndex = step.targetRow - 1;
    const row = ctx.rows[rowIndex];
    if (!row) {
      debugLog(`⚠️ Row ${step.targetRow} not found (index ${rowIndex})`);
      return;
    }

    const column = await this.buildColumn(step.columnConfig, ctx, uploadImageFn);
    if (column) {
      row.columns.push(column);
      debugLog(`   Column added to row ${step.targetRow} (index ${rowIndex})`);
    }
  }

  private async addNestedRows(step: TransformationAction, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<void> | Promise<string>): Promise<void> {
    if (step.targetRow === undefined || step.targetColumn === undefined || !step.contentMatcher) {
      debugLog("⚠️ add-nested-rows requires targetRow, targetColumn and contentMatcher");
      return;
    }

    const rowIndex = step.targetRow - 1;
    const columnIndex = step.targetColumn - 1;
    const row = ctx.rows[rowIndex];
    if (!row) {
      debugLog(`⚠️ Row ${step.targetRow} not found (index ${rowIndex})`);
      return;
    }
    const column = row.columns[columnIndex];
    if (!column) {
      debugLog(`⚠️ Column ${step.targetColumn} not found in row ${step.targetRow}`);
      return;
    }

    const nestedRowsConfig: NestedRowsConfig = {
      contentMatcher: step.contentMatcher
    };
    const rows = await this.buildNestedRows(nestedRowsConfig, ctx, uploadImageFn as any);
    column.rows = [...(column.rows || []), ...rows];
    debugLog(`   Added ${rows.length} nested rows to row ${rowIndex}, column ${columnIndex}`);
  }

  private getSegmentType(segment: ScrapedSegment): SegmentType {
    if (segment.image) {
      return SegmentType.IMAGE;
    }
    if (segment.text) {
      const cleaned = exclusions.cleanMarkdown(segment.text);
      const isHeading = this.isHeadingText(cleaned);
      return isHeading ? SegmentType.HEADING : SegmentType.TEXT;
    }
    return SegmentType.TEXT;
  }

  private isHeadingText(text: string): boolean {
    const atxHeading = /(^|\n)\s*#+\s+/.test(text);
    const setextHeading = /^.+\n[=\-]{3,}\s*$/m.test(text);
    return atxHeading || setextHeading;
  }

  private shouldStopCollection(segmentType: SegmentType, stopCondition?: { onDetect: SegmentType[] }): boolean {
    if (!stopCondition || !stopCondition.onDetect) {
      return false;
    }
    return stopCondition.onDetect.includes(segmentType);
  }

  private async collectWithBreaks(matcher: ContentMatcher, textRowTemplate: any, imageRowTemplate: any, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<PageContentRow[]> {
    const rows: PageContentRow[] = [];
    let currentTextBuffer: string[] = [];
    let rowCount = 0;
    let addedImageCount = 0;

    debugLog(`Collecting with breaks: breakOnImage=${matcher.breakOnImage}, groupTextWithImage=${matcher.groupTextWithImage}, stopCondition=${JSON.stringify(matcher.stopCondition)}`);
    debugLog(`   Text row type: ${textRowTemplate.type}, Image row type: ${imageRowTemplate.type}`);

    for (let i = 0; i < ctx.segments.length; i++) {
      if (ctx.usedTextIndices.has(i) || ctx.usedImageIndices.has(i)) {
        continue;
      }

      const segment = ctx.segments[i];

      if (segment.text && !segment.image) {
        const cleaned = exclusions.cleanMarkdown(segment.text);
        const segmentType = this.getSegmentType(segment);

        if (this.shouldStopCollection(segmentType, matcher.stopCondition)) {
          debugLog(`   Stopping collection at index ${i} due to detection of ${segmentType}`);

          const atx = cleaned.match(/(^|\n)\s*#+\s+/);
          const setext = cleaned.match(/(^|\n)[^\n]+\n[=\-]{3,}\s*$/m);
          let headingIndex: number | null = null;
          if (atx) headingIndex = atx.index! + (atx[1] === "\n" ? 1 : 0);
          else if (setext) headingIndex = setext.index! + (setext[1] === "\n" ? 1 : 0);
          if (headingIndex !== null) {
            const textBeforeHeading = cleaned.substring(0, headingIndex).trim();
            if (textBeforeHeading) {
              // Check if this short text should be a caption for the last image row
              if (matcher.groupTextWithImage && textBeforeHeading.length <= 100 && !this.isHeadingText(textBeforeHeading) && rows.length > 0) {
                const lastRow = rows[rows.length - 1];
                // Check if the last row is an image row
                if (lastRow.columns.length > 0 && lastRow.columns[0].imageSource) {
                  lastRow.columns[0].contentText = textBeforeHeading;
                  lastRow.columns[0].showTextAfterImage = true;
                  ctx.usedTextIndices.add(i);
                  debugLog(`   Grouped text before heading as caption for last image: "${textBeforeHeading}"`);
                } else {
                  debugLog(`   Including text before heading: ${textBeforeHeading.substring(0, 50)}`);
                  currentTextBuffer.push(textBeforeHeading);
                }
              } else {
                debugLog(`   Including text before heading: ${textBeforeHeading.substring(0, 50)}`);
                currentTextBuffer.push(textBeforeHeading);
              }
            }
          }

          break;
        }

        currentTextBuffer.push(cleaned);
        ctx.usedTextIndices.add(i);
      } else if (segment.image) {
        const includeImage = (() => {
          switch (matcher.imagePattern) {
            case ImageMatchPattern.FIRST_IMAGE:
              return addedImageCount === 0;
            case ImageMatchPattern.FILENAME_PATTERN: {
              const name = this.filenameFromUrl(segment.image.src || "");
              return this.matchesGlobList(name, matcher.filenamePattern);
            }
            case ImageMatchPattern.ALT_TEXT_PATTERN: {
              const alt = segment.image.alt || "";
              return this.matchesGlobList(alt, matcher.altTextPattern);
            }
            case ImageMatchPattern.ALL_IMAGES:
            case ImageMatchPattern.REMAINING_IMAGES:
            default:
              return true;
          }
        })();

        if (!includeImage) {
          continue;
        }
        if (currentTextBuffer.length > 0) {
          const textRow: PageContentRow = {
            type: textRowTemplate.type,
            maxColumns: textRowTemplate.maxColumns,
            showSwiper: textRowTemplate.showSwiper,
            columns: [{
              columns: 12,
              contentText: currentTextBuffer.join("\n\n"),
              accessLevel: AccessLevel.public
            }]
          };
          rows.push(textRow);
          rowCount++;
          currentTextBuffer = [];
        }

        if (matcher.breakOnImage) {
          const imageSource = await uploadImageFn(segment.image);
          let imageCaption: string | null = null;

          if (matcher.groupTextWithImage && i + 1 < ctx.segments.length) {
            const nextSegment = ctx.segments[i + 1];
            if (nextSegment.text && !nextSegment.image && !ctx.usedTextIndices.has(i + 1)) {
              const nextText = exclusions.cleanMarkdown(nextSegment.text);
              if (nextText.length <= 100 && !this.isHeadingText(nextText)) {
                imageCaption = nextText;
                ctx.usedTextIndices.add(i + 1);
                debugLog(`   Grouped caption with image: "${imageCaption}"`);
              }
            }
          }

          const imageRow: PageContentRow = {
            type: imageRowTemplate.type,
            maxColumns: imageRowTemplate.maxColumns,
            showSwiper: imageRowTemplate.showSwiper,
            columns: [{
              columns: 12,
              imageSource,
              alt: segment.image.alt || segment.text || "Image",
              imageBorderRadius: 6,
              contentText: imageCaption || undefined,
              showTextAfterImage: imageCaption ? true : undefined,
              accessLevel: AccessLevel.public
            }]
          };
          rows.push(imageRow);
          rowCount++;
          ctx.usedImageIndices.add(i);
          addedImageCount++;
          if (matcher.imagePattern === ImageMatchPattern.FIRST_IMAGE) {
            // Only include the first image when requested
            // Do not collect further images in this matcher scope
          }
        }
      }
    }

    if (currentTextBuffer.length > 0) {
      const textRow: PageContentRow = {
        type: textRowTemplate.type,
        maxColumns: textRowTemplate.maxColumns,
        showSwiper: textRowTemplate.showSwiper,
        columns: [{
          columns: 12,
          contentText: currentTextBuffer.join("\n\n"),
          accessLevel: AccessLevel.public
        }]
      };
      rows.push(textRow);
      rowCount++;
    }

    debugLog(`   Created ${rowCount} nested rows with collection breaks`);
    return rows;
  }

  private async findAndAddText(step: TransformationAction, ctx: TransformationContext): Promise<void> {
    debugLog("Finding and adding text (placeholder)");
  }

  private async findAndAddImage(step: TransformationAction, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<void> {
    debugLog("Finding and adding image (placeholder)");
  }

  private async splitTextByImages(step: TransformationAction, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<void> {
    debugLog("Splitting text by images (placeholder)");
  }
}
