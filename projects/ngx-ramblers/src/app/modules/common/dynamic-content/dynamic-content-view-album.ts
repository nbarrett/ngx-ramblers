import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { UrlService } from "../../../services/url.service";
import { ContentMetadataService } from "../../../services/content-metadata.service";
import { LazyLoadingMetadata } from "../../../models/content-metadata.model";
import { MarkdownComponent } from "ngx-markdown";
import { CardImageComponent } from "../card/image/card-image";
import { AlbumComponent } from "../../../album/view/album";
import { DisplayDayPipe } from "../../../pipes/display-day.pipe";

@Component({
    selector: "app-dynamic-content-view-album",
    template: `
    @if (actions.isAlbum(row)) {
      <div [class]="actions.rowClasses(row)">
        @if (row.carousel.showTitle) {
          <div class="col-sm-12">
            <h1>{{ row.carousel.title }}</h1>
            <h3>{{ row.carousel.eventDate | displayDay }}
              @if (row.carousel.subtitle) {
                @if (row.carousel.eventId) {
                  <span> - <a delay="500"
                              [href]="urlService.linkUrl({area: row.carousel.eventType, id: row.carousel.eventId })">
                  {{ row.carousel.subtitle }}</a></span>
                }
                @if (!row.carousel.eventId) {
                  <span>{{ row.carousel.subtitle }}</span>
                }
              }
            </h3>
          </div>
        }
        @if (row.carousel?.showCoverImageAndText) {
          <div class="col-sm-12">
            <div markdown [data]="row.carousel?.introductoryText"></div>
            @if (lazyLoadingMetadata?.contentMetadata?.coverImage) {
              <app-card-image
                [height]="row.carousel?.coverImageHeight"
                [borderRadius]="row.carousel?.coverImageBorderRadius"
                          [imageSource]="urlService.imageSourceFor({image:lazyLoadingMetadata.contentMetadata?.coverImage},
                                  lazyLoadingMetadata.contentMetadata)">
              </app-card-image>
            }
          </div>
        }
        @if (row.carousel?.showPreAlbumText) {
          <div markdown [data]="row.carousel.preAlbumText" class="col-sm-12 mt-2"></div>
        }
        <div class="col-sm-12">
          <app-album (lazyLoadingMetadataChange)="lazyLoadingMetadata=$event" [album]="row.carousel" [index]="index"/>
        </div>
      </div>
    }`,
    imports: [MarkdownComponent, CardImageComponent, AlbumComponent, DisplayDayPipe]
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
