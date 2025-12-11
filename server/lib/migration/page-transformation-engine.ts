import debug from "debug";
import { envConfig } from "../env-config/env-config";
import {
  ContentMatcher,
  ContentMatchType,
  ImageMatchPattern,
  LocationRowConfig,
  NestedRowsConfig,
  PageTransformationConfig,
  SegmentType,
  TextMatchPattern,
  TransformationAction,
  TransformationActionType,
  TransformationContext
} from "../../../projects/ngx-ramblers/src/app/models/page-transformation.model";
import {
  ColumnContentType,
  ColumnMappingConfig,
  ImagePattern,
  IndexContentType,
  IndexRenderMode,
  LocationRenderingMode,
  LocationRowData,
  MapData,
  MigrationTemplateMapping,
  NestedRowContentSource,
  NestedRowMappingConfig,
  NestedRowPackingBehavior,
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentType,
  StringMatch,
  Transformation
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { UIDateFormat } from "../../../projects/ngx-ramblers/src/app/models/date-format.model";
import {
  ScrapedImage,
  ScrapedPage,
  ScrapedSegment
} from "../../../projects/ngx-ramblers/src/app/models/migration-scraping.model";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";
import { LocationDetails } from "../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import * as exclusions from "./text-exclusions";
import { humaniseFileStemFromUrl } from "../shared/string-utils";
import { DateTime } from "luxon";
import { bestLocation, extractLocations } from "../shared/location-extractor";
import { ExtractedLocation } from "../../../projects/ngx-ramblers/src/app/models/map.model";
import { isNull, isUndefined } from "es-toolkit/compat";

type TextSegmentInfo = { index: number; cleaned: string; segment: ScrapedSegment; isTextBeforeHeading?: boolean; mergedIndices?: number[] };
type ImageSegmentInfo = { index: number; segment: ScrapedSegment; image: ScrapedImage };
type TextMatcherExecutor = (ctx: TransformationContext, matcher: ContentMatcher) => Partial<PageContentColumn>;
type ImageMatcherExecutor = (ctx: TransformationContext, matcher: ContentMatcher, uploadImageFn: (img: ScrapedImage) => Promise<string>) => Promise<Partial<PageContentColumn>>;
type ExtractedContent = { kind: "text" | "image"; column: Partial<PageContentColumn> };

const debugLog = debug(envConfig.logNamespace("page-transformation-engine"));
debugLog.enabled = true;

export class PageTransformationEngine {
  private debugLogs: string[] = [];
  private readonly supportedTextPatterns = new Set<string>(Object.values(TextMatchPattern));
  private readonly textMatcherHandlers: Record<TextMatchPattern, TextMatcherExecutor> = {
    [TextMatchPattern.STARTS_WITH_HEADING]: (ctx, matcher) => this.extractHeadingStart(ctx),
    [TextMatchPattern.ALL_TEXT_UNTIL_IMAGE]: (ctx, matcher) => this.extractTextBeforeFirstImage(ctx),
    [TextMatchPattern.ALL_TEXT_AFTER_HEADING]: (ctx, matcher) => this.extractTextAfterHeading(ctx),
    [TextMatchPattern.CUSTOM_REGEX]: (ctx, matcher) => this.extractCustomRegex(ctx, matcher),
    [TextMatchPattern.REMAINING_TEXT]: (ctx, matcher) => this.extractRemainingText(ctx),
    [TextMatchPattern.PARAGRAPH]: (ctx, matcher) => this.extractParagraph(ctx),
    [TextMatchPattern.TEXT_BEFORE_HEADING]: (ctx, matcher) => this.extractTextBeforeHeadingMatch(ctx, matcher),
    [TextMatchPattern.TEXT_FROM_HEADING]: (ctx, matcher) => this.extractTextFromHeadingMatch(ctx, matcher),
    [TextMatchPattern.FIRST_HEADING_AND_CONTENT]: (ctx, matcher) => this.extractFirstHeadingAndContent(ctx),
    [TextMatchPattern.HEADING_UNTIL_NEXT_HEADING]: (ctx, matcher) => this.extractHeadingUntilNextHeading(ctx),
    [TextMatchPattern.CONTENT_AFTER_FIRST_HEADING]: (ctx, matcher) => this.extractContentAfterFirstHeading(ctx),
    [TextMatchPattern.LEVEL_1_OR_2_HEADING]: (ctx, matcher) => this.extractLevel1Or2Heading(ctx)
  };

  private readonly imageMatcherHandlers: Record<ImageMatchPattern, ImageMatcherExecutor> = {
    [ImageMatchPattern.FILENAME_PATTERN]: (ctx, matcher, uploadImageFn) => this.matchImageByFilename(ctx, matcher, uploadImageFn),
    [ImageMatchPattern.ALT_TEXT_PATTERN]: (ctx, matcher, uploadImageFn) => this.matchImageByAlt(ctx, matcher, uploadImageFn),
    [ImageMatchPattern.FIRST_IMAGE]: (ctx, matcher, uploadImageFn) => this.matchFirstImage(ctx, matcher, uploadImageFn),
    [ImageMatchPattern.REMAINING_IMAGES]: (ctx, matcher, uploadImageFn) => this.matchRemainingImages(ctx, matcher, uploadImageFn),
    [ImageMatchPattern.ALL_IMAGES]: (ctx, matcher, uploadImageFn) => this.matchAllImages(ctx, uploadImageFn),
    [ImageMatchPattern.PATTERN_MATCH]: (ctx, matcher, uploadImageFn) => this.matchImageByFilename(ctx, matcher, uploadImageFn)
  };

  private log(...args: any[]): void {
    const message = args.map(arg =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(" ");
    this.debugLogs.push(message);
    (debugLog as any)(...args);
  }

  private imageAltFrom(image: ScrapedImage, fallbackText?: string): string {
    const preferred = (image?.alt || "").trim() || (fallbackText || "").trim();
    return preferred || humaniseFileStemFromUrl(image?.src || "");
  }

  private filenameFromUrl(url: string): string {
    try {
      return decodeURIComponent(new URL(url || "").pathname.split("/").pop() || "");
    } catch (e) {
      debugLog(`Failed to parse URL "${url}":`, e instanceof Error ? e.message : String(e));
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
      } catch (e) {
        debugLog(`Failed to create RegExp from pattern "${p}":`, e instanceof Error ? e.message : String(e));
        const pl = p.replace(/\*/g, "").toLowerCase();
        return tl.includes(pl);
      }
    });
  }

  private applyExclusionPatterns(text: string, patterns?: string[] | string): string {
    if (!patterns) return text;
    const patternList = exclusions.coerceList(patterns);
    return patternList.length > 0 ? exclusions.removeTextPatterns(text, patternList) : text;
  }

  private cleanAndExclude(ctx: TransformationContext, text: string): string {
    if (!text) {
      return "";
    }
    let cleaned = exclusions.cleanMarkdown(text);
    cleaned = this.applyExclusionPatterns(cleaned, ctx.excludePatterns);
    cleaned = this.removeEmptyImageLinks(cleaned).trim();
    return cleaned;
  }

  private removeEmptyImageLinks(text: string): string {
    if (!text) {
      return "";
    }
    let result = text.replace(/\[\s*\]\(([^)]+)\)/g, (match, url) => {
      return this.isImageAssetLink(url) ? "" : match;
    });
    result = result.replace(/^\s*\]\(([^)]+)\)\s*/g, (match, url) => {
      return this.isImageAssetLink(url) ? "" : match;
    });
    result = result.replace(/!\[\s*$/g, "");
    result = result.replace(/\[\s*$/g, "");
    return result;
  }

  private isImageAssetLink(url: string): boolean {
    if (!url) {
      return false;
    }
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url.toLowerCase());
  }

  private createTransformationContext(scrapedPage: ScrapedPage): TransformationContext {
    return {
      originalHtml: "",
      markdown: "",
      originalUrl: scrapedPage.path,
      consumedCaptions: new Set<string>(),
      segments: scrapedPage.segments || [],
      rows: [],
      remainingText: [],
      remainingImages: [],
      usedTextIndices: new Set(),
      usedImageIndices: new Set(),
      mergedTextIndices: new Map()
    };
  }

  async transform(scrapedPage: ScrapedPage, config: PageTransformationConfig, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<PageContent> {
    this.debugLogs = [];
    const ctx = this.createTransformationContext(scrapedPage);
    ctx.excludePatterns = config.excludePatterns;

    this.log(`✅ Starting transformation: ${config.name} for page: ${scrapedPage.path}`);
    this.log(`   Segments: ${ctx.segments.length}`);
    this.log(`   First 3 segments:`, ctx.segments.slice(0, 3).map((s, i) => ({
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
      rows: ctx.rows,
      debugLogs: this.debugLogs
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
        const fmt = step.dateFormat || UIDateFormat.YEAR_MONTH_DAY_TIME_WITH_MINUTES;
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

      case TransformationActionType.ADD_LOCATION_ROW:
        await this.addLocationRow(step, ctx);
        break;

      case TransformationActionType.ADD_INDEX_ROW:
        await this.addIndexRow(step, ctx);
        break;

      case TransformationActionType.ADD_MAP_ROW:
        await this.addMapRow(step, ctx);
        break;

      case TransformationActionType.CREATE_INDEX_PAGE:
        debugLog(`⚠️ CREATE_INDEX_PAGE should be handled at migration level, not transformation level`);
        break;

      default:
        debugLog(`⚠️ Unknown step type: ${step.type}`);
    }
  }

  private convertToMarkdown(ctx: TransformationContext): void {
    this.log("Converting to markdown");
    const textSegments = ctx.segments.filter(s => s.text && !s.image);
    ctx.markdown = textSegments.map(s => this.cleanAndExclude(ctx, s.text)).join("\n\n");
    ctx.remainingText = textSegments.map(s => this.cleanAndExclude(ctx, s.text));
    ctx.remainingImages = ctx.segments.filter(s => s.image).map(s => s.image);
    this.log(`   Text segments: ${ctx.remainingText.length}, Images: ${ctx.remainingImages.length}`);
    if (ctx.remainingText.length > 0) {
      this.log(`   First text segment preview: ${ctx.remainingText[0].substring(0, 100)}...`);
    }
    this.log(`   Raw markdown (full):\n${ctx.markdown}`);
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

  private async buildColumn(
    colConfig: any, ctx: TransformationContext,
    uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<PageContentColumn> {
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

  private async matchContent(matcher: ContentMatcher, ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<Partial<PageContentColumn>> {
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

  private matchText(matcher: ContentMatcher, ctx: TransformationContext): Partial<PageContentColumn> {
    debugLog(`Matching text with pattern: ${matcher.textPattern}`);

    const pattern = matcher.textPattern || TextMatchPattern.REMAINING_TEXT;
    const handler = this.textMatcherHandlers[pattern];
    if (!handler) {
      debugLog(`⚠️ Unknown text pattern: ${matcher.textPattern}`);
      return null;
    }
    return handler(ctx, matcher);
  }

  private async matchImage(matcher: ContentMatcher,
                           ctx: TransformationContext,
                           uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<Partial<PageContentColumn>> {
    debugLog(`Matching image with pattern: ${matcher.imagePattern}, filenamePattern: ${matcher.filenamePattern}`);
    const pattern = matcher.imagePattern || ImageMatchPattern.FIRST_IMAGE;
    const handler = this.imageMatcherHandlers[pattern];
    if (!handler) {
      debugLog(`⚠️ Unknown image pattern: ${matcher.imagePattern}`);
      return null;
    }
    return handler(ctx, matcher, uploadImageFn);
  }

  private isTextOnlySegment(seg: ScrapedSegment): boolean {
    return seg.text && !seg.image;
  }

  private textSegments(ctx: TransformationContext): TextSegmentInfo[] {
    const infos: TextSegmentInfo[] = [];
    const skip = new Set<number>();
    for (let index = 0; index < ctx.segments.length; index++) {
      if (skip.has(index)) {
        continue;
      }
      const segment = ctx.segments[index];
      if (!segment.text || segment.image) {
        continue;
      }
      let cleaned = this.cleanAndExclude(ctx, segment.text);
      if (!cleaned) {
        continue;
      }
      let mergedIndices: number[] | undefined;
      if (this.shouldMergeFragment(cleaned)) {
        const merged = this.mergeFollowingFragments(ctx, index, cleaned);
        cleaned = merged.text;
        if (merged.indices.length > 0) {
          mergedIndices = merged.indices;
          merged.indices.forEach(i => skip.add(i));
          this.storeMergedTextIndices(ctx, index, merged.indices);
        }
      }
      infos.push({segment, index, cleaned, mergedIndices});
    }
    return infos;
  }

  private unusedTextSegments(ctx: TransformationContext): TextSegmentInfo[] {
    const segments = this.textSegments(ctx).filter(info => !ctx.usedTextIndices.has(info.index));
    debugLog(`   Unused text segments after merging: ${segments.length}`);
    return segments;
  }

  private shouldMergeFragment(text: string): boolean {
    if (!text) {
      return false;
    }
    if (text.length >= 80) {
      return false;
    }
    if (this.isHeadingText(text)) {
      return false;
    }
    return /[\[\]\(\)]/.test(text);
  }

  private mergeFollowingFragments(ctx: TransformationContext, startIndex: number, initialText: string): {text: string; indices: number[]} {
    let text = initialText;
    const indices: number[] = [];
    for (let i = startIndex + 1; i < ctx.segments.length; i++) {
      if (ctx.usedTextIndices.has(i)) {
        break;
      }
      const segment = ctx.segments[i];
      if (!segment.text || segment.image) {
        break;
      }
      const cleaned = this.cleanAndExclude(ctx, segment.text);
      indices.push(i);
      if (!cleaned) {
        continue;
      }
      const joiner = text.length === 0 || text.endsWith("\n") ? "" : "\n";
      text = `${text}${joiner}${cleaned}`.trim();
      debugLog(`   Merged short text fragment ${startIndex} with ${i}`);
      if (!this.shouldMergeFragment(cleaned)) {
        break;
      }
    }
    return {text, indices};
  }

  private storeMergedTextIndices(ctx: TransformationContext, index: number, mergedIndices: number[]): void {
    if (mergedIndices.length === 0) {
      return;
    }
    if (!ctx.mergedTextIndices) {
      ctx.mergedTextIndices = new Map();
    }
    ctx.mergedTextIndices.set(index, mergedIndices);
  }

  private unusedImageSegments(ctx: TransformationContext): ImageSegmentInfo[] {
    return ctx.segments
      .map((segment, index) => ({segment, index}))
      .filter(({segment, index}) => Boolean(segment.image) && !ctx.usedImageIndices.has(index))
      .map(({segment, index}) => ({
        segment,
        index,
        image: segment.image!
      }));
  }

  private markTextIndices(ctx: TransformationContext, indices: number[]): void {
    indices.forEach(index => {
      ctx.usedTextIndices.add(index);
      const merged = ctx.mergedTextIndices?.get(index);
      merged?.forEach(i => ctx.usedTextIndices.add(i));
    });
  }

  private markImageIndices(ctx: TransformationContext, indices: number[]): void {
    indices.forEach(index => ctx.usedImageIndices.add(index));
  }

  private firstHeadingSegment(ctx: TransformationContext): TextSegmentInfo {
    return this.unusedTextSegments(ctx).find(info => this.isHeadingText(info.cleaned));
  }

  private extractHeadingStart(ctx: TransformationContext): Partial<PageContentColumn> {
    const heading = this.firstHeadingSegment(ctx);
    if (!heading) {
      return null;
    }
    this.markTextIndices(ctx, [heading.index]);
    debugLog(`   Found heading start at index ${heading.index}`);
    return {contentText: heading.cleaned};
  }

  private extractTextBeforeFirstImage(ctx: TransformationContext): Partial<PageContentColumn> {
    const firstImageIndex = ctx.segments.findIndex(segment => Boolean(segment.image));
    const limit = firstImageIndex === -1 ? ctx.segments.length : firstImageIndex;
    const segments = this.unusedTextSegments(ctx).filter(info => info.index < limit);
    if (segments.length === 0) {
      return null;
    }
    this.markTextIndices(ctx, segments.map(info => info.index));
    debugLog(`   Found ${segments.length} text segments before first image`);
    return {contentText: segments.map(info => info.cleaned).join("\n\n")};
  }

  private extractTextAfterHeading(ctx: TransformationContext): Partial<PageContentColumn> {
    const heading = this.firstHeadingSegment(ctx);
    if (!heading) {
      return null;
    }
    const nextImageIndex = ctx.segments.findIndex((segment, index) => index > heading.index && Boolean(segment.image));
    const limit = nextImageIndex === -1 ? ctx.segments.length : nextImageIndex;
    const trailingSegments = this.unusedTextSegments(ctx).filter(info => info.index > heading.index && info.index < limit);
    const combined = [heading, ...trailingSegments];
    this.markTextIndices(ctx, combined.map(info => info.index));
    debugLog(`   Found ${combined.length} text segments after heading`);
    return {contentText: combined.map(info => info.cleaned).join("\n\n")};
  }

  private extractCustomRegex(ctx: TransformationContext, matcher: ContentMatcher): Partial<PageContentColumn> {
    if (!matcher.customRegex) {
      debugLog("⚠️ No customRegex provided");
      return null;
    }
    const unused = this.unusedTextSegments(ctx);
    const joined = unused.map(info => info.cleaned).join("\n\n");
    const regex = new RegExp(matcher.customRegex, "ms");
    const matched = joined.match(regex)?.[0];
    if (!matched) {
      debugLog("   ⚠️ customRegex did not match any text");
      return null;
    }
    const indicesToMark = unused.reduce(
      (state, info) => {
        if (state.remaining <= 0) {
          return state;
        }
        const lengthWithSpacing = info.cleaned.length + 2;
        return {
          remaining: state.remaining - lengthWithSpacing,
          indices: [...state.indices, info.index]
        };
      },
      {remaining: matched.length, indices: [] as number[]}
    ).indices;
    this.markTextIndices(ctx, indicesToMark);
    debugLog(`   Matched customRegex length ${matched.length}`);
    return {contentText: matched};
  }

  private extractRemainingText(ctx: TransformationContext): Partial<PageContentColumn> {
    const segments = this.unusedTextSegments(ctx);
    if (segments.length === 0) {
      return null;
    }
    this.markTextIndices(ctx, segments.map(info => info.index));
    const textSegments = segments.map(info => {
      let text = info.cleaned;

      if (ctx.extractedHeading) {
        if (text.trim() === ctx.extractedHeading) {
          debugLog(`   Skipping segment matching extracted heading: "${text.substring(0, 50)}..."`);
          return "";
        }
        const headingWithHash = `## ${ctx.extractedHeading}`;
        const lines = text.split("\n").filter(line => {
          const trimmed = line.trim();
          return trimmed !== ctx.extractedHeading && trimmed !== headingWithHash;
        });
        if (lines.length !== text.split("\n").length) {
          text = lines.join("\n").trim();
          debugLog(`   Removed heading line(s) from multi-line segment: "${ctx.extractedHeading}"`);
        }
      }

      if (ctx.consumedCaptions && ctx.consumedCaptions.size > 0) {
        for (const caption of ctx.consumedCaptions) {
          if (text.startsWith(caption)) {
            text = text.substring(caption.length).trim();
            debugLog(`   Removed consumed caption from segment: "${caption.substring(0, 50)}..."`);
            break;
          }
        }
      }
      return text;
    }).filter(text => text.length > 0);
    debugLog(`   Found ${segments.length} remaining text segments (${textSegments.length} after removing consumed captions and heading duplicates)`);
    return {contentText: textSegments.join("\n\n")};
  }

  private extractParagraph(ctx: TransformationContext): Partial<PageContentColumn> {
    const paragraph = this.unusedTextSegments(ctx)[0];
    if (!paragraph) {
      return null;
    }
    this.markTextIndices(ctx, [paragraph.index]);
    debugLog(`   Found paragraph at index ${paragraph.index}`);
    return {contentText: paragraph.cleaned};
  }

  private findHeadingSegmentIndex(ctx: TransformationContext, matcher: ContentMatcher): number {
    if (!matcher.headingPattern) {
      debugLog("⚠️ No headingPattern provided for match");
      return -1;
    }
    const regex = new RegExp(matcher.headingPattern, "i");
    const headingSegment = this.unusedTextSegments(ctx)
      .find(info => this.isHeadingText(info.cleaned) && regex.test(info.cleaned));

    if (headingSegment) {
      debugLog(`   Found heading segment at index ${headingSegment.index} matching ${matcher.headingPattern}`);
      return headingSegment.index;
    } else {
      debugLog(`   ⚠️ No heading segment found matching ${matcher.headingPattern}`);
      return -1;
    }
  }

  private extractTextBeforeHeadingMatch(ctx: TransformationContext, matcher: ContentMatcher): Partial<PageContentColumn> {
    const headingIndex = this.findHeadingSegmentIndex(ctx, matcher);
    if (headingIndex === -1) {
      debugLog(`   Heading pattern "${matcher.headingPattern}" not found, falling back to remaining text`);
      return this.extractRemainingText(ctx);
    }
    const segments = this.unusedTextSegments(ctx).filter(info => info.index < headingIndex);
    const headingSegment = this.unusedTextSegments(ctx).find(info => info.index === headingIndex);

    debugLog(`   Text-before-heading: heading index ${headingIndex}, segments before: ${segments.length}`);
    segments.forEach(info => debugLog(`     Segment ${info.index}: "${info.cleaned.substring(0, 50)}..."`));

    const contentParts: string[] = segments.map(info => {
      let text = info.cleaned;
      const lines = text.split("\n").filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return true;
        if (this.isHeadingText(trimmed)) {
          debugLog(`   Filtering out heading line from segment ${info.index}: "${trimmed}"`);
          return false;
        }
        if (ctx.extractedHeading && (trimmed === ctx.extractedHeading || trimmed === `## ${ctx.extractedHeading}` || trimmed === `# ${ctx.extractedHeading}`)) {
          debugLog(`   Filtering out extracted heading from segment ${info.index}: "${trimmed}"`);
          return false;
        }
        return true;
      });
      if (lines.length !== text.split("\n").length) {
        text = lines.join("\n").trim();
      }
      return text;
    }).filter(text => text.length > 0);
    const indicesToMark: number[] = segments.map(info => info.index);

    if (headingSegment) {
      const headingBoundary = this.headingBoundaryIndex(headingSegment.cleaned);
      if (!isNull(headingBoundary) && headingBoundary > 0) {
        const textBeforeHeading = headingSegment.cleaned.substring(0, headingBoundary).trim();
        if (textBeforeHeading) {
          contentParts.push(textBeforeHeading);
          debugLog(`   Found text before heading in heading segment ${headingSegment.index}: "${textBeforeHeading.substring(0, 50)}..."`);
          debugLog(`   Not marking segment ${headingSegment.index} as used to allow TEXT_FROM_HEADING extraction`);
          ctx.consumedCaptions?.add(textBeforeHeading);
        }
      }
    }

    const content = contentParts.join("\n\n").trim();
    const shouldAppendPostHeading = content.length === 0;
    if (shouldAppendPostHeading) {
      const postSegments = this.unusedTextSegments(ctx).filter(info => info.index > headingIndex);
      if (postSegments.length === 0) {
        return segments.length > 0 ? {contentText: content} : null;
      }
      const combinedIndices = [...indicesToMark, ...postSegments.map(info => info.index)];
      const combinedText = [content, postSegments.map(info => info.cleaned).join("\n\n")].filter(Boolean).join("\n\n");
      this.markTextIndices(ctx, combinedIndices);
      debugLog(`   Narrative before heading empty, appended ${postSegments.length} post-heading segments`);
      return {contentText: combinedText};
    }
    if (indicesToMark.length === 0) {
      return null;
    }
    this.markTextIndices(ctx, indicesToMark);
    debugLog(`   Found ${indicesToMark.length} text segments (including text before heading in heading segment)`);
    return {contentText: content};
  }

  private extractTextFromHeadingMatch(ctx: TransformationContext, matcher: ContentMatcher): Partial<PageContentColumn> {
    const headingIndex = this.findHeadingSegmentIndex(ctx, matcher);
    if (headingIndex === -1) {
      return this.extractRemainingText(ctx);
    }
    const allSegments = this.unusedTextSegments(ctx).filter(info => info.index >= headingIndex);
    if (allSegments.length === 0) {
      return null;
    }

    const contentParts: string[] = [];
    const indicesToMark: number[] = [];

    for (const info of allSegments) {
      if (info.index === headingIndex) {
        const headingBoundary = this.headingBoundaryIndex(info.cleaned);
        if (!isNull(headingBoundary)) {
          const textAfterHeading = info.cleaned.substring(headingBoundary).trim();
          const headingMatch = textAfterHeading.match(/^#+\s+[^\n]+\n*/);
          const textAfterHeadingLine = headingMatch ? textAfterHeading.substring(headingMatch[0].length).trim() : textAfterHeading;
          if (textAfterHeadingLine) {
            contentParts.push(textAfterHeadingLine);
            debugLog(`   Found text after heading in heading segment ${info.index}: "${textAfterHeadingLine.substring(0, 50)}..."`);
            debugLog(`   Not marking heading segment ${info.index} as used to allow TEXT_BEFORE_HEADING extraction`);
            ctx.consumedCaptions?.add(textAfterHeadingLine);
          }
        } else {
          contentParts.push(info.cleaned);
          indicesToMark.push(info.index);
        }
      } else {
        contentParts.push(info.cleaned);
        indicesToMark.push(info.index);
      }
    }

    this.markTextIndices(ctx, indicesToMark);
    debugLog(`   Found ${allSegments.length} text segments from heading index ${headingIndex} (${indicesToMark.length} marked as used)`);
    return {contentText: contentParts.join("\n\n")};
  }

  private extractFirstHeadingAndContent(ctx: TransformationContext): Partial<PageContentColumn> {
    const heading = this.firstHeadingSegment(ctx);
    if (!heading) {
      return null;
    }

    const segments = this.unusedTextSegments(ctx);
    const headingIndex = segments.findIndex(info => info.index === heading.index);
    if (headingIndex === -1) {
      return null;
    }

    const contentSegments = segments.slice(headingIndex + 1);
    const firstNonHeadingIndex = contentSegments.findIndex(info => !this.isHeadingText(info.cleaned));

    const segmentsToInclude = firstNonHeadingIndex === -1 ? contentSegments : contentSegments.slice(0, firstNonHeadingIndex + 1);

    this.markTextIndices(ctx, [heading.index, ...segmentsToInclude.map(info => info.index)]);
    const content = [heading.cleaned, ...segmentsToInclude.map(info => info.cleaned)].join("\n\n");
    debugLog(`   Found first heading and content: ${content.length} chars`);
    return {contentText: content};
  }

  private extractHeadingUntilNextHeading(ctx: TransformationContext): Partial<PageContentColumn> {
    const heading = this.firstHeadingSegment(ctx);
    if (!heading) {
      return null;
    }

    const segments = this.unusedTextSegments(ctx);
    const headingIndex = segments.findIndex(info => info.index === heading.index);
    if (headingIndex === -1) {
      return null;
    }

    const contentSegments = segments.slice(headingIndex + 1);
    const nextHeadingIndex = contentSegments.findIndex(info => this.isHeadingText(info.cleaned));

    const segmentsToInclude = nextHeadingIndex === -1 ? contentSegments : contentSegments.slice(0, nextHeadingIndex);

    this.markTextIndices(ctx, [heading.index, ...segmentsToInclude.map(info => info.index)]);
    const content = [heading.cleaned, ...segmentsToInclude.map(info => info.cleaned)].join("\n\n");
    debugLog(`   Found heading until next heading: ${content.length} chars`);
    return {contentText: content};
  }

  private extractContentAfterFirstHeading(ctx: TransformationContext): Partial<PageContentColumn> {
    const heading = this.firstHeadingSegment(ctx);
    if (!heading) {
      return null;
    }

    const segments = this.unusedTextSegments(ctx);
    const headingIndex = segments.findIndex(info => info.index === heading.index);
    if (headingIndex === -1) {
      return null;
    }

    const contentSegments = segments.slice(headingIndex + 1);
    if (contentSegments.length === 0) {
      return null;
    }

    this.markTextIndices(ctx, contentSegments.map(info => info.index));
    const content = contentSegments.map(info => info.cleaned).join("\n\n");
    debugLog(`   Found content after first heading: ${content.length} chars`);
    return {contentText: content};
  }

  private extractLevel1Or2Heading(ctx: TransformationContext): Partial<PageContentColumn> {
    const segments = this.unusedTextSegments(ctx);
    this.log(`   Searching for level 1 or 2 heading in ${segments.length} unused text segments`);
    if (segments.length > 0) {
      this.log(`   All segments:`);
      segments.forEach((s, i) => {
        this.log(`     [${i}] ${s.cleaned.substring(0, 80)}`);
      });
    }

    let foundHeading: string | null = null;
    let foundSegmentIndex: number = -1;

    for (const info of segments) {
      const lines = info.cleaned.split("\n");
      for (const line of lines) {
        if (/^#{1,2}\s+.+/.test(line.trim())) {
          foundHeading = line.trim();
          foundSegmentIndex = info.index;
          break;
        }
      }
      if (foundHeading) break;
    }

    if (!foundHeading) {
      this.log(`   ⚠️ No level 1 or 2 heading found in ${segments.length} segments`);
      return null;
    }

    const headingText = foundHeading.replace(/^#+\s*/, "").trim();
    ctx.extractedHeading = headingText;
    this.log(`   Found level 1 or 2 heading: ${foundHeading}`);
    this.log(`   Note: Not marking segment ${foundSegmentIndex} as used to allow caption/narrative extraction from same segment`);
    this.log(`   Stored heading text for deduplication: "${headingText}"`);
    return {contentText: foundHeading};
  }

  private nextUnusedTextSegment(ctx: TransformationContext, index: number): TextSegmentInfo {
    const segment = ctx.segments[index];
    if (!segment || segment.image || !segment.text || ctx.usedTextIndices.has(index)) {
      return undefined;
    }
    return {
      segment,
      index,
      cleaned: this.cleanAndExclude(ctx, segment.text)
    };
  }

  private captionFromNextText(ctx: TransformationContext, index: number, allowLongCaptions = false): TextSegmentInfo {
    const candidate = this.nextUnusedTextSegment(ctx, index);
    if (!candidate) {
      return undefined;
    }
    if (this.isHeadingText(candidate.cleaned)) {
      const headingIndex = this.headingBoundaryIndex(candidate.cleaned);
      if (!isNull(headingIndex) && headingIndex > 0) {
        const textBeforeHeading = candidate.cleaned.substring(0, headingIndex).trim();
        if (textBeforeHeading && (allowLongCaptions || textBeforeHeading.length <= 100)) {
          return {
            index: candidate.index,
            cleaned: textBeforeHeading,
            segment: candidate.segment,
            isTextBeforeHeading: true
          };
        }
      }
      return undefined;
    }
    if (!allowLongCaptions && candidate.cleaned.length > 100) {
      return undefined;
    }
    return candidate;
  }

  private captionFromPreviousText(ctx: TransformationContext, index: number): TextSegmentInfo {
    for (let i = index - 1; i >= 0; i--) {
      const seg = ctx.segments[i];
      if (!ctx.usedTextIndices.has(i) && seg.text && !seg.image) {
        const cleaned = this.cleanAndExclude(ctx, seg.text);
        if (this.isHeadingText(cleaned)) {
          const headingIndex = this.headingBoundaryIndex(cleaned);
          if (!isNull(headingIndex) && headingIndex > 0) {
            const textBeforeHeading = cleaned.substring(0, headingIndex).trim();
            if (textBeforeHeading && textBeforeHeading.length <= 100) {
              return {index: i, cleaned: textBeforeHeading, segment: seg, isTextBeforeHeading: true};
            }
          }
          return undefined;
        }
        if (cleaned.length > 100) {
          return undefined;
        }
        return {index: i, cleaned, segment: seg};
      }
    }
    return undefined;
  }

  private getCaptionForImage(
    ctx: TransformationContext, imageIndex: number,
    matcher: {
      groupTextWithImage?: boolean;
      captionBeforeImage?: boolean;
      allowLongCaptions?: boolean
    }): TextSegmentInfo {
    if (!matcher?.groupTextWithImage) {
      return undefined;
    }
    if (matcher.captionBeforeImage) {
      return this.captionFromPreviousText(ctx, imageIndex);
    }
    return this.captionFromNextText(ctx, imageIndex + 1, matcher.allowLongCaptions);
  }

  private captionForImage(ctx: TransformationContext, imageIndex: number, matcher: ContentMatcher, filename: string): TextSegmentInfo | undefined {
    if (this.shouldSkipCaptionGrouping(filename, matcher)) {
      debugLog(`   Skipping caption grouping for image ${filename || imageIndex}`);
      return undefined;
    }
    return this.getCaptionForImage(ctx, imageIndex, matcher);
  }

  private shouldSkipCaptionGrouping(filename: string, matcher: ContentMatcher): boolean {
    if (!matcher?.groupTextWithImage || !filename) {
      return false;
    }
    const lower = filename.toLowerCase();
    const looksLikeMap = lower.includes("map_") || lower.includes("route-") || lower.includes("route_map");
    if (!looksLikeMap) {
      return false;
    }
    return matcher.imagePattern === ImageMatchPattern.PATTERN_MATCH;
  }

  private consumeCaptionInfo(ctx: TransformationContext, captionInfo: TextSegmentInfo | undefined, imageIndex: number): string {
    if (!captionInfo) {
      return undefined;
    }
    if (captionInfo.isTextBeforeHeading) {
      if (!ctx.consumedCaptions) {
        ctx.consumedCaptions = new Set();
      }
      ctx.consumedCaptions.add(captionInfo.cleaned);
      debugLog(`   Image ${imageIndex} caption uses segment ${captionInfo.index} (text-before-heading)`);
    } else {
      this.markTextIndices(ctx, [captionInfo.index]);
      debugLog(`   Image ${imageIndex} caption uses segment ${captionInfo.index}`);
    }
    return captionInfo.cleaned;
  }

  private remainingTextSegmentCount(ctx: TransformationContext): number {
    let count = 0;
    ctx.segments.forEach((segment, index) => {
      if (segment.text && !segment.image && !ctx.usedTextIndices.has(index)) {
        count += 1;
      }
    });
    return count;
  }

  private buildTextRow(transformation: Transformation): PageContentRow {
    return {
      type: transformation.template.type,
      maxColumns: transformation.template.maxColumns,
      showSwiper: transformation.template.showSwiper,
      columns: [{
        columns: 12,
        contentText: transformation.contentText,
        accessLevel: AccessLevel.public
      }]
    };
  }

  private buildImageRow(
    template: { type: PageContentType; maxColumns: number; showSwiper: boolean },
    imageSource: string,
    alt: string,
    caption?: string
  ): PageContentRow {
    return {
      type: template.type,
      maxColumns: template.maxColumns,
      showSwiper: template.showSwiper,
      columns: [{
        columns: 12,
        imageSource,
        alt,
        imageBorderRadius: 6,
        contentText: caption,
        showTextAfterImage: caption ? true : undefined,
        accessLevel: AccessLevel.public
      }]
    };
  }

  private shouldIncludeImage(segment: ScrapedSegment, matcher: ContentMatcher, addedImageCount: number): boolean {
    if (!segment.image) {
      return false;
    }
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
  }

  private headingBoundaryIndex(cleaned: string): number {
    const atx = cleaned.match(/(^|\n)\s*#+\s+/);
    if (atx) {
      return atx.index! + (atx[1] === "\n" ? 1 : 0);
    }
    const setext = cleaned.match(/(^|\n)[^\n]+\n[=\-]{3,}\s*$/m);
    if (setext) {
      return setext.index! + (setext[1] === "\n" ? 1 : 0);
    }
    return null;
  }

  private async resolveLocationValue(config: LocationRowConfig, ctx: TransformationContext): Promise<string> {
    if (!config.extractFromContent || !ctx.markdown) {
      return config.defaultLocation as string;
    }

    const allExtractedLocations: ExtractedLocation[] = extractLocations(ctx.markdown);
    debugLog("extractLocations: Input text:", ctx.markdown);
    const chosenLocation: ExtractedLocation | null = bestLocation(allExtractedLocations);
    const endLocation = this.richestLocationForContext(allExtractedLocations, "end location");
    const hasValidGridReference = allExtractedLocations.some(location => location.type === "gridReference");

    if (chosenLocation) {
      debugLog(`  Found best location: ${chosenLocation.value} (Type: ${chosenLocation.type}, Context: ${chosenLocation.context})`);

      if (this.containsGridReference(chosenLocation.value) && !hasValidGridReference) {
        debugLog(`  ⚠️ Ignoring invalid grid reference candidate: ${chosenLocation.value}`);
        return undefined;
      }

      if (!this.isStrongLocationCandidate(chosenLocation)) {
        debugLog(`  ⚠️ Candidate location "${chosenLocation.value}" failed validation, skipping`);
        return undefined;
      }

      const startDetails = await this.lookupLocationDetails(chosenLocation.value);
      const endDetails = endLocation ? await this.lookupLocationDetails(endLocation.value) : null;

      if (startDetails) {
        ctx.extractedLocation = {
          start: startDetails,
          end: endDetails || undefined,
          renderingMode: config.hidden ? LocationRenderingMode.HIDDEN : LocationRenderingMode.VISIBLE
        };
        debugLog(`  Set extracted location: ${JSON.stringify(ctx.extractedLocation)}`);
        return chosenLocation.value as string;
      }

      debugLog(`  ⚠️ Unable to resolve coordinates for ${chosenLocation.value}`);
      ctx.extractedLocation = this.fallbackLocationFromValue(chosenLocation.value as string, config.hidden);
      return chosenLocation.value as string;
    }

    debugLog("  No location found from markdown");
    return config.defaultLocation;
  }

  private async segmentToMarkdown(ctx: TransformationContext, seg: ScrapedSegment, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<string> {
    if (this.isTextOnlySegment(seg)) {
      return this.cleanAndExclude(ctx, seg.text);
    }
    if (seg.image) {
      const imageSource = await uploadImageFn(seg.image);
      const alt = this.imageAltFrom(seg.image, seg.text);
      return `![${alt}](${imageSource})`;
    }
    return "";
  }

  private async matchAll(ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<Partial<PageContentColumn>> {
    const markdown = await Promise.all(ctx.segments.map(seg => this.segmentToMarkdown(ctx, seg, uploadImageFn)));
    const filtered = markdown.filter(Boolean);
    const contentText = filtered.join("\n\n");
    debugLog(`   Matched all content: ${filtered.length} segments (including images)`);
    return contentText ? {contentText} : null;
  }

  private async lookupLocationDetails(searchValue: string): Promise<LocationDetails | null> {
    if (!searchValue) {
      return null;
    }

    const baseValue = this.normaliseLocationCandidate(searchValue);
    const searchVariations = this.generateSearchVariations(baseValue, searchValue);
    debugLog(`  Trying ${searchVariations.length} search variation(s) for: ${searchValue}`);

    for (const query of searchVariations) {
      try {
        const placeNameApiUrl = `http://localhost:4200/api/addresses/place-names?query=${encodeURIComponent(query)}`;
        const response = await fetch(placeNameApiUrl);
        if (!response.ok) {
          debugLog(`  ⚠️ Location lookup failed for "${query}": status ${response.status}`);
          continue;
        }
        const apiResponse = await response.json() as any;
        const location = this.extractLocationFromResponse(apiResponse);
        if (!location) {
          debugLog(`  ⚠️ No locations in API response for "${query}"`);
          continue;
        }
        const coords = this.normalisedCoordinates(location);
        if (!coords) {
          debugLog(`  ⚠️ Invalid coordinates returned for "${query}"`);
          continue;
        }
        debugLog(`  ✅ Successfully geocoded using "${query}"`);
        return {
          latitude: coords.lat,
          longitude: coords.lon,
          grid_reference_6: location.gridReference6 || location.grid_reference_6 || (/^[A-Z]{2}\s?\d{6}$/.test(searchValue) ? searchValue : ""),
          grid_reference_8: location.gridReference8 || location.grid_reference_8 || (/^[A-Z]{2}\s?\d{8}$/.test(searchValue) ? searchValue : ""),
          grid_reference_10: location.gridReference10 || location.grid_reference_10 || (/^[A-Z]{2}\s?\d{10}$/.test(searchValue) ? searchValue : ""),
          postcode: location.postcode || "",
          description: baseValue,
          w3w: ""
        };
      } catch (error) {
        debugLog(`  Failed to lookup location "${query}":`, error);
      }
    }

    debugLog(`  ⚠️ All ${searchVariations.length} search variations failed for: ${searchValue}`);
    return null;
  }

  private generateSearchVariations(searchValue: string, originalValue?: string): string[] {
    const variations: string[] = [];
    const add = (value?: string) => {
      const trimmed = (value || "").trim();
      if (trimmed && !variations.includes(trimmed)) {
        variations.push(trimmed);
      }
    };

    add(searchValue);

    if (/^[A-Z]{2}\s?\d{3,5}\s?\d{3,5}$/.test(searchValue)) {
      return variations;
    }

    const directionalMatch = searchValue.match(/(?:just\s+)?(?:north|south|east|west)\s+of\s+(.+)$/i);
    if (directionalMatch) {
      add(directionalMatch[1]);
    }

    const nearMatch = searchValue.match(/near\s+(.+)$/i);
    if (nearMatch) {
      add(nearMatch[1]);
    }

    const riverBankMatch = searchValue.match(/(?:river|bank of (?:the )?)?(.+?)(?:\s+just\s+|\s+near\s+|\s+close\s+to\s+)/i);
    if (riverBankMatch) {
      add(riverBankMatch[1]);
    }

    const capitalizedWords = searchValue.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*/g);
    if (capitalizedWords && capitalizedWords.length > 0) {
      capitalizedWords.forEach(word => add(word.length > 3 ? word : null));
    }

    add(originalValue);

    return variations;
  }

  private extractLocationFromResponse(apiResponse: any): any | null {
    if (!apiResponse || !apiResponse.response) {
      return null;
    }
    if (Array.isArray(apiResponse.response)) {
      return apiResponse.response.length > 0 ? apiResponse.response[0] : null;
    }
    if (typeof apiResponse.response === "object") {
      return apiResponse.response;
    }
    return null;
  }

  private normalisedCoordinates(location: any): {lat: number; lon: number} | null {
    const lat = parseFloat(location.lat || location.latitude || (location.latlng && location.latlng.lat));
    const lon = parseFloat(location.lon || location.longitude || (location.latlng && location.latlng.lng));
    if (isNaN(lat) || isNaN(lon)) {
      return null;
    }
    return {lat, lon};
  }

  private richestLocationForContext(locations: ExtractedLocation[], context: string): ExtractedLocation | null {
    const matches = locations.filter(location => location.context === context);
    if (matches.length === 0) {
      return null;
    }
    return matches.reduce((best, current) => this.locationScore(current) > this.locationScore(best) ? current : best, matches[0]);
  }

  private locationScore(location: ExtractedLocation): number {
    let score = location.value.length;
    if (/Station|Railway|Train|Bus|Car Park/i.test(location.value)) {
      score += 50;
    }
    if (/\s+and\s+|\s+or\s+/i.test(location.value)) {
      score += 30;
    }
    const wordCount = location.value.split(/\s+/).length;
    score += wordCount * 5;
    return score;
  }

  private containsGridReference(value: string): boolean {
    return /[A-Z]{2}\s*\d{3,5}\s*\d{3,5}/i.test(value || "");
  }

  private isPostcode(value: string): boolean {
    return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value || "");
  }

  private isStrongLocationCandidate(location: ExtractedLocation): boolean {
    const value = (location?.value || "").trim();
    if (!value) {
      return false;
    }
    if (location.type === "gridReference" || location.type === "postcode") {
      return true;
    }
    if (value.length > 80) {
      return false;
    }
    const wordCount = value.split(/\s+/).length;
    if (wordCount > 8) {
      return false;
    }
    if (/[.;!?]/.test(value)) {
      return false;
    }
    if (/\b(and|but|that|which|towards|because)\b/i.test(value) && wordCount > 4) {
      return false;
    }
    return true;
  }

  private normaliseLocationCandidate(value: string): string {
    if (!value) {
      return "";
    }
    const raw = value.replace(/\s+/g, " ").trim();
    if (/^[A-Z]{2}\s?\d{3,5}\s?\d{3,5}$/i.test(raw)) {
      return raw.toUpperCase().replace(/\s+/g, "");
    }
    if (this.isPostcode(raw)) {
      return this.normalisePostcode(raw);
    }
    let cleaned = raw;
    cleaned = cleaned.replace(/^[^\w(]+/, "");
    cleaned = cleaned.replace(/,\s*[a-z].*$/g, "");
    cleaned = cleaned.replace(/\s*[\u2013\u2014–—-]\s+.*$/g, "");
    cleaned = cleaned.replace(/\s+(?:which|that|who|when|where|including|featuring|offering|offers|passing|covering|describing|detailing|containing)\b.*$/i, "");
    cleaned = cleaned.replace(/\s+(?:towards|via|through|past|around|along|between|beyond|near)\b.*$/i, "");
    cleaned = cleaned.replace(/\s+and\s+(?:would|with|for|to|then|if|when)\b.*$/i, "");
    cleaned = cleaned.replace(/\s+(?:in|on)\s+(?:a|the)\s+(?:series|set|selection|process|guide|draft)\b.*$/i, "");
    cleaned = cleaned.replace(/\s+if\s+you\b.*$/i, "");
    cleaned = cleaned.replace(/\s+please\b.*$/i, "");
    cleaned = cleaned.replace(/\s+we\b.*$/i, "");
    cleaned = cleaned.replace(/\s*this\b.*$/i, "");
    const punctuationSplit = cleaned.split(/[;|·•]/)[0].trim();
    if (punctuationSplit) {
      cleaned = punctuationSplit;
    }
    const parenMatch = cleaned.match(/^([^()]+)\s*\(/);
    if (parenMatch) {
      cleaned = parenMatch[1].trim();
    }
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    const words = cleaned.split(/\s+/);
    if (words.length > 8) {
      cleaned = words.slice(0, 8).join(" ").trim();
    }
    return cleaned || raw;
  }

  private normalisePostcode(value: string): string {
    const cleaned = (value || "").toUpperCase().replace(/\s+/g, "");
    const match = cleaned.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
    return match ? `${match[1]} ${match[2]}` : value;
  }

  private deriveGridReferenceStrings(value: string): {grid6: string; grid8: string; grid10: string} {
    const cleaned = (value || "").replace(/\s+/g, "").toUpperCase();
    const match = cleaned.match(/^([A-Z]{2})(\d{2,10})$/);
    if (!match) {
      return {grid6: value, grid8: "", grid10: ""};
    }
    const letters = match[1];
    const digits = match[2];
    const half = Math.floor(digits.length / 2);
    if (half === 0 || digits.length % 2 !== 0) {
      return {grid6: value, grid8: "", grid10: ""};
    }
    const east = digits.substring(0, half);
    const north = digits.substring(half);
    const grid10 = this.buildGridReferenceFromHalves(letters, east, north, 5);
    const grid8 = this.buildGridReferenceFromHalves(letters, east, north, 4);
    const grid6 = this.buildGridReferenceFromHalves(letters, east, north, 3) || value;
    return {
      grid6: grid6 || value,
      grid8,
      grid10
    };
  }

  private buildGridReferenceFromHalves(letters: string, east: string, north: string, digitsPerAxis: number): string {
    if (east.length < digitsPerAxis || north.length < digitsPerAxis) {
      return "";
    }
    return `${letters}${east.substring(0, digitsPerAxis)}${north.substring(0, digitsPerAxis)}`;
  }

  private fallbackLocationFromValue(value: string, hidden?: boolean): LocationRowData {
    const trimmed = (value || "").trim();
    const normalised = this.normaliseLocationCandidate(trimmed);
    const description = normalised || trimmed || "Unknown location";
    const refs = this.deriveGridReferenceStrings(trimmed);
    const postcode = this.isPostcode(trimmed) ? this.normalisePostcode(trimmed) : "";
    return {
      start: {
        latitude: 0,
        longitude: 0,
        grid_reference_6: refs.grid6 || description,
        grid_reference_8: refs.grid8,
        grid_reference_10: refs.grid10,
        postcode,
        description,
        w3w: ""
      },
      renderingMode: hidden ? LocationRenderingMode.HIDDEN : LocationRenderingMode.VISIBLE
    };
  }

  private async matchImageByFilename(
    ctx: TransformationContext,
    matcher: ContentMatcher, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<Partial<PageContentColumn>> {
    if (!matcher.filenamePattern) {
      debugLog("⚠️ No filename pattern provided");
      return null;
    }
    const match = this.unusedImageSegments(ctx).find(info => {
      const filename = this.filenameFromUrl(info.image.src || "");
      debugLog(`   Checking image: ${filename} against pattern(s): ${matcher.filenamePattern}`);
      return this.matchesGlobList(filename, matcher.filenamePattern);
    });
    if (!match) {
      debugLog(`   ⚠️ No image matched pattern(s): ${matcher.filenamePattern}`);
      return null;
    }
    const imageSource = await uploadImageFn(match.image);
    const alt = this.imageAltFrom(match.image);
    const filename = this.filenameFromUrl(match.image.src || "");
    const captionInfo = this.captionForImage(ctx, match.index, matcher, filename);
    this.markImageIndices(ctx, [match.index]);
    const caption = this.consumeCaptionInfo(ctx, captionInfo, match.index);
    debugLog(`   ✅ Matched image at index ${match.index}, remaining unused text segments: ${this.remainingTextSegmentCount(ctx)}`);
    return {
      imageSource,
      alt,
      imageBorderRadius: 6,
      contentText: caption,
      showTextAfterImage: caption ? !matcher.captionBeforeImage : undefined
    };
  }

  private async matchImageByAlt(ctx: TransformationContext, matcher: ContentMatcher, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<Partial<PageContentColumn>> {
    if (!matcher.altTextPattern) {
      debugLog("⚠️ No altText pattern provided");
      return null;
    }
    const regex = new RegExp(matcher.altTextPattern, "i");
    const match = this.unusedImageSegments(ctx).find(info => regex.test(info.image.alt || ""));
    if (!match) {
      debugLog("   ⚠️ No image matched alt text pattern");
      return null;
    }
    const imageSource = await uploadImageFn(match.image);
    const alt = match.image.alt || "Image";
    this.markImageIndices(ctx, [match.index]);
    debugLog(`   ✅ Matched image by alt at index ${match.index}`);
    return {imageSource, alt, imageBorderRadius: 6};
  }

  private async matchFirstImage(
    ctx: TransformationContext, matcher: ContentMatcher,
    uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<Partial<PageContentColumn>> {
    const first = this.unusedImageSegments(ctx)[0];
    if (!first) {
      return null;
    }
    const imageSource = await uploadImageFn(first.image);
    const alt = this.imageAltFrom(first.image);
    const filename = this.filenameFromUrl(first.image.src || "");
    const captionInfo = this.captionForImage(ctx, first.index, matcher, filename);
    const caption = this.consumeCaptionInfo(ctx, captionInfo, first.index);
    this.markImageIndices(ctx, [first.index]);
    debugLog(`   Found first image at index ${first.index}, remaining unused text segments: ${this.remainingTextSegmentCount(ctx)}`);
    return {
      imageSource,
      alt,
      imageBorderRadius: 6,
      contentText: caption,
      showTextAfterImage: caption ? !matcher?.captionBeforeImage : undefined
    };
  }

  private async matchRemainingImages(
    ctx: TransformationContext,
    matcher: ContentMatcher,
    uploadImageFn: (img: ScrapedImage) => Promise<string>
  ): Promise<Partial<PageContentColumn>> {
    const remaining = this.unusedImageSegments(ctx)[0];
    if (!remaining) {
      return null;
    }
    const imageSource = await uploadImageFn(remaining.image);
    const alt = remaining.image.alt || "Image";
    const filename = this.filenameFromUrl(remaining.image.src || "");
    const captionInfo = this.captionForImage(ctx, remaining.index, matcher, filename);
    const caption = this.consumeCaptionInfo(ctx, captionInfo, remaining.index);
    this.markImageIndices(ctx, [remaining.index]);
    debugLog(`   Returned remaining image at index ${remaining.index}, remaining unused text segments: ${this.remainingTextSegmentCount(ctx)}`);
    return {
      imageSource,
      alt,
      imageBorderRadius: 6,
      contentText: caption,
      showTextAfterImage: caption ? !matcher?.captionBeforeImage : undefined
    };
  }

  private async matchAllImages(ctx: TransformationContext, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<Partial<PageContentColumn>> {
    const images = ctx.segments
      .map((segment, index) => ({segment, index}))
      .filter(({segment}) => Boolean(segment.image));
    if (images.length === 0) {
      return null;
    }
    const markdown = await Promise.all(images.map(({segment}) => this.segmentToMarkdown(ctx, segment, uploadImageFn)));
    const contentText = markdown.join("\n\n");
    debugLog(`   Returned ALL_IMAGES as markdown: ${markdown.length}`);
    return contentText ? {contentText} : null;
  }

  private async matchLastImage(ctx: TransformationContext, matcher: ContentMatcher, uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<Partial<PageContentColumn>> {
    const segments = this.unusedImageSegments(ctx);
    const last = segments[segments.length - 1];
    if (!last) {
      return null;
    }
    const imageSource = await uploadImageFn(last.image);
    const alt = this.imageAltFrom(last.image);
    const filename = this.filenameFromUrl(last.image.src || "");
    const captionInfo = this.captionForImage(ctx, last.index, matcher, filename);
    const caption = this.consumeCaptionInfo(ctx, captionInfo, last.index);
    this.markImageIndices(ctx, [last.index]);
    debugLog(`   Found last image at index ${last.index}, remaining unused text segments: ${this.remainingTextSegmentCount(ctx)}`);
    return {
      imageSource,
      alt,
      imageBorderRadius: 6,
      contentText: caption,
      showTextAfterImage: caption ? !matcher?.captionBeforeImage : undefined
    };
  }

  private matchHeading(ctx: TransformationContext): Partial<PageContentColumn> {
    for (const [i, seg] of ctx.segments.entries()) {
      if (seg.text && !seg.image && !ctx.usedTextIndices.has(i)) {
        const cleaned = this.cleanAndExclude(ctx, seg.text);
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

  private matchRemaining(ctx: TransformationContext): Partial<PageContentColumn> {
    const remaining: string[] = [];
    for (const [i, seg] of ctx.segments.entries()) {
      if (seg.text && !seg.image && !ctx.usedTextIndices.has(i)) {
        remaining.push(this.cleanAndExclude(ctx, seg.text));
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

    if (isUndefined(step.targetRow)) {
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
    if (isUndefined(step.targetRow) || isUndefined(step.targetColumn) || !step.contentMatcher) {
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

  private getSegmentType(ctx: TransformationContext, segment: ScrapedSegment): SegmentType {
    if (segment.image) {
      return SegmentType.IMAGE;
    }
    if (segment.text) {
      const cleaned = this.cleanAndExclude(ctx, segment.text);
      const isHeading = this.isHeadingText(cleaned);
      return isHeading ? SegmentType.HEADING : SegmentType.TEXT;
    }
    return SegmentType.TEXT;
  }

  private isHeadingText(text: string): boolean {
    const atxHeading = /(^|\n)\s*#+\s+/;
    const setextHeading = /^.+\n[=\-]{3,}\s*$/m;
    return atxHeading.test(text) || setextHeading.test(text);
  }

  private shouldStopCollection(segmentType: SegmentType, stopCondition?: { onDetect: SegmentType[] }): boolean {
    if (!stopCondition || !stopCondition.onDetect) {
      return false;
    }
    return stopCondition.onDetect.includes(segmentType);
  }

  private async collectWithBreaks(
    matcher: ContentMatcher, textRowTemplate: any,
    imageRowTemplate: any, ctx: TransformationContext,
    uploadImageFn: (img: ScrapedImage) => Promise<string>): Promise<PageContentRow[]> {
    const state = {
      rows: [] as PageContentRow[],
      textBuffer: [] as string[],
      addedImageCount: 0
    };
    const appendText = (text: string) => {
      state.textBuffer.push(text);
    };
    const flushTextBuffer = () => {
      if (state.textBuffer.length === 0) {
        return;
      }
      const transformation: Transformation = {template: textRowTemplate, contentText: state.textBuffer.join("\n\n")};
      state.rows.push(this.buildTextRow(transformation));
      state.textBuffer = [];
    };

    debugLog(
      `Collecting with breaks: breakOnImage=${matcher.breakOnImage}, ` +
      `groupTextWithImage=${matcher.groupTextWithImage}, ` +
      `stopCondition=${JSON.stringify(matcher.stopCondition)}`
    );
    debugLog(`   Text row type: ${textRowTemplate.type}, Image row type: ${imageRowTemplate.type}`);

    for (const [i, segment] of ctx.segments.entries()) {
      if (ctx.usedTextIndices.has(i) || ctx.usedImageIndices.has(i)) {
        continue;
      }

      if (segment.text && !segment.image) {
        const cleaned = this.cleanAndExclude(ctx, segment.text);
        const segmentType = this.getSegmentType(ctx, segment);

        if (this.shouldStopCollection(segmentType, matcher.stopCondition)) {
          debugLog(`   Stopping collection at index ${i} due to detection of ${segmentType}`);
          const headingIndex = this.headingBoundaryIndex(cleaned);
          if (!isNull(headingIndex)) {
            const textBeforeHeading = cleaned.substring(0, headingIndex).trim();
            if (textBeforeHeading) {
              const lastRow = state.rows[state.rows.length - 1];
              const lastColumn = lastRow?.columns?.[0];
              const canUseAsCaption = matcher.groupTextWithImage && textBeforeHeading.length <= 100 && !this.isHeadingText(textBeforeHeading) && Boolean(lastColumn?.imageSource);
              if (canUseAsCaption && lastColumn) {
                lastColumn.contentText = textBeforeHeading;
                lastColumn.showTextAfterImage = true;
                ctx.usedTextIndices.add(i);
                debugLog(`   Grouped text before heading as caption for last image: "${textBeforeHeading}"`);
              } else {
                debugLog(`   Including text before heading: ${textBeforeHeading.substring(0, 50)}`);
                appendText(textBeforeHeading);
              }
            }
          }
          break;
        }

        appendText(cleaned);
        ctx.usedTextIndices.add(i);
        continue;
      }

      if (!segment.image || !this.shouldIncludeImage(segment, matcher, state.addedImageCount)) {
        continue;
      }

      flushTextBuffer();

      if (matcher.breakOnImage) {
        const imageSource = await uploadImageFn(segment.image);
        const filename = this.filenameFromUrl(segment.image.src || "");
        const captionInfo = this.captionForImage(ctx, i, matcher, filename);
        const caption = this.consumeCaptionInfo(ctx, captionInfo, i);
        const imageRow = this.buildImageRow(
          imageRowTemplate,
          imageSource,
          segment.image.alt || segment.text || "Image",
          caption
        );
        state.rows.push(imageRow);
        ctx.usedImageIndices.add(i);
        state.addedImageCount += 1;
        debugLog(`   Added image row for index ${i}, remaining unused text segments: ${this.remainingTextSegmentCount(ctx)}`);
      }
    }

    flushTextBuffer();
    debugLog(`   Created ${state.rows.length} nested rows with collection breaks`);
    return state.rows;
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

  private async addLocationRow(step: TransformationAction, ctx: TransformationContext): Promise<void> {
    debugLog("Adding Location row");
    const config = step.locationRowConfig;
    if (!config) {
      debugLog("  ⚠️ No locationRowConfig provided");
      return;
    }

    const locationValue = await this.resolveLocationValue(config, ctx);
    debugLog(`  Post-lookup ctx.extractedLocation: ${JSON.stringify(ctx.extractedLocation)}`);

    if (!locationValue && !ctx.extractedLocation) {
      debugLog("  ⚠️ No location data available, skipping location row");
      return;
    }

    const fallbackValue = locationValue || "Unknown location";
    const locationRowData = ctx.extractedLocation || this.fallbackLocationFromValue(fallbackValue, config.hidden);

    if (!isUndefined(config.hidden)) {
      locationRowData.renderingMode = config.hidden ? LocationRenderingMode.HIDDEN : LocationRenderingMode.VISIBLE;
    }

    ctx.rows.push({
      type: PageContentType.LOCATION,
      maxColumns: 1,
      showSwiper: false,
      location: locationRowData,
      columns: []
    });

    if (locationValue) {
      debugLog(`  Added Location row: ${locationValue} at (${locationRowData.start.latitude}, ${locationRowData.start.longitude}) (hidden: ${config.hidden ?? true})`);
    } else {
      debugLog(`  Added Location row with fallback location: ${locationRowData.start.description} (hidden: ${config.hidden ?? true})`);
    }
  }

  private async addIndexRow(step: TransformationAction, ctx: TransformationContext): Promise<void> {
    debugLog("Adding Index row");
    const config = step.indexRowConfig;
    if (!config) {
      debugLog("  ⚠️ No indexRowConfig provided");
      return;
    }

    ctx.rows.push({
      type: PageContentType.ALBUM_INDEX,
      maxColumns: config.maxCols || 4,
      minColumns: config.minCols || 2,
      showSwiper: false,
      albumIndex: {
        contentTypes: (config.contentTypes || ["albums"]) as IndexContentType[],
        renderModes: (config.renderModes || ["action-buttons"]) as IndexRenderMode[],
        contentPaths: config.contentPaths?.map(cp => ({
          contentPath: cp.contentPath,
          stringMatch: cp.stringMatch as StringMatch || StringMatch.CONTAINS
        })) || [],
        minCols: config.minCols,
        maxCols: config.maxCols,
        mapConfig: config.mapConfig
      },
      columns: []
    });
    debugLog(`  Added Index row with ${config.contentPaths?.length || 0} content paths`);
  }

  private async addMapRow(step: TransformationAction, ctx: TransformationContext): Promise<void> {
    debugLog("Adding Map row");
    const mapping = step.mapRowConfig;
    if (!mapping) {
      debugLog("  ⚠️ No mapRowConfig provided");
      return;
    }

    const defaultMapData: MapData = {
      mapHeight: 500,
      provider: "osm",
      osStyle: "Leisure_27700",
      mapCenter: [51.073, 0.58],
      mapZoom: 11,
      showControlsDefault: true,
      allowControlsToggle: true,
      showWaypointsDefault: true,
      allowWaypointsToggle: true,
      autoFitBounds: true,
      routes: [],
      markers: []
    };

    const mapData: MapData = {...defaultMapData};

    if (mapping.gpxFilePath) {
      mapData.routes.push({
        id: "route-1",
        name: "Route",
        gpxFile: {awsFileName: mapping.gpxFilePath},
        color: "#e74c3c",
        visible: true
      });
      debugLog(`  Added GPX route: ${mapping.gpxFilePath}`);
    }

    if (!isUndefined(mapping.useLocationFromRow)) {
      const locationData = mapping.useLocationFromRow === true
        ? this.findClosestLocationRow(ctx, ctx.rows.length)
        : null;

      if (mapping.useLocationFromRow === true) {
        debugLog(`  Auto-found closest location row for map`);
      }

      if (locationData && !isNull(locationData.start.latitude) && !isNull(locationData.start.longitude)) {
        mapData.mapCenter = [locationData.start.latitude, locationData.start.longitude];
        debugLog(`  Map centered at extracted location: ${mapData.mapCenter}`);

        mapData.markers.push({
          latitude: locationData.start.latitude,
          longitude: locationData.start.longitude,
          label: locationData.start.description || "Start"
        });
        debugLog(`  Added marker for start location: ${locationData.start.description}`);

        if (locationData.end && !isNull(locationData.end.latitude) && !isNull(locationData.end.longitude)) {
          mapData.markers.push({
            latitude: locationData.end.latitude,
            longitude: locationData.end.longitude,
            label: locationData.end.description || "End"
          });
          debugLog(`  Added marker for end location: ${locationData.end.description}`);
        }

        if (!mapData.mapZoom || mapData.mapZoom < 10) {
          mapData.mapZoom = 14;
        }

        if (mapData.routes.length === 0 && mapData.markers.length > 0) {
          mapData.autoFitBounds = false;
          debugLog(`  Disabled autoFitBounds (no routes, but has ${mapData.markers.length} marker(s))`);
        }
      } else {
        debugLog(`  ⚠️ No valid location data found for map`);
      }
    }

    ctx.rows.push({
      type: PageContentType.MAP,
      maxColumns: 1,
      showSwiper: false,
      map: mapData,
      columns: []
    });
    debugLog(`  Added Map row (height: ${mapData.mapHeight})`);
  }


  private findClosestLocationRow(ctx: TransformationContext, mapRowIndex: number): LocationRowData | null {
    debugLog(`  Looking for location rows before map index ${mapRowIndex}, current rows: ${ctx.rows.length}`);

    const locationRowsBeforeMap = ctx.rows
      .map((row, index) => ({row, index}))
      .filter(({row, index}) =>
        row.type === PageContentType.LOCATION &&
        row.location &&
        row.location.start &&
        index < mapRowIndex
      );

    debugLog(`  Found ${locationRowsBeforeMap.length} location rows before map`);

    if (locationRowsBeforeMap.length > 0) {
      const closest = locationRowsBeforeMap[locationRowsBeforeMap.length - 1];
      debugLog(`  Found closest location row before map at index ${closest.index}`);
      return closest.row.location;
    }

    const anyLocationRow = ctx.rows.find(row =>
      row.type === PageContentType.LOCATION &&
      row.location &&
      row.location.start
    );

    if (anyLocationRow) {
      debugLog(`  Found location row (not before map)`);
      return anyLocationRow.location;
    }

    debugLog(`  No location rows found`);
    return null;
  }

  private async populateMapRow(
    templateRow: PageContentRow,
    mapping: MigrationTemplateMapping,
    ctx: TransformationContext
  ): Promise<PageContentRow> {
    const populatedRow = this.cloneRow(templateRow);
    const mapData = populatedRow.map;

    if (!mapData) {
      debugLog("  ⚠️ Map data not found in template row for map mapping.");
      return populatedRow;
    }

    if (!isUndefined(mapping.map?.useLocationFromRow)) {
      let locationData = mapping.map.useLocationFromRow === true
        ? this.findClosestLocationRow(ctx, ctx.rows.length)
        : null;

      if (mapping.map.useLocationFromRow === true) {
        debugLog(`  Auto-found closest location row for map`);
      }

      if (!locationData && ctx.extractedLocation?.start) {
        locationData = ctx.extractedLocation;
        debugLog(`  Using extracted location as fallback: ${JSON.stringify(locationData)}`);
      }

      if (locationData && !isNull(locationData.start.latitude) && !isNull(locationData.start.longitude)) {
        mapData.mapCenter = [locationData.start.latitude, locationData.start.longitude];
        debugLog(`  Map centered at extracted location: ${mapData.mapCenter}`);

        mapData.markers = mapData.markers || [];
        mapData.markers.push({
          latitude: locationData.start.latitude,
          longitude: locationData.start.longitude,
          label: locationData.start.description || "Start"
        });
        debugLog(`  Added marker for start location: ${locationData.start.description}`);

        if (locationData.end && !isNull(locationData.end.latitude) && !isNull(locationData.end.longitude)) {
          mapData.markers.push({
            latitude: locationData.end.latitude,
            longitude: locationData.end.longitude,
            label: locationData.end.description || "End"
          });
          debugLog(`  Added marker for end location: ${locationData.end.description}`);
        }

        if (!mapData.mapZoom || mapData.mapZoom < 10) {
          mapData.mapZoom = 14;
        }
      } else {
        debugLog(`  ⚠️ No valid location data found for map - hiding map row`);
        populatedRow.hidden = true;
      }
    }

    if (mapping.map?.gpxFilePath && (!mapData.routes || mapData.routes.length === 0)) {
      mapData.routes = mapData.routes || [];
      mapData.routes.push({
        id: "route-1",
        name: "Route",
        gpxFile: {
          awsFileName: mapping.map.gpxFilePath
        },
        color: "#e74c3c",
        visible: true
      });
      debugLog(`  Added GPX route: ${mapping.map.gpxFilePath}`);
    }

    const hasRoutes = mapData.routes && mapData.routes.length > 0;
    const hasMarkers = mapData.markers && mapData.markers.length > 0;
    if (!hasRoutes && !hasMarkers) {
      debugLog(`  ⚠️ No routes or markers available for map - hiding map row`);
      populatedRow.hidden = true;
    } else if (hasMarkers && !hasRoutes) {
      debugLog(`  Map will show markers only (no GPX routes)`);
    }

    return populatedRow;
  }

  async transformWithTemplate(
    scrapedPage: ScrapedPage,
    template: PageContent,
    uploadImageFn: (img: ScrapedImage) => Promise<string>
  ): Promise<PageContent> {
    this.debugLogs = [];
    this.log(`✅ Starting template-based transformation for page: ${scrapedPage.path}`);
    this.log(`   Template has ${template.rows?.length || 0} rows`);

    const result: PageContent = {path: scrapedPage.path, rows: []};
    if (!template.rows) {
      this.log("❌ Template has no rows");
      result.debugLogs = this.debugLogs;
      return result;
    }

    const ctx = this.createTransformationContext(scrapedPage);
    this.convertToMarkdown(ctx);
    this.log(`🔄 Starting template transformation with ${template.rows?.length || 0} rows`);

    for (const [rowIndex, templateRow] of template.rows.entries()) {
      const mappings = template.migrationTemplate?.mappings?.filter(m => m.targetRowIndex === rowIndex) || [];
      this.log(`   Processing row ${rowIndex} (type: ${templateRow.type})`);
      this.log(`   Found ${mappings.length} mapping(s) for this row`);
      if (!mappings.length || mappings.every(m => m.sourceType === "static")) {
        const clonedRow = this.cloneRow(templateRow);
        if (this.replacePlaceholdersInRow(clonedRow, ctx)) {
          this.log(`   Replaced placeholders in unmapped row ${rowIndex}`);
        }
        result.rows.push(clonedRow);
        continue;
      }

      const metadataMapping = mappings.find(m => m.sourceType === "metadata");
      if (metadataMapping) {
        const metadataRow = this.cloneRow(templateRow);
        if (metadataRow.columns?.length) {
          const targetIndex = metadataMapping.targetColumnIndex ?? 0;
          const targetColumn = metadataRow.columns[targetIndex] || metadataRow.columns[0];
          if (targetColumn) {
            targetColumn.contentText = this.resolveMetadataValue(metadataMapping, scrapedPage);
          }
        }
        result.rows.push(metadataRow);
        continue;
      }

      const locationMapping = mappings.find(m => m.location);
      if (locationMapping) {
        const locationRow = this.cloneRow(templateRow);
        const locationValue = locationMapping.location.extractFromContent
          ? await this.resolveLocationValue({
            extractFromContent: true,
            defaultLocation: locationMapping.location.defaultLocation
          }, ctx)
          : locationMapping.location.defaultLocation;

        debugLog(`  Location mapping found, locationValue: ${locationValue}, ctx.extractedLocation: ${JSON.stringify(ctx.extractedLocation)}`);

        if (!locationValue) {
          debugLog("  ⚠️ No location data found, skipping location row");
          continue;
        }

        if (ctx.extractedLocation) {
          locationRow.location = ctx.extractedLocation;
          debugLog(`  Set location row data: ${JSON.stringify(locationRow.location)}`);
        } else {
          const hidden = locationRow.location?.renderingMode === LocationRenderingMode.HIDDEN;
          locationRow.location = this.fallbackLocationFromValue(locationValue, hidden);
          debugLog(`  Created fallback location row data`);
        }
        result.rows.push(locationRow);
        continue;
      }

      const mapMapping = mappings.find(m => templateRow.type === PageContentType.MAP && m.map);
      if (mapMapping) {
        const populatedMapRow = await this.populateMapRow(templateRow, mapMapping, ctx);
        result.rows.push(populatedMapRow);
        continue;
      }

      const populatedRow = this.cloneRow(templateRow);
      let rowHasContent = false;

      for (const mapping of mappings.filter(m => m.sourceType === "extract" || !m.sourceType)) {
        if (mapping.map && !isUndefined(mapping.targetNestedRowIndex)) {
          this.log(`   Processing map configuration for nested row index ${mapping.targetNestedRowIndex}`);
          const populated = await this.populateNestedMapRow(populatedRow, mapping, ctx);
          rowHasContent = rowHasContent || populated;
        }

        if (mapping.columnMappings?.length && populatedRow.columns?.length) {
          const mappingPriority = (m: ColumnMappingConfig): number => {
            const isImages = m.nestedRowMapping?.contentSource === NestedRowContentSource.REMAINING_IMAGES;
            const isPatternMatch = m.imagePattern === ImagePattern.PATTERN_MATCH;
            const groupsText = isImages && (m.nestedRowMapping?.groupTextWithImage === true);
            if (isPatternMatch) return 1;
            if (groupsText) return 2;
            if (isImages) return 4;
            return 3;
          };
          const sortedMappings = [...mapping.columnMappings].sort((a, b) => mappingPriority(a) - mappingPriority(b));
          for (const columnMapping of sortedMappings) {
            const populated = await this.populateTemplateColumn(populatedRow, columnMapping, ctx, uploadImageFn);
            rowHasContent = rowHasContent || populated;
          }
        } else if (mapping.textPattern && populatedRow.columns?.length) {
          this.log(`   Attempting text extraction with pattern: ${mapping.textPattern}`);
          const extractedText = this.extractTextByPattern(ctx, mapping.textPattern);
          this.log(`   Extraction result: ${extractedText ? JSON.stringify({hasContent: !!extractedText.contentText, length: extractedText.contentText?.length}) : "null"}`);
          if (extractedText?.contentText) {
            const targetColumn = populatedRow.columns[0];
            if (targetColumn) {
              targetColumn.contentText = extractedText.contentText;
              rowHasContent = true;
              this.log(`   ✓ Extracted text using pattern "${mapping.textPattern}": ${extractedText.contentText.substring(0, 100)}...`);
            }
          } else {
            this.log(`   ✗ No content extracted for pattern "${mapping.textPattern}"`);
          }
        } else if (mapping.textPattern) {
          this.log(`   ⚠️  Has textPattern but no columns: ${JSON.stringify({hasPattern: !!mapping.textPattern, columnsLength: populatedRow.columns?.length})}`);
        }
      }

      const hideIfEmptyMapping = mappings.find(m => m.hideIfEmpty);
      if (hideIfEmptyMapping && !rowHasContent) {
        this.log("   Skipping row because no content was mapped");
        continue;
      }

      result.rows.push(populatedRow);
    }

    this.log(`✅ Template transformation complete: ${result.rows?.length || 0} rows created`);
    result.debugLogs = this.debugLogs;
    return result;
  }

  private extractTextByPattern(ctx: TransformationContext, pattern: string): Partial<PageContentColumn> | null {
    const handler = this.textMatcherHandlers[pattern];
    if (!handler) {
      this.log(`⚠️ Unknown text pattern: ${pattern}`);
      return null;
    }
    return handler(ctx);
  }

  private replacePlaceholdersInRow(row: PageContentRow, ctx: TransformationContext): boolean {
    let replaced = false;

    if (row.columns) {
      for (const column of row.columns) {
        if (column.contentText) {
          const originalText = column.contentText;
          column.contentText = this.replaceCommonPlaceholders(column.contentText, ctx);
          if (column.contentText !== originalText) {
            replaced = true;
          }
        }
      }
    }

    return replaced;
  }

  private replaceCommonPlaceholders(text: string, ctx: TransformationContext): string {
    let result = text;

    if (ctx.extractedLocation?.start?.description) {
      result = result.replace(/# Title Of Route/gi, ctx.extractedLocation.start.description);
    }

    if (ctx.extractedLocation?.start?.description || ctx.extractedLocation?.start?.grid_reference_6) {
      const locationText = ctx.extractedLocation.start.description || ctx.extractedLocation.start.grid_reference_6;
      result = result.replace(/## Subtitle placeholder/gi, locationText);
    }

    const firstHeading = this.firstHeadingSegment(ctx);
    if (firstHeading?.cleaned) {
      result = result.replace(/# Title Of Route/gi, firstHeading.cleaned);
    }

    return result;
  }

  private cloneRow<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

  private resolveMetadataValue(mapping: MigrationTemplateMapping, scrapedPage: ScrapedPage): string {
    const identifier = mapping.sourceIdentifier || "";
    if (identifier === "title") {
      return scrapedPage.title || "";
    }
    if (identifier === "path") {
      return scrapedPage.path || "";
    }
    if (identifier === "migration-note") {
      const prefix = mapping.metadataPrefix || "Migrated from";
      const format = mapping.metadataDateFormat || UIDateFormat.YEAR_MONTH_DAY_TIME_WITH_MINUTES;
      const url = scrapedPage.path || "";
      const link = url ? `[${url}](${url})` : "";
      const timestamp = DateTime.now().toFormat(format);
      if (link) {
        return `${prefix} ${link} on ${timestamp}`;
      }
      return `${prefix} on ${timestamp}`;
    }
    return "";
  }

  private async populateTemplateColumn(
    row: PageContentRow,
    mapping: ColumnMappingConfig,
    ctx: TransformationContext,
    uploadImageFn: (img: ScrapedImage) => Promise<string>
  ): Promise<boolean> {
    if (!row.columns || isUndefined(mapping.columnIndex) || isNull(mapping.columnIndex)) {
      this.log(`     Column mapping skipped: missing columns or columnIndex`);
      return false;
    }
    const column = row.columns[mapping.columnIndex];
    if (!column || mapping.sourceType !== "extract") {
      this.log(`     Column ${mapping.columnIndex} skipped: ${!column ? "column not found" : `sourceType=${mapping.sourceType}`}`);
      return false;
    }
    const nestedRowIndex = this.columnNestedRowIndex(mapping);
    const nestedColumnIndex = this.columnNestedColumnIndex(mapping);
    this.log(`     Processing column ${mapping.columnIndex}: contentType=${mapping.contentType}, textPattern=${mapping.textPattern || "none"}, imagePattern=${mapping.imagePattern || "none"}, nestedRowIndex=${nestedRowIndex ?? "none"}, nestedColumnIndex=${nestedColumnIndex ?? "none"}`);
    if (column.rows?.length && !isUndefined(nestedRowIndex)) {
      this.log(`     Column has nested rows, populating specific nested row index ${nestedRowIndex}`);
      return this.populateSpecificNestedRow(column, mapping, ctx, uploadImageFn);
    }
    if (column.rows?.length && mapping.nestedRowMapping) {
      this.log(`     Column has nested rows, using nested row mapping`);
      return this.populateNestedRowsForColumn(column, mapping, ctx, uploadImageFn);
    }
    return this.populateSimpleColumn(column, mapping, ctx, uploadImageFn);
  }

  private async populateNestedMapRow(
    row: PageContentRow,
    mapping: MigrationTemplateMapping,
    ctx: TransformationContext
  ): Promise<boolean> {
    if (!row.columns?.length || isUndefined(mapping.targetNestedRowIndex)) {
      this.log(`     Cannot populate nested map: no columns or targetNestedRowIndex not set`);
      return false;
    }
    const firstColumn = row.columns[0];
    if (!firstColumn.rows || !firstColumn.rows[mapping.targetNestedRowIndex]) {
      this.log(`     Nested row ${mapping.targetNestedRowIndex} not found in first column`);
      return false;
    }
    const nestedMapRow = firstColumn.rows[mapping.targetNestedRowIndex];
    if (nestedMapRow.type !== PageContentType.MAP) {
      this.log(`     Nested row ${mapping.targetNestedRowIndex} is not a map row (type: ${nestedMapRow.type})`);
      return false;
    }
    this.log(`     Populating nested map row ${mapping.targetNestedRowIndex} with map configuration`);
    const populated = await this.populateMapRow(nestedMapRow, mapping, ctx);
    if (populated.hidden) {
      this.log(`     Map row is hidden due to missing location - removing from nested rows`);
      firstColumn.rows.splice(mapping.targetNestedRowIndex, 1);
      return false;
    }
    firstColumn.rows[mapping.targetNestedRowIndex] = populated;
    return true;
  }

  private async populateSpecificNestedRow(
    column: PageContentColumn,
    mapping: ColumnMappingConfig,
    ctx: TransformationContext,
    uploadImageFn: (img: ScrapedImage) => Promise<string>
  ): Promise<boolean> {
    const nestedRowIndex = this.columnNestedRowIndex(mapping);
    if (!column.rows || isUndefined(nestedRowIndex)) {
      return false;
    }
    const targetRow = column.rows[nestedRowIndex];
    if (!targetRow || !targetRow.columns?.length) {
      this.log(`       Target nested row ${nestedRowIndex} not found or has no columns`);
      return false;
    }
    const extracted = await this.extractColumnContent(mapping, ctx, uploadImageFn);
    if (!extracted) {
      this.log(`       No content extracted for nested row ${nestedRowIndex}`);
      return false;
    }
    const nestedColumnIndex = this.columnNestedColumnIndex(mapping);
    if (!isUndefined(nestedColumnIndex)) {
      const targetColumn = targetRow.columns[nestedColumnIndex];
      if (!targetColumn) {
        this.log(`       Target nested column ${nestedColumnIndex} not found in row ${nestedRowIndex}`);
        return false;
      }
      this.log(`       Populating nested row ${nestedRowIndex}, column ${nestedColumnIndex} with extracted content`);
      return this.applyExtractedContent([targetColumn], extracted, mapping);
    } else {
      this.log(`       Populating nested row ${nestedRowIndex} (all columns) with extracted content`);
      return this.applyExtractedContent(targetRow.columns, extracted, mapping);
    }
  }

  private columnNestedRowIndex(mapping: ColumnMappingConfig): number | undefined {
    return mapping.nestedRowIndex ?? mapping.targetNestedRowIndex;
  }

  private columnNestedColumnIndex(mapping: ColumnMappingConfig): number | undefined {
    return mapping.nestedColumnIndex ?? mapping.targetNestedColumnIndex;
  }

  private async populateSimpleColumn(
    column: PageContentColumn,
    mapping: ColumnMappingConfig,
    ctx: TransformationContext,
    uploadImageFn: (img: ScrapedImage) => Promise<string>
  ): Promise<boolean> {
    const extracted = await this.extractColumnContent(mapping, ctx, uploadImageFn);
    if (!extracted) {
      return false;
    }
    return this.applyExtractedContent([column], extracted, mapping);
  }

  private async extractColumnContent(
    mapping: ColumnMappingConfig,
    ctx: TransformationContext,
    uploadImageFn: (img: ScrapedImage) => Promise<string>
  ): Promise<ExtractedContent | null> {
    const desired = mapping.contentType || ColumnContentType.TEXT;
    const textPatternToUse = mapping.textPattern
      ? (mapping.textPattern as TextMatchPattern)
      : (mapping.extractPattern ? TextMatchPattern.CUSTOM_REGEX : TextMatchPattern.REMAINING_TEXT);

    if (desired === ColumnContentType.TEXT) {
      const usesHeadingPattern = textPatternToUse === TextMatchPattern.TEXT_BEFORE_HEADING
        || textPatternToUse === TextMatchPattern.TEXT_FROM_HEADING;

      return this.extractTextContent({
        type: ContentMatchType.TEXT,
        textPattern: textPatternToUse,
        headingPattern: usesHeadingPattern ? mapping.extractPattern : undefined,
        customRegex: usesHeadingPattern ? undefined : mapping.extractPattern
      }, ctx);
    }
    if (desired === ColumnContentType.IMAGE) {
      return this.extractImageForColumn(mapping, ctx, uploadImageFn);
    }

    if (mapping.groupShortTextWithImage !== false && mapping.imagePattern) {
      const imageResult = await this.extractImageForColumn(mapping, ctx, uploadImageFn);
      if (imageResult) {
        return imageResult;
      }
    } else if (mapping.textPattern && mapping.imagePattern) {
      const usesHeadingPattern = textPatternToUse === TextMatchPattern.TEXT_BEFORE_HEADING
        || textPatternToUse === TextMatchPattern.TEXT_FROM_HEADING;

      const textResult = await this.extractTextContent({
        type: ContentMatchType.TEXT,
        textPattern: textPatternToUse,
        headingPattern: usesHeadingPattern ? mapping.extractPattern : undefined,
        customRegex: usesHeadingPattern ? undefined : mapping.extractPattern
      }, ctx);
      const imageResult = await this.extractImageForColumn(mapping, ctx, uploadImageFn);
      if (textResult && imageResult) {
        return {
          kind: "image",
          column: {
            ...imageResult.column,
            contentText: textResult.column.contentText
          }
        };
      }
      return imageResult || textResult;
    }

    const imageResult = await this.extractImageForColumn(mapping, ctx, uploadImageFn);
    if (imageResult) {
      return imageResult;
    }
    const usesHeadingPattern = textPatternToUse === TextMatchPattern.TEXT_BEFORE_HEADING
      || textPatternToUse === TextMatchPattern.TEXT_FROM_HEADING;

    return this.extractTextContent({
      type: ContentMatchType.TEXT,
      textPattern: textPatternToUse,
      headingPattern: usesHeadingPattern ? mapping.extractPattern : undefined,
      customRegex: usesHeadingPattern ? undefined : mapping.extractPattern
    }, ctx);
  }

  private async extractImageForColumn(
    mapping: ColumnMappingConfig,
    ctx: TransformationContext,
    uploadImageFn: (img: ScrapedImage) => Promise<string>
  ): Promise<ExtractedContent | null> {
    const mode = mapping.imagePattern || ImagePattern.FIRST;
    const groupCaptions = mapping.groupShortTextWithImage;
    if (mode === ImagePattern.ALL) {
      const combined = await this.matchAllImages(ctx, uploadImageFn);
      return combined ? {kind: "text", column: combined} : null;
    }
    if (mode === ImagePattern.PATTERN_MATCH && mapping.imagePatternValue) {
      const matcher: ContentMatcher = {
        type: ContentMatchType.IMAGE,
        imagePattern: ImageMatchPattern.FILENAME_PATTERN,
        filenamePattern: mapping.imagePatternValue,
        groupTextWithImage: groupCaptions
      };
      const column = await this.matchImageByFilename(ctx, matcher, uploadImageFn);
      return column ? {kind: "image", column} : null;
    }
    if (mode === ImagePattern.LAST) {
      const column = await this.matchLastImage(ctx, {
        type: ContentMatchType.IMAGE,
        groupTextWithImage: groupCaptions
      }, uploadImageFn);
      return column ? {kind: "image", column} : null;
    }
    if (mode === ImagePattern.FIRST) {
      const column = await this.matchFirstImage(ctx, {
        type: ContentMatchType.IMAGE,
        groupTextWithImage: groupCaptions
      }, uploadImageFn);
      return column ? {kind: "image", column} : null;
    }
    const column = await this.matchRemainingImages(ctx, {
      type: ContentMatchType.IMAGE,
      groupTextWithImage: groupCaptions
    }, uploadImageFn);
    return column ? {kind: "image", column} : null;
  }

  private async populateNestedRowsForColumn(
    column: PageContentColumn,
    mapping: ColumnMappingConfig,
    ctx: TransformationContext,
    uploadImageFn: (img: ScrapedImage) => Promise<string>
  ): Promise<boolean> {
    const clonedRows = column.rows?.map(row => this.cloneRow(row)) || [];
    const {templateRow, staticRows} = this.partitionNestedRows(clonedRows);
    if (!templateRow || !mapping.nestedRowMapping) {
      column.rows = clonedRows;
      return false;
    }
    const dynamicRows = await this.buildDynamicNestedRows(templateRow, mapping, ctx, uploadImageFn);
    column.rows = [...dynamicRows, ...staticRows];
    return dynamicRows.length > 0;
  }

  private partitionNestedRows(rows: PageContentRow[]): {templateRow: PageContentRow | null; staticRows: PageContentRow[]} {
    let templateRow: PageContentRow | null = null;
    const staticRows: PageContentRow[] = [];
    for (const row of rows) {
      if (!templateRow && row.type !== PageContentType.SHARED_FRAGMENT) {
        templateRow = row;
      } else {
        staticRows.push(row);
      }
    }
    return {templateRow, staticRows};
  }

  private async buildDynamicNestedRows(
    templateRow: PageContentRow,
    mapping: ColumnMappingConfig,
    ctx: TransformationContext,
    uploadImageFn: (img: ScrapedImage) => Promise<string>
  ): Promise<PageContentRow[]> {
    const config = mapping.nestedRowMapping;
    if (!config) {
      return [];
    }
    if (config.packingBehavior === NestedRowPackingBehavior.ALL_IN_ONE) {
      const item = await this.extractPrimaryContent(config, mapping, ctx, uploadImageFn, true);
      if (!item) {
        return [];
      }
      const rowClone = this.cloneRow(templateRow);
      const updated = await this.applyExtractedContentToRow(rowClone, item, mapping);
      return updated ? [rowClone] : [];
    }

    const generated: PageContentRow[] = [];
    while (true) {
      const item = await this.extractPrimaryContent(config, mapping, ctx, uploadImageFn, false);
      if (!item) {
        break;
      }
      const rowClone = this.cloneRow(templateRow);
      const updated = await this.applyExtractedContentToRow(rowClone, item, mapping);
      if (!updated) {
        break;
      }
      generated.push(rowClone);
      if (config.packingBehavior !== NestedRowPackingBehavior.ONE_PER_ITEM) {
        break;
      }
    }
    return generated;
  }

  private async extractPrimaryContent(
    config: NestedRowMappingConfig,
    mapping: ColumnMappingConfig,
    ctx: TransformationContext,
    uploadImageFn: (img: ScrapedImage) => Promise<string>,
    aggregate: boolean
  ): Promise<ExtractedContent | null> {
    switch (config.contentSource) {
      case NestedRowContentSource.REMAINING_IMAGES:
        return this.extractImageContent({
          type: ContentMatchType.IMAGE,
          imagePattern: ImageMatchPattern.REMAINING_IMAGES,
          filenamePattern: config.filenamePattern || config.imagePattern || mapping.imagePatternValue,
          groupTextWithImage: config.groupTextWithImage ?? mapping.groupShortTextWithImage,
          allowLongCaptions: Boolean(config.textPattern && config.headingPattern)
        }, ctx, uploadImageFn);
      case NestedRowContentSource.ALL_IMAGES:
        if (aggregate) {
          const column = await this.matchAllImages(ctx, uploadImageFn);
          return column ? {kind: "text", column} : null;
        }
        return this.extractImageContent({
          type: ContentMatchType.IMAGE,
          imagePattern: ImageMatchPattern.REMAINING_IMAGES,
          filenamePattern: config.filenamePattern || config.imagePattern || mapping.imagePatternValue,
          groupTextWithImage: config.groupTextWithImage ?? mapping.groupShortTextWithImage
        }, ctx, uploadImageFn);
      case NestedRowContentSource.REMAINING_TEXT:
        return this.extractTextContent({
          type: ContentMatchType.TEXT,
          textPattern: TextMatchPattern.REMAINING_TEXT,
          customRegex: config.customTextPattern || config.textPattern
        }, ctx);
      case NestedRowContentSource.ALL_CONTENT:
        if (aggregate) {
          const column = await this.matchAll(ctx, uploadImageFn);
          return column ? {kind: "text", column} : null;
        }
        return this.extractTextContent({
          type: ContentMatchType.TEXT,
          textPattern: TextMatchPattern.REMAINING_TEXT,
          customRegex: config.customTextPattern || config.textPattern
        }, ctx);
      case NestedRowContentSource.PATTERN_MATCH:
        if (config.filenamePattern || mapping.imagePatternValue) {
          return this.extractImageContent({
            type: ContentMatchType.IMAGE,
            imagePattern: ImageMatchPattern.FILENAME_PATTERN,
            filenamePattern: config.filenamePattern || mapping.imagePatternValue,
            groupTextWithImage: mapping.groupShortTextWithImage
          }, ctx, uploadImageFn);
        }
        const textMatcher = this.nestedRowTextMatcher(config);
        if (textMatcher) {
          return this.extractTextContent(textMatcher, ctx);
        }
        return null;
      default:
        return null;
    }
  }

  private async extractImageContent(
    matcher: ContentMatcher,
    ctx: TransformationContext,
    uploadImageFn: (img: ScrapedImage) => Promise<string>
  ): Promise<ExtractedContent | null> {
    const column = await this.matchImage(matcher, ctx, uploadImageFn);
    return this.toExtracted("image", column);
  }

  private extractTextContent(matcher: ContentMatcher, ctx: TransformationContext): ExtractedContent | null {
    const column = this.matchText(matcher, ctx);
    return this.toExtracted("text", column);
  }

  private async applyExtractedContentToRow(row: PageContentRow, item: ExtractedContent, mapping?: ColumnMappingConfig): Promise<boolean> {
    if (!row.columns || row.columns.length === 0) {
      return false;
    }
    return this.applyExtractedContent(row.columns, item, mapping);
  }

  private applyExtractedContent(columns: PageContentColumn[], item: ExtractedContent, mapping?: ColumnMappingConfig): boolean {
    const typePreference = mapping?.contentType;
    let imageApplied = false;
    let textApplied = false;
    for (const column of columns) {
      const result = this.applyExtractedContentToColumn(column, item, typePreference);
      imageApplied = imageApplied || result.imageApplied;
      textApplied = textApplied || result.textApplied;
      if (item.kind === "text" && textApplied) {
        break;
      }
      if (item.kind === "image") {
        const needsText = Boolean(item.column.contentText);
        if (imageApplied && (!needsText || textApplied)) {
          break;
        }
      }
    }
    return imageApplied || textApplied;
  }

  private applyExtractedContentToColumn(
    column: PageContentColumn,
    item: ExtractedContent,
    typeHint?: ColumnContentType
  ): {imageApplied: boolean; textApplied: boolean} {
    const type = typeHint || this.detectColumnType(column);
    const supportsImage = this.columnSupportsImage(type);
    const supportsText = this.columnSupportsText(type);
    let imageApplied = false;
    let textApplied = false;
    if (item.kind === "image" && supportsImage) {
      if (item.column.imageSource) {
        column.imageSource = item.column.imageSource;
        column.alt = item.column.alt;
        column.imageBorderRadius = item.column.imageBorderRadius ?? column.imageBorderRadius;
        imageApplied = true;
      }
      if (item.column.contentText && supportsText) {
        column.contentText = item.column.contentText;
        column.showTextAfterImage = item.column.showTextAfterImage;
        textApplied = true;
      }
    } else if (item.kind === "text" && supportsText && item.column.contentText) {
      column.contentText = item.column.contentText;
      column.showTextAfterImage = item.column.showTextAfterImage;
      textApplied = true;
    }
    return {imageApplied, textApplied};
  }

  private columnSupportsImage(type: ColumnContentType): boolean {
    return type === ColumnContentType.IMAGE || type === ColumnContentType.MIXED;
  }

  private columnSupportsText(type: ColumnContentType): boolean {
    return type === ColumnContentType.TEXT || type === ColumnContentType.MIXED;
  }

  private detectColumnType(column: PageContentColumn): ColumnContentType {
    const hasImage = Boolean(column.imageSource || column.showPlaceholderImage || column.imageAspectRatio);
    const hasText = Boolean(column.contentText || column.showTextAfterImage);
    if (hasImage && hasText) {
      return ColumnContentType.MIXED;
    }
    if (hasImage) {
      return ColumnContentType.IMAGE;
    }
    return ColumnContentType.TEXT;
  }

  private toExtracted(kind: "text" | "image", column: Partial<PageContentColumn> | null): ExtractedContent | null {
    return column ? {kind, column} : null;
  }

  private nestedRowTextMatcher(config: NestedRowMappingConfig): ContentMatcher | null {
    if (!config.textPattern && !config.customTextPattern) {
      return null;
    }
    if (config.textPattern && this.supportedTextPatterns.has(config.textPattern as TextMatchPattern)) {
      const pattern = config.textPattern as TextMatchPattern;
      if (pattern === TextMatchPattern.CUSTOM_REGEX) {
        const customRegex = config.customTextPattern;
        if (!customRegex) {
          return null;
        }
        return {
          type: ContentMatchType.TEXT,
          textPattern: TextMatchPattern.CUSTOM_REGEX,
          customRegex
        };
      }
      return {
        type: ContentMatchType.TEXT,
        textPattern: pattern,
        headingPattern: config.headingPattern
      };
    }
    const fallbackRegex = config.customTextPattern || config.textPattern;
    if (!fallbackRegex) {
      return null;
    }
    return {
      type: ContentMatchType.TEXT,
      textPattern: TextMatchPattern.CUSTOM_REGEX,
      customRegex: fallbackRegex
    };
  }
}
