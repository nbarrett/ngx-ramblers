import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { UrlService } from "../../../services/url.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { LazyLoadingMetadata } from "../../../models/content-metadata.model";

@Component({
  selector: "app-dynamic-content-view-album",
  template: `
    <ng-container *ngIf="actions.isAlbum(row)">
      <div [class]="actions.rowClasses(row)">
        <div *ngIf="row.carousel.showTitle" class="col-sm-12">
          <h1>{{ row.carousel.title }}</h1>
          <h3>{{ row.carousel.eventDate | displayDay }}
            <ng-container *ngIf="row.carousel.subtitle">
                          <span *ngIf="row.carousel.eventId"> - <a delay="500"
                                                                   [href]="urlService.linkUrl({area: row.carousel.eventType, id: row.carousel.eventId })">
                              {{ row.carousel.subtitle }}</a></span>
              <span *ngIf="!row.carousel.eventId">{{ row.carousel.subtitle }}</span>
            </ng-container>
          </h3>
        </div>
        <div *ngIf="row.carousel?.showCoverImageAndText" class="col-sm-12">
          <div markdown [data]="row.carousel?.introductoryText"></div>
          <app-card-image *ngIf="lazyLoadingMetadata?.contentMetadata?.coverImage"
                          [height]="row.carousel?.coverImageHeight"
                          [borderRadius]="row.carousel?.coverImageBorderRadius"
                          [imageSource]="urlService.imageSourceFor({image:lazyLoadingMetadata.contentMetadata?.coverImage},
                                  lazyLoadingMetadata.contentMetadata)">
          </app-card-image>
        </div>
        <div *ngIf="row.carousel?.showPreAlbumText" markdown [data]="row.carousel.preAlbumText" class="col-sm-12 mt-2"></div>
        <div class="col-sm-12">
          <app-album (lazyLoadingMetadataChange)="lazyLoadingMetadata=$event" [album]="row.carousel" [index]="index"/>
        </div>
      </div>
    </ng-container>`,
})
export class DynamicContentViewAlbumComponent implements OnInit {
  public lazyLoadingMetadata: LazyLoadingMetadata;
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public actions: PageContentActionsService = inject(PageContentActionsService);
  public urlService: UrlService = inject(UrlService);
  private loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger: Logger = this.loggerFactory.createLogger("DynamicContentViewAlbumComponent", NgxLoggerLevel.OFF);

  @Input()
  public row: PageContentRow;
  @Input()
  public index: number;

  ngOnInit() {
    this.logger.info("ngOnInit for", this.row.carousel?.name);
  }

}
