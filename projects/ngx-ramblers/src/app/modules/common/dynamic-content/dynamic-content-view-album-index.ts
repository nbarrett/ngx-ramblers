import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContent, PageContentColumn, PageContentRow, PageContentType } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { ContentMetadata } from "../../../models/content-metadata.model";

@Component({
  selector: "app-dynamic-content-view-album-index",
  template: `
    <ng-container *ngIf="actions.isCarousel(row)">
      <app-action-buttons *ngIf="actions.isAlbumIndex(row)"
                          [pageContent]="pageContent"
                          [rowIndex]="index"/>
    </ng-container>`,
})
export class DynamicContentViewAlbumIndexComponent implements OnInit {

  @Input()
  public row: PageContentRow;

  @Input()
  public index: number;

  public pageContent: PageContent;
  private logger: Logger;

  constructor(
    public actions: PageContentActionsService,
    public contentMetadataService: ContentMetadataService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("DynamicContentViewAlbumIndexComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    const albumIndex = this.row.albumIndex;
    this.pageContent = {
      path: null,
      rows: [this.actions.defaultRowFor(PageContentType.ACTION_BUTTONS)]
    };

    const page = {
      action: "query",
      response: {
        id: "63ba9c3523aa5c0016a62f44",
        path: "walks/weekends-away",
        rows: [
          {
            maxColumns: 1,
            showSwiper: false,
            type: "text",
            columns: [
              {
                columns: 12,
                accessLevel: "public",
                contentTextId: "63ba9c7323aa5c0016a62f45"
              }
            ]
          },
          {
            maxColumns: 2,
            showSwiper: false,
            type: "action-buttons",
            columns: [
              {
                columns: 12,
                accessLevel: "public",
                title: "April 2023 - Swanage ",
                icon: null,
                imageSource: "site-content/49a09875-7343-412e-8090-7c8269e7f471.jpg",
                href: "walks/weekends-away/swanage-april-2023",
                contentTextId: "63ba9dcb23aa5c0016a62f46"
              },
              {
                href: "walks/weekends-away/peak-district-2022",
                imageSource: "site-content/5b2bbea2-3f51-4891-8b0c-83b0a1645b67.jpeg",
                title: "May 2022 - The Peak District",
                accessLevel: "public",
                icon: null,
                contentTextId: "63ba9eea23aa5c0016a62f47"
              },
              {
                href: "walks/weekends-away/eastbourne-2020",
                imageSource: "site-content/554eb758-a243-4d81-932f-69befc113a52.jpeg",
                title: "October 2020 - Eastbourne ",
                accessLevel: "public",
                icon: null,
                contentTextId: "63baa26323aa5c0016a62f4c"
              },
              {
                href: "walks/weekends-away/cotswolds-october-2019",
                imageSource: "site-content/22dee1ef-11fa-4cfb-91a5-c042706887c4.jpeg",
                title: "October 2019 - Cotswolds",
                accessLevel: "public",
                icon: null,
                contentTextId: "63baa4ab23aa5c0016a62f4d"
              }
            ]
          }
        ]
      }
    };
    this.contentMetadataService.all({criteria: {name: {$in: albumIndex.albums}}})
      .then((results: ContentMetadata[]) => {
        this.pageContent.rows[0].columns = results.map(contentMetadata => {
          const column: PageContentColumn = {columns: albumIndex.columns,};
          return column;
        });
      });
  }

}
