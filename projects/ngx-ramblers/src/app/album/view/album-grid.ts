import { Component, inject, Input, OnInit } from "@angular/core";
import { Gallery } from "ng-gallery";
import { ContentMetadataItem, LazyLoadingMetadata } from "../../models/content-metadata.model";
import { PageService } from "../../services/page.service";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { UrlService } from "../../services/url.service";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import take from "lodash-es/take";
import { DateUtilsService } from "../../services/date-utils.service";
import { faImages, faSearch } from "@fortawesome/free-solid-svg-icons";
import { AlbumData, GridViewOptions } from "../../models/content-text.model";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { LazyLoadingMetadataService } from "../../services/lazy-loading-metadata.service";

@Component({
  selector: "app-album-grid",
  styleUrls: ["./album-grid.sass"],
  template: `
    <div class="card-columns">
      <div class="card"
           *ngFor="let image of lazyLoadingMetadata?.selectedSlides">
        <img class="card-img-top"
             [src]="urlService.imageSourceFor(image,lazyLoadingMetadata?.contentMetadata)"
             [alt]="image.text">
        <div *ngIf="gridViewOptions.showTitles" class="card-body">
          <h5 class="card-title">{{image.text}}</h5>
          <p *ngIf="gridViewOptions.showDates" class="card-text">
            <small class="text-muted">{{dateUtils.displayDate(image.date)}}
              <span class="ml-2 float-right">{{slideNumber(image)}}</span></small></p>
        </div>
      </div>
    </div>
    <app-badge-button class="float-right" noRightMargin
                      *ngIf="lazyLoadingMetadata?.availableSlides?.length>lazyLoadingMetadata?.selectedSlides?.length"
                      [tooltip]="'load more images'"
                      [icon]="faSearch"
                      (click)="viewMoreImages()" caption="load more images"/>
  `
})
export class AlbumGridComponent implements OnInit {
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AlbumGridComponent", NgxLoggerLevel.OFF);
  public preview: boolean;

  @Input("preview") set previewValue(value: boolean) {
    this.preview = coerceBooleanProperty(value);
    this.logger.info("preview:", this.preview);
  }

  @Input()
  public lazyLoadingMetadata: LazyLoadingMetadata;
  @Input()
  album: AlbumData;
  @Input()
  gridViewOptions: GridViewOptions;
  public lazyLoadingMetadataService: LazyLoadingMetadataService = inject(LazyLoadingMetadataService);
  public gallery: Gallery = inject(Gallery);
  public pageService: PageService = inject(PageService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public urlService: UrlService = inject(UrlService);
  protected readonly take = take;
  protected readonly faImages = faImages;
  protected readonly faSearch = faSearch;

  ngOnInit() {
  }

  viewMoreImages() {
    this.lazyLoadingMetadataService.add(this.lazyLoadingMetadata, 5);
  }

  slideNumber(image: ContentMetadataItem): string {
    return `${this.lazyLoadingMetadata?.selectedSlides.indexOf(image) + 1} of ${this.lazyLoadingMetadata?.selectedSlides.length}`;
  }
}
