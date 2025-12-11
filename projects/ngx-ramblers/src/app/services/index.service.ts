import { inject, Injectable } from "@angular/core";
import { first, last } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import {
  ContentPathMatchConfigs,
  IndexContentType,
  PageContent,
  PageContentColumn,
  PageContentRow,
  PageContentToRows,
  PageContentType
} from "../models/content-text.model";
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
      const pages: PageContent[] = await this.pageContentService.all({criteria: {$or: pathRegex}});
      this.logger.info("Found", pages.length, "pages matching criteria. Sample paths:", pages.slice(0, 5).map(p => p.path));

      let allColumns: PageContentColumn[] = [];

      if (contentTypes.includes(IndexContentType.ALBUMS)) {
        const albumColumns = await this.extractAlbumColumns(pages);
        allColumns = allColumns.concat(albumColumns);
      }

      if (contentTypes.includes(IndexContentType.PAGES)) {
        const locationColumns = this.locationExtractionService.extractLocationsFromPages(pages);
        allColumns = allColumns.concat(locationColumns);
      }

      const albumIndexPageContent: PageContent = this.pageContentFrom(pageContentRow, allColumns, rowIndex);
      this.logger.info("Generated index with", allColumns.length, "items from content types:", contentTypes, "based on:", pathRegex);
      return albumIndexPageContent;
    } else {
      this.logger.info("no pages to query as no contentPaths defined in:", albumIndex);
    }
  }

  private async extractAlbumColumns(pages: PageContent[]): Promise<PageContentColumn[]> {
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
        });
        this.logger.info("Fetched", walkMap.size, "walks successfully in single query");
      } catch (error) {
        this.logger.error("Failed to batch fetch walks:", error);
      }
    }

    const columns: PageContentColumn[] = [];

    for (const pageContentToRowsItem of pageContentToRows) {
      for (const row of pageContentToRowsItem.rows) {
        const href = pageContentToRowsItem.pageContent.path;
        const title = this.stringUtils.asTitle(last(this.urlService.pathSegmentsForUrl(href)));
        const contentMetadata: ContentMetadata = albumMetadata.find(metadata => metadata.name === row.carousel.name);
        const coverImage = contentMetadata?.coverImage;
        const firstFileImage = first(contentMetadata?.files)?.image;
        const selectedImage = coverImage || firstFileImage;
        this.logger.info("Album:", row.carousel.name, "- coverImage:", coverImage, "firstFileImage:", firstFileImage, "selectedImage:", selectedImage);
        let imageSource = this.urlService.imageSourceFor(
          {image: selectedImage},
          contentMetadata
        );
        if (!imageSource) {
          const firstPageImage = this.findFirstImageInPage(pageContentToRowsItem.pageContent);
          this.logger.info("No metadata image found, using first page image:", firstPageImage);
          imageSource = firstPageImage;
        }
        this.logger.info("Final imageSource:", imageSource);

        let location = null;
        if (row.carousel?.eventId) {
          const walk = walkMap.get(row.carousel.eventId);
          if (walk?.groupEvent) {
            location = walk.groupEvent.start_location || walk.groupEvent.meeting_location || walk.groupEvent.end_location;
            this.logger.info("Album", row.carousel.name, "linked to walk", row.carousel.eventId, "with location:", location);
          }
        }

        columns.push({
          title: row.carousel?.title || title,
          contentText: row?.carousel?.subtitle || row?.carousel?.introductoryText || row?.carousel?.preAlbumText || "no text found",
          href,
          imageSource,
          accessLevel: AccessLevel.public,
          location
        });
      }
    }

    return columns;
  }

  private findFirstImageInPage(pageContent: PageContent): string | undefined {
    for (const row of pageContent.rows || []) {
      for (const column of row.columns || []) {
        if (column.imageSource) {
          return column.imageSource;
        }
        if (column.rows) {
          const nestedImage = this.findFirstImageInPage({rows: column.rows} as PageContent);
          if (nestedImage) {
            return nestedImage;
          }
        }
      }
    }
    return null;
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
