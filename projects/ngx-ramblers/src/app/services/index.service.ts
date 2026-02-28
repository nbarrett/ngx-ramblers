import { inject, Injectable } from "@angular/core";
import { first, last } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import {
  AlbumIndexSortConfig,
  AlbumIndexSortField,
  ContentPathMatch,
  ContentPathMatchConfigs,
  FocalPointTarget,
  IndexContentType,
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentToRows,
  PageContentType,
  StringMatch
} from "../models/content-text.model";
import { SortDirection } from "../models/sort.model";
import { MongoRegex } from "../functions/mongo";
import { sortBy } from "../functions/arrays";
import { AccessLevel } from "../models/member-resource.model";
import { LoggerFactory } from "./logger-factory.service";
import { StringUtilsService } from "./string-utils.service";
import { ContentMetadata } from "../models/content-metadata.model";
import { PageContentService } from "./page-content.service";
import { ContentMetadataService } from "./content-metadata.service";
import { UrlService } from "./url.service";
import { PageContentActionsService } from "./page-content-actions.service";
import { DataQueryOptions, FilterCriteria } from "../models/api-request.model";
import { PageService } from "./page.service";
import { LocationExtractionService } from "./location-extraction.service";
import { WalksAndEventsService } from "./walks-and-events/walks-and-events.service";
import { ExtendedGroupEventQueryService } from "./walks-and-events/extended-group-event-query.service";
import { YouTubeService } from "./youtube.service";

@Injectable({
  providedIn: "root"
})
export class IndexService {

