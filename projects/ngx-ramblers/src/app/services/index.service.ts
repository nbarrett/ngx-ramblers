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
  IndexEntryOverride,
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
        path: this.depthLimitedRegex(contentPath)
      }));

      this.logger.info("Query criteria:", {$or: pathRegex});

      let pages = await this.pageContentService.all({criteria: {$or: pathRegex}});
      this.logger.info("Found", pages.length, "pages matching criteria. Sample paths:", pages.slice(0, 5).map(p => p.path));

      if (albumIndex.excludePaths?.length > 0) {
        pages = this.filterOutExcludedPaths(pages, albumIndex.excludePaths);
        this.logger.info("After exclude filter:", pages.length, "pages");
      }

      let allColumns: PageContentColumn[] = [];

      if (contentTypes.includes(IndexContentType.ALBUMS)) {
        const albumColumns = await this.extractAlbumColumns(pages, 0, albumIndex.entryOverrides);
        allColumns = allColumns.concat(albumColumns);
      }

      if (contentTypes.includes(IndexContentType.PAGES)) {
        const locationColumns = this.locationExtractionService.extractLocationsFromPages(pages);
        const enrichedColumns = await this.enrichIndexColumnsWithImages(locationColumns, pages, 0, albumIndex.entryOverrides);
        allColumns = allColumns.concat(enrichedColumns);
      }

      const deduplicatedColumns = this.deduplicateByHref(allColumns);
      const columnsWithAlbumNames = this.ensureAlbumNames(deduplicatedColumns, pages);
      const orderedColumns = this.sortColumns(columnsWithAlbumNames, albumIndex.sortConfig);

      const albumIndexPageContent: PageContent = this.pageContentFrom(pageContentRow, orderedColumns, rowIndex);
      this.logger.info("Generated index with", orderedColumns.length, "items from content types:", contentTypes, "(", allColumns.length, "before deduplication) based on:", pathRegex);
      return albumIndexPageContent;
    } else {
      this.logger.info("no pages to query as no contentPaths defined in:", albumIndex);
    }
  }

  private async extractAlbumColumns(pages: PageContent[], depth: number = 0, entryOverrides?: Record<string, IndexEntryOverride>): Promise<PageContentColumn[]> {
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

        const override = entryOverrides?.[href];
        if (override?.coverImage && contentMetadata) {
          const overriddenSource = this.urlService.imageSourceFor({image: override.coverImage}, contentMetadata);
          if (overriddenSource && overriddenSource !== "null") {
            imageSource = this.optimiseIndexImageSource(overriddenSource);
          }
        }

        const focalPointTarget = row.carousel?.coverImageFocalPointTarget || FocalPointTarget.BOTH;
        const applyFocalPointToIndex = [FocalPointTarget.INDEX_PREVIEW, FocalPointTarget.BOTH].includes(focalPointTarget);
        const effectiveFocalPoint = override?.coverImageFocalPoint !== undefined
          ? override.coverImageFocalPoint
          : (applyFocalPointToIndex ? row.carousel?.coverImageFocalPoint : null);

        const columnIndex = columns.length;
        columns.push({
          title: row.carousel?.title || title,
          contentText,
          href,
          imageSource,
          imageBorderRadius: row.carousel?.coverImageBorderRadius,
          imageFocalPoint: effectiveFocalPoint,
          accessLevel: AccessLevel.public,
          location,
          createdAt: row.carousel?.createdAt,
          albumName: row.carousel?.name
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
    depth: number = 0,
    entryOverrides?: Record<string, IndexEntryOverride>
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

    const allContentPathRegex = childIndexes.flatMap(item =>
      item.indexRow.albumIndex.contentPaths.map(contentPath => ({
        path: ContentPathMatchConfigs[contentPath.stringMatch].mongoRegex(contentPath.contentPath)
      }))
    );

    const allMatchedPages = await this.pageContentService.all({criteria: {$or: allContentPathRegex}});
    this.logger.info("Batch enrichment: fetched", allMatchedPages.length, "pages for", childIndexes.length, "child indexes");

    const allCarouselNames: string[] = allMatchedPages
      .flatMap(page => (page.rows || []).filter(row => this.actions.isCarouselOrAlbum(row)))
      .map(row => row.carousel?.name)
      .filter(name => !!name);

    const uniqueNames = [...new Set(allCarouselNames)];
    let allMetadata: ContentMetadata[] = [];
    if (uniqueNames.length > 0) {
      allMetadata = await this.contentMetadataService.all({criteria: {name: {$in: uniqueNames}}});
      this.logger.info("Batch enrichment: fetched", allMetadata.length, "metadata records for", uniqueNames.length, "album names");
    }

    return columns.map(column => {
      const childIndex = childIndexes.find(item => item.column === column);
      if (!childIndex) {
        return column;
      }

      const contentPaths = childIndex.indexRow.albumIndex.contentPaths;
      const allChildPages = allMatchedPages.filter(page =>
        contentPaths.some(cp => {
          const regex = ContentPathMatchConfigs[cp.stringMatch].mongoRegex(cp.contentPath);
          return new RegExp(regex.$regex, regex.$options).test(page.path);
        })
      );

      const sortConfig = childIndex.indexRow.albumIndex.sortConfig;
      const sortedChildPages = this.sortPagesBySortConfig(allChildPages, sortConfig);
      const childCarouselRows = sortedChildPages.flatMap(page =>
        (page.rows || []).filter(row => this.actions.isCarouselOrAlbum(row))
          .map(row => ({carousel: row.carousel, pagePath: page.path}))
      );

      let imageSource = column.imageSource;
      let imageFocalPoint = column.imageFocalPoint;
      let albumName = column.albumName;
      if (!imageSource) {
        for (const carouselRow of childCarouselRows) {
          const metadata = allMetadata.find(m => m.name === carouselRow.carousel?.name);
          if (metadata) {
            const selectedImage = metadata.coverImage || first(metadata.files)?.image;
            if (selectedImage) {
              const resolved = this.urlService.imageSourceFor({image: selectedImage}, metadata);
              if (resolved && resolved !== "null") {
                imageSource = this.optimiseIndexImageSource(resolved);
                const focalPointTarget = carouselRow.carousel?.coverImageFocalPointTarget || FocalPointTarget.BOTH;
                const applyToIndex = [FocalPointTarget.INDEX_PREVIEW, FocalPointTarget.BOTH].includes(focalPointTarget);
                if (applyToIndex && carouselRow.carousel?.coverImageFocalPoint) {
                  imageFocalPoint = carouselRow.carousel.coverImageFocalPoint;
                }
                albumName = albumName || carouselRow.carousel?.name;
                break;
              }
            }
          }
        }
      }

      if (!imageSource) {
        for (const childPage of sortedChildPages) {
          const pageImage = this.findFirstImageInPage(childPage);
          if (pageImage && pageImage !== "null") {
            imageSource = this.optimiseIndexImageSource(pageImage);
            break;
          }
        }
      }

      const override = entryOverrides?.[column.href];
      if (override?.coverImage && albumName) {
        const overrideMetadata = allMetadata.find(m => m.name === albumName);
        if (overrideMetadata) {
          const overriddenSource = this.urlService.imageSourceFor({image: override.coverImage}, overrideMetadata);
          if (overriddenSource && overriddenSource !== "null") {
            imageSource = this.optimiseIndexImageSource(overriddenSource);
          }
        }
      }
      if (override?.coverImageFocalPoint !== undefined) {
        imageFocalPoint = override.coverImageFocalPoint;
      }

      const titles = childCarouselRows.map(cr =>
        cr.carousel?.title || this.stringUtils.asTitle(last(this.urlService.pathSegmentsForUrl(cr.pagePath)))
      );
      const sortedTitles = this.sortColumns(titles.map(t => ({title: t}) as PageContentColumn), sortConfig).map(c => c.title);
      const contentText = this.summarizeTitles(sortedTitles) || column.contentText;

      return {...column, imageSource, imageFocalPoint, albumName, contentText};
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
        const albumName = existingColumn.albumName || column.albumName;
        if (this.hasMoreCompleteData(column, existingColumn)) {
          hrefMap.set(column.href, {...column, albumName: column.albumName || albumName});
          this.logger.info("Replacing duplicate entry for", column.href, "with more complete data");
        } else {
          hrefMap.set(column.href, {...existingColumn, albumName: existingColumn.albumName || albumName});
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

  private sortPagesBySortConfig(pages: PageContent[], sortConfig?: AlbumIndexSortConfig): PageContent[] {
    const pageByPath = new Map(pages.map(p => [p.path, p]));
    const sortable = pages.map(page => {
      const carouselRow = (page.rows || []).find(r => this.actions.isCarouselOrAlbum(r));
      return {
        title: carouselRow?.carousel?.title || this.stringUtils.asTitle(last(this.urlService.pathSegmentsForUrl(page.path))),
        href: page.path,
        createdAt: carouselRow?.carousel?.createdAt
      } as PageContentColumn;
    });
    return this.sortColumns(sortable, sortConfig).map(c => pageByPath.get(c.href)).filter(p => !!p);
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

  private ensureAlbumNames(columns: PageContentColumn[], pages: PageContent[]): PageContentColumn[] {
    return columns.map(column => {
      if (column.albumName) {
        return column;
      }
      const page = pages.find(p => p.path === column.href);
      if (page) {
        const rowWithCarousel = (page.rows || []).find(row => !!row.carousel?.name);
        if (rowWithCarousel?.carousel?.name) {
          this.logger.info("ensureAlbumNames: set albumName", rowWithCarousel.carousel.name, "for", column.href, "from row type:", rowWithCarousel.type);
          return {...column, albumName: rowWithCarousel.carousel.name};
        }
        this.logger.info("ensureAlbumNames: no carousel name found for", column.href, "row types:", (page.rows || []).map(r => r.type));
      }
      return column;
    });
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
