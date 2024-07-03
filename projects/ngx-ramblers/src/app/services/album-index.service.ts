import { inject, Injectable } from "@angular/core";
import first from "lodash-es/first";
import last from "lodash-es/last";
import { NgxLoggerLevel } from "ngx-logger";
import {
  ContentPathMatchConfigs,
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
import { DataQueryOptions } from "../models/api-request.model";
import { PageService } from "./page.service";

@Injectable({
  providedIn: "root"
})
export class AlbumIndexService {

  public pageContentService: PageContentService = inject(PageContentService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public stringUtils: StringUtilsService = inject(StringUtilsService);
  public urlService: UrlService = inject(UrlService);
  public pageService: PageService = inject(PageService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  public logger = this.loggerFactory.createLogger("AlbumIndexService", NgxLoggerLevel.ERROR);
  public instance = this;

  public async albumIndexToPageContent(pageContentRow: PageContentRow, rowIndex: number): Promise<PageContent> {
    const albumIndex = pageContentRow.albumIndex;
    if (albumIndex?.contentPaths?.length > 0) {
      const pathRegex = albumIndex.contentPaths.map(contentPath => ({
        path: ContentPathMatchConfigs[contentPath.stringMatch].mongoRegex(contentPath.contentPath)
      }));

      const pages: PageContent[] = await this.pageContentService.all({criteria: {$or: pathRegex}});
      const pageContentToRows: PageContentToRows[] = pages.map(pageContent => ({
        pageContent,
        rows: pageContent.rows.filter(row => this.actions.isCarouselOrAlbum(row))
      }));
      const albumNames: string[] = pageContentToRows.map(pageContentToRow => pageContentToRow.rows.map(item => item.carousel.name)).flat(2);
      const dataQueryOptions: DataQueryOptions = {criteria: {name: {$in: albumNames}}};
      const albumMetadata: ContentMetadata[] = await this.contentMetadataService.all(dataQueryOptions);
      const albumIndexes: PageContentColumn[] = pageContentToRows.map(pageContentToRowsItem => pageContentToRowsItem?.rows.map(row => {
        const href = pageContentToRowsItem.pageContent.path;
        const title = this.stringUtils.asTitle(last(this.urlService.pathSegmentsForUrl(href)));
        const contentMetadata: ContentMetadata = albumMetadata.find(metadata => metadata.name === row.carousel.name);
        const imageSource = this.urlService.imageSourceFor({image: contentMetadata?.coverImage || first(contentMetadata.files).image}, contentMetadata);
        return ({
          title: row.carousel?.title || title,
          contentText: row?.carousel?.subtitle || row?.carousel?.introductoryText || row?.carousel?.preAlbumText || "no text found",
          href,
          imageSource,
          accessLevel: AccessLevel.public
        });
      })).flat(2);
      const albumIndexPageContent: PageContent = this.pageContentFrom(pageContentRow, albumIndexes, rowIndex);
      this.logger.info("pages:", pages, "pageContentToRows:", pageContentToRows, "albumNames:", albumNames, "albumMetadata:", albumMetadata, "albumIndexes:", albumIndexes, "albumIndexPageContent:", albumIndexPageContent, "based on:", pathRegex);
      return albumIndexPageContent;
    } else {
      this.logger.info("no pages to query as no contentPaths defined in:", albumIndex);
    }
  }

  public pageContentFrom(pageContentRow: PageContentRow, albumIndexes: PageContentColumn[], rowIndex1: number): PageContent {
    const pageContent = {
      path: "generated-album-index-row-"+ rowIndex1,
      rows: [{
        type: PageContentType.ACTION_BUTTONS,
        maxColumns: pageContentRow.maxColumns,
        showSwiper: pageContentRow.showSwiper,
        columns: albumIndexes
      }]
    };
    this.logger.info("pageContentFrom:", albumIndexes, "pageContent:", pageContent);
    return pageContent;
  }
}