  public pageContentService: PageContentService = inject(PageContentService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public urlService: UrlService = inject(UrlService);
  public pageService: PageService = inject(PageService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  private locationExtractionService: LocationExtractionService = inject(LocationExtractionService);
  private walksAndEventsService: WalksAndEventsService = inject(WalksAndEventsService);
  private extendedGroupEventQueryService: ExtendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private youtubeService: YouTubeService = inject(YouTubeService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("IndexService", NgxLoggerLevel.ERROR);
  public instance = this;

  public async albumIndexToPageContent(pageContentRow: PageContentRow, rowIndex: number): Promise<PageContent> {
    const albumIndex = pageContentRow.albumIndex;
    if (albumIndex?.contentPaths?.length > 0) {
      const contentTypes = albumIndex.contentTypes || [IndexContentType.ALBUMS];

      const pathRegex = albumIndex.contentPaths.map(contentPath => ({
        path: ContentPathMatchConfigs[contentPath.stringMatch].mongoRegex(contentPath.contentPath)
      }));

      this.logger.info("Query criteria:", {$or: pathRegex});

      let allPages = await this.pageContentService.all({criteria: {$or: pathRegex}});
      this.logger.info("Found", allPages.length, "pages matching criteria. Sample paths:", allPages.slice(0, 5).map(p => p.path));

      if (albumIndex.excludePaths?.length > 0) {
        allPages = this.filterOutExcludedPaths(allPages, albumIndex.excludePaths);
        this.logger.info("After exclude filter:", allPages.length, "pages");
      }

      const pages = this.filterByMaxPathSegments(allPages, albumIndex.contentPaths);
      this.logger.info("Filtered to", pages.length, "direct children from", allPages.length, "total pages");

      let allColumns: PageContentColumn[] = [];

      if (contentTypes.includes(IndexContentType.ALBUMS)) {
        const albumColumns = await this.extractAlbumColumns(pages);
        allColumns = allColumns.concat(albumColumns);
      }

      if (contentTypes.includes(IndexContentType.PAGES)) {
        const locationColumns = this.locationExtractionService.extractLocationsFromPages(pages);
        const enrichedColumns = await this.enrichIndexColumnsWithImages(locationColumns, pages, allPages);
        allColumns = allColumns.concat(enrichedColumns);
      }

      const deduplicatedColumns = this.deduplicateByHref(allColumns);
      const orderedColumns = this.sortColumns(deduplicatedColumns, albumIndex.sortConfig);

      const albumIndexPageContent: PageContent = this.pageContentFrom(pageContentRow, orderedColumns, rowIndex);
      this.logger.info("Generated index with", orderedColumns.length, "items from content types:", contentTypes, "(", allColumns.length, "before deduplication) based on:", pathRegex);
      return albumIndexPageContent;
    } else {
      this.logger.info("no pages to query as no contentPaths defined in:", albumIndex);
    }
  }

  private async extractAlbumColumns(pages: PageContent[], depth: number = 0): Promise<PageContentColumn[]> {
    const pageContentToRows: PageContentToRows[] = pages.map(pageContent => ({
      pageContent,
      rows: pageContent.rows.filter(row => this.actions.isCarouselOrAlbum(row))
    }));
    const albumNames: string[] = pageContentToRows.map(pageContentToRow =>
      pageContentToRow.rows.map(item => item.carousel.name)
    ).flat(2);
    const dataQueryOptions: DataQueryOptions = {criteria: {name: {$in: albumNames}}};
    const albumMetadata: ContentMetadata[] = await this.contentMetadataService.all(dataQueryOptions);

    const eventIds: string[] = pageContentToRows
      .flatMap(pageContentToRowsItem => pageContentToRowsItem.rows)
      .map(row => row.carousel?.eventId)
      .filter(eventId => !!eventId);

    const walkMap = new Map();
    if (eventIds.length > 0) {
      this.logger.info("Fetching", eventIds.length, "walks in a single batch query for album locations, eventIds:", eventIds);
      try {
        const queryParams = {
          ids: eventIds,
          inputSource: null,
          suppressEventLinking: true,
          dataQueryOptions: this.extendedGroupEventQueryService.dataQueryOptions({
            selectType: FilterCriteria.ALL_EVENTS,
            ascending: false
          })
        };
        this.logger.info("Query parameters:", queryParams);
        const walks = await this.walksAndEventsService.all(queryParams);
        this.logger.info("Received walks:", walks);
        walks.forEach(walk => {
          const walkId = walk?.id || walk?.groupEvent?.id;
          if (walkId) {
            walkMap.set(walkId, walk);
          }
          if (walk?.groupEvent?.id) {
            walkMap.set(walk.groupEvent.id, walk);
          }
          if (walk?.fields?.migratedFromId) {
            walkMap.set(walk.fields.migratedFromId, walk);
          }
        });
        this.logger.info("Fetched", walks.length, "walks, mapped to", walkMap.size, "keys (including migratedFromId)");
      } catch (error) {
        this.logger.error("Failed to batch fetch walks:", error);
      }
    }

    const columns: PageContentColumn[] = [];
    const pendingImageResolution: { columnIndex: number; pageContent: PageContent; indexRow: PageContentRow }[] = [];

    for (const pageContentToRowsItem of pageContentToRows) {
      for (const row of pageContentToRowsItem.rows) {
        const href = pageContentToRowsItem.pageContent.path;
        const title = this.stringUtils.asTitle(last(this.urlService.pathSegmentsForUrl(href)));
        const contentMetadata: ContentMetadata = albumMetadata.find(metadata => metadata.name === row.carousel.name);
        const coverImage = contentMetadata?.coverImage;
        const firstFile = first(contentMetadata?.files);
        const firstFileImage = firstFile?.image;
        const firstFileYoutubeId = firstFile?.youtubeId;
        const selectedImage = coverImage || firstFileImage;
        this.logger.info("Album:", row.carousel.name, "- coverImage:", coverImage, "firstFileImage:", firstFileImage, "firstFileYoutubeId:", firstFileYoutubeId, "selectedImage:", selectedImage);
        let imageSource = this.urlService.imageSourceFor(
          {image: selectedImage},
          contentMetadata
        );
        if ((!imageSource || imageSource === "null") && firstFileYoutubeId) {
          imageSource = this.youtubeService.thumbnailUrl(firstFileYoutubeId);
          this.logger.info("Using YouTube thumbnail for:", firstFileYoutubeId);
        }
        const childIndexRow = (pageContentToRowsItem.pageContent.rows || []).find(r =>
          r.type === PageContentType.ALBUM_INDEX && r.albumIndex?.contentPaths?.length > 0
        );
        if (!imageSource || imageSource === "null") {
          if (childIndexRow && this.withinPreviewImageSearchDepth(depth)) {
            this.logger.info("No metadata image found, deferring to batch resolution for:", href);
          } else {
            imageSource = this.findFirstImageInPage(pageContentToRowsItem.pageContent);
            this.logger.info("No metadata image found, using first page image:", imageSource);
          }
        }
        imageSource = this.optimiseIndexImageSource(imageSource);
        this.logger.info("Final imageSource:", imageSource);

        let location = null;
        if (row.carousel?.eventId) {
          const walk = walkMap.get(row.carousel.eventId);
          if (walk?.groupEvent) {
            location = walk.groupEvent.start_location || walk.groupEvent.meeting_location || walk.groupEvent.end_location;
            this.logger.info("Album", row.carousel.name, "linked to walk", row.carousel.eventId, "with location:", location);
          }
        }

        let contentText = row?.carousel?.subtitle || row?.carousel?.introductoryText || row?.carousel?.preAlbumText;
        if (!contentText) {
          const firstPageText = this.findFirstTextInPage(pageContentToRowsItem.pageContent);
          contentText = firstPageText || "No description available";
        }
        contentText = this.stringUtils.stripMarkdown(contentText);

        const focalPointTarget = row.carousel?.coverImageFocalPointTarget || FocalPointTarget.BOTH;
        const applyFocalPointToIndex = [FocalPointTarget.INDEX_PREVIEW, FocalPointTarget.BOTH].includes(focalPointTarget);

        const columnIndex = columns.length;
        columns.push({
          title: row.carousel?.title || title,
          contentText,
          href,
          imageSource,
          imageBorderRadius: row.carousel?.coverImageBorderRadius,
          imageFocalPoint: applyFocalPointToIndex ? row.carousel?.coverImageFocalPoint : null,
          accessLevel: AccessLevel.public,
          location,
          createdAt: row.carousel?.createdAt
        });
        if (childIndexRow && this.withinPreviewImageSearchDepth(depth) && (!imageSource || imageSource === "null")) {
          pendingImageResolution.push({columnIndex, pageContent: pageContentToRowsItem.pageContent, indexRow: childIndexRow});
        }
      }
    }

    if (pendingImageResolution.length > 0) {
      const allContentPathRegex = pendingImageResolution.flatMap(item =>
        item.indexRow.albumIndex.contentPaths.map(contentPath => ({
          path: ContentPathMatchConfigs[contentPath.stringMatch].mongoRegex(contentPath.contentPath)
        }))
      );
      const allChildPages = await this.pageContentService.all({criteria: {$or: allContentPathRegex}});
      const allCarouselNames = allChildPages
        .flatMap(page => (page.rows || []).filter(row => this.actions.isCarouselOrAlbum(row)))
        .map(row => row.carousel?.name)
        .filter(name => !!name);
      const uniqueNames = [...new Set(allCarouselNames)];
      let childMetadata: ContentMetadata[] = [];
      if (uniqueNames.length > 0) {
        childMetadata = await this.contentMetadataService.all({criteria: {name: {$in: uniqueNames}}});
      }
      this.logger.info("Batch fallback: fetched", allChildPages.length, "child pages and", childMetadata.length, "metadata for", pendingImageResolution.length, "items");
      pendingImageResolution.forEach(item => {
        const contentPaths = item.indexRow.albumIndex.contentPaths;
        const matchingPages = allChildPages.filter(page =>
          contentPaths.some(cp => {
            const regex = ContentPathMatchConfigs[cp.stringMatch].mongoRegex(cp.contentPath);
            return new RegExp(regex.$regex, regex.$options).test(page.path);
          })
        );
        const carouselRows = matchingPages.flatMap(page =>
          (page.rows || []).filter(row => this.actions.isCarouselOrAlbum(row))
        );
        let resolvedImage: string | undefined = null;
        for (const carouselRow of carouselRows) {
          const metadata = childMetadata.find(m => m.name === carouselRow.carousel?.name);
          if (metadata) {
            const selectedImage = metadata.coverImage || first(metadata.files)?.image;
            if (selectedImage) {
              const resolved = this.urlService.imageSourceFor({image: selectedImage}, metadata);
              if (resolved && resolved !== "null") {
                resolvedImage = this.optimiseIndexImageSource(resolved);
                break;
              }
            }
          }
        }
        if (!resolvedImage) {
          resolvedImage = this.optimiseIndexImageSource(this.findFirstImageInPage(item.pageContent));
        }
        if (resolvedImage) {
          columns[item.columnIndex] = {...columns[item.columnIndex], imageSource: resolvedImage};
        }
      });
    }

    return columns;
  }

  private findFirstImageInPage(pageContent: PageContent): string | undefined {
    let result: string | undefined = null;

    for (const row of pageContent.rows || []) {
      if (row.type === PageContentType.ALBUM_INDEX) {
        continue;
      }
      for (const column of row.columns || []) {
        if (column.imageSource) {
          result = column.imageSource;
          break;
        } else if (column.youtubeId) {
          result = this.youtubeService.thumbnailUrl(column.youtubeId);
          break;
        } else if (column.rows) {
          const nestedImage = this.findFirstImageInPage({rows: column.rows} as PageContent);
          if (nestedImage) {
            result = nestedImage;
            break;
          }
        }
      }
      if (result) {
        break;
      }
    }

    return result;
  }

  private async enrichIndexColumnsWithImages(
    columns: PageContentColumn[],
    pages: PageContent[],
    allPrefetchedPages: PageContent[],
    depth: number = 0
  ): Promise<PageContentColumn[]> {
    if (!this.withinPreviewImageSearchDepth(depth)) {
      return columns;
    }

    const childIndexes: { column: PageContentColumn; indexRow: PageContentRow }[] = columns
      .map(column => {
        const pageMatch = pages.find(page => page.path === column.href);
        if (!pageMatch) {
          return null;
        }
        const indexRow = (pageMatch.rows || []).find(row =>
          row.type === PageContentType.ALBUM_INDEX && row.albumIndex?.contentPaths?.length > 0
        );
        return indexRow ? {column, indexRow} : null;
      })
      .filter(item => !!item);

    if (childIndexes.length === 0) {
      return columns;
    }

    const allCarouselNames: string[] = allPrefetchedPages
      .flatMap(page => (page.rows || []).filter(row => this.actions.isCarouselOrAlbum(row)))
      .map(row => row.carousel?.name)
      .filter(name => !!name);

    const uniqueNames = [...new Set(allCarouselNames)];
    let allMetadata: ContentMetadata[] = [];
    if (uniqueNames.length > 0) {
      allMetadata = await this.contentMetadataService.all({criteria: {name: {$in: uniqueNames}}});
      this.logger.info("Batch enrichment: fetched", allMetadata.length, "metadata records for", uniqueNames.length, "album names from", allPrefetchedPages.length, "pre-fetched pages");
    }

    return columns.map(column => {
      const childIndex = childIndexes.find(item => item.column === column);
      if (!childIndex) {
        return column;
      }

      const contentPaths = childIndex.indexRow.albumIndex.contentPaths;
      const allChildPages = allPrefetchedPages.filter(page =>
        contentPaths.some(cp => {
          const regex = ContentPathMatchConfigs[cp.stringMatch].mongoRegex(cp.contentPath);
          return new RegExp(regex.$regex, regex.$options).test(page.path);
        })
      );

      const sortConfig = childIndex.indexRow.albumIndex.sortConfig;
      const childCarouselRows = allChildPages.flatMap(page =>
        (page.rows || []).filter(row => this.actions.isCarouselOrAlbum(row))
          .map(row => ({carousel: row.carousel, pagePath: page.path}))
      );

      let imageSource = column.imageSource;
      if (!imageSource) {
        for (const carouselRow of childCarouselRows) {
          const metadata = allMetadata.find(m => m.name === carouselRow.carousel?.name);
          if (metadata) {
            const selectedImage = metadata.coverImage || first(metadata.files)?.image;
            if (selectedImage) {
              const resolved = this.urlService.imageSourceFor({image: selectedImage}, metadata);
              if (resolved && resolved !== "null") {
                imageSource = this.optimiseIndexImageSource(resolved);
                break;
              }
            }
          }
        }
      }

      if (!imageSource) {
        for (const childPage of allChildPages) {
          const pageImage = this.findFirstImageInPage(childPage);
          if (pageImage && pageImage !== "null") {
            imageSource = this.optimiseIndexImageSource(pageImage);
            break;
          }
        }
      }

      const titles = childCarouselRows.map(cr =>
        cr.carousel?.title || this.stringUtils.asTitle(last(this.urlService.pathSegmentsForUrl(cr.pagePath)))
      );
      const sortedTitles = this.sortColumns(titles.map(t => ({title: t}) as PageContentColumn), sortConfig).map(c => c.title);
      const contentText = this.summarizeTitles(sortedTitles) || column.contentText;

      return {...column, imageSource, contentText};
    });
  }

  private summarizeTitles(titles: string[]): string | undefined {
    if (titles.length === 0) {
      return undefined;
    }
    const firstTitle = titles[0];
    const otherCount = titles.length - 1;
    if (otherCount === 0) {
      return firstTitle;
    } else {
      return `${firstTitle} and ${this.stringUtils.pluraliseWithCount(otherCount, "other")}`;
    }
  }

  private withinPreviewImageSearchDepth(depth: number): boolean {
    return depth < 2;
  }

  private filterByMaxPathSegments(pages: PageContent[], contentPaths: ContentPathMatch[]): PageContent[] {
    return pages.filter(page => {
      return contentPaths.some(contentPath => {
        if (!contentPath.maxPathSegments) {
          return true;
        }
        const basePath = contentPath.contentPath.replace(/\/$/, "");
        const pagePath = page.path || "";
        const regex = ContentPathMatchConfigs[contentPath.stringMatch].mongoRegex(basePath);
        if (!new RegExp(regex.$regex, regex.$options).test(pagePath)) {
          return false;
        }
        if (contentPath.stringMatch === StringMatch.CONTAINS) {
          const matchIndex = pagePath.toLowerCase().indexOf(basePath.toLowerCase());
          const remainingPath = pagePath.slice(matchIndex + basePath.length).replace(/^\//, "");
          const segmentCount = remainingPath ? remainingPath.split("/").length : 0;
          return segmentCount <= contentPath.maxPathSegments;
        } else {
          const remainingPath = pagePath.slice(basePath.length).replace(/^\//, "");
          const segmentCount = remainingPath ? remainingPath.split("/").length : 0;
          return segmentCount <= contentPath.maxPathSegments;
        }
      });
    });
  }

  private depthLimitedRegex(contentPath: ContentPathMatch): MongoRegex {
    const baseRegex = ContentPathMatchConfigs[contentPath.stringMatch].mongoRegex(contentPath.contentPath);
    if (!contentPath.maxPathSegments) {
      return baseRegex;
    }
    const basePath = contentPath.contentPath.replace(/\/$/, "");
    const depthSuffix = `(/[^/]+){1,${contentPath.maxPathSegments}}$`;
    if (contentPath.stringMatch === StringMatch.STARTS_WITH) {
      return {$regex: "^" + basePath + depthSuffix, $options: "i"};
    } else if (contentPath.stringMatch === StringMatch.EQUALS) {
      return baseRegex;
    } else {
      return baseRegex;
    }
  }

  private optimiseIndexImageSource(imageSource: string | undefined): string | undefined {
    if (!imageSource) {
      return imageSource;
    } else if (imageSource.includes("staticflickr.com")) {
      return imageSource.replace(/_(o|k|h|b|c|z|m|n|s|q|t)\.(jpg|jpeg|png)$/i, "_z.$2");
    } else {
      return imageSource;
    }
  }

  private findFirstTextInPage(pageContent: PageContent): string | undefined {
    let result: string | undefined = null;

    for (const row of pageContent.rows || []) {
      if (row.type === PageContentType.TEXT || row.type === PageContentType.ACTION_BUTTONS) {
        for (const column of row.columns || []) {
          if (column.contentText && column.contentText.trim()) {
            result = column.contentText.trim();
            break;
          } else if (column.rows) {
            const nestedText = this.findFirstTextInPage({rows: column.rows} as PageContent);
            if (nestedText) {
              result = nestedText;
              break;
            }
          }
        }
        if (result) {
          break;
        }
      } else if (row.type === PageContentType.ALBUM_INDEX && row.albumIndex?.indexMarkdown) {
        result = row.albumIndex.indexMarkdown.trim();
        break;
      }
    }

    return result;
  }

  private deduplicateByHref(columns: PageContentColumn[]): PageContentColumn[] {
    const hrefMap = new Map<string, PageContentColumn>();

    for (const column of columns) {
      const existingColumn = hrefMap.get(column.href);
      if (existingColumn) {
        if (this.hasMoreCompleteData(column, existingColumn)) {
          hrefMap.set(column.href, column);
          this.logger.info("Replacing duplicate entry for", column.href, "with more complete data");
        } else {
          this.logger.info("Keeping existing entry for", column.href);
        }
      } else {
        hrefMap.set(column.href, column);
      }
    }

    return Array.from(hrefMap.values());
  }

  private hasMoreCompleteData(column1: PageContentColumn, column2: PageContentColumn): boolean {
    const score1 = this.calculateDataCompletenessScore(column1);
    const score2 = this.calculateDataCompletenessScore(column2);
    return score1 > score2;
  }

  private sortColumns(columns: PageContentColumn[], sortConfig?: AlbumIndexSortConfig): PageContentColumn[] {
    const field = sortConfig?.field || AlbumIndexSortField.TITLE;
    const direction = sortConfig?.direction || SortDirection.ASC;
    const sortProperty = direction === SortDirection.DESC ? `-${field}` : field;
    return columns.slice().sort(sortBy(sortProperty));
  }

  private filterOutExcludedPaths(pages: PageContent[], excludePaths: ContentPathMatch[]): PageContent[] {
    return pages.filter(page => {
      return !excludePaths.some(excludePath => {
        const regex = ContentPathMatchConfigs[excludePath.stringMatch].mongoRegex(excludePath.contentPath);
        return new RegExp(regex.$regex, regex.$options).test(page.path);
      });
    });
  }

  private calculateDataCompletenessScore(column: PageContentColumn): number {
    let score = 0;
    if (column.imageSource && column.imageSource !== "null") {
      score += 3;
    }
    if (column.contentText && column.contentText !== "No description available") {
      score += 2;
    }
    if (column.title) {
      score += 1;
    }
    if (column.location) {
      score += 1;
    }
    return score;
  }

  public pageContentFrom(pageContentRow: PageContentRow, albumIndexes: PageContentColumn[], rowIndex: number): PageContent {
    const pageContent = {
      path: "generated-album-index-row-"+ rowIndex,
      rows: [{
        type: PageContentType.ACTION_BUTTONS,
        minColumns: pageContentRow.albumIndex?.minCols ?? pageContentRow.minColumns,
        maxColumns: pageContentRow.albumIndex?.maxCols ?? pageContentRow.maxColumns,
        showSwiper: pageContentRow.showSwiper,
        columns: albumIndexes
      }]
    };
    this.logger.info("pageContentFrom:", albumIndexes, "pageContent:", pageContent);
    return pageContent;
  }
}
