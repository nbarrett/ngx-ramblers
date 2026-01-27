import { Component, inject, Input } from "@angular/core";
import { Gallery } from "ng-gallery";
import { ContentMetadataItem, LazyLoadingMetadata } from "../../models/content-metadata.model";
import { PageService } from "../../services/page.service";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { UrlService } from "../../services/url.service";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { take } from "es-toolkit/compat";
import { DateUtilsService } from "../../services/date-utils.service";
import { faImages, faSearch } from "@fortawesome/free-solid-svg-icons";
import { AlbumData, DEFAULT_GRID_OPTIONS, GridLayoutMode, GridViewOptions } from "../../models/content-text.model";
import { cardClasses } from "../../services/card-utils";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { LazyLoadingMetadataService } from "../../services/lazy-loading-metadata.service";
import { BadgeButtonComponent } from "../../modules/common/badge-button/badge-button";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { imageTracker } from "../../functions/trackers";
import { LazyLoadDirective } from "../../notifications/common/lazy-load.directive";
import { YoutubeEmbed } from "../../modules/common/youtube-embed/youtube-embed";

@Component({
    selector: "app-album-grid",
    styleUrls: ["./album-grid.sass"],
    template: `
      <div [class]="containerClasses()" [style]="containerStyles()">
        @for (image of lazyLoadingMetadata?.selectedSlides; track image._id) {
          <div [class]="cardColumnClasses()">
            <div [class]="cardClasses()">
              @if (hasYoutubeVideo(image)) {
                <div class="album-media card-img-top">
                  <app-youtube-embed
                    [youtubeId]="image.youtubeId"
                    [title]="image.text || 'YouTube video'"/>
                </div>
              } @else {
                <div class="album-media card-img-top">
                  <img
                    (load)="loaded(image)"
                    lazyLoad="{{ urlService.imageSourceFor(image, lazyLoadingMetadata?.contentMetadata) }}"
                    [alt]="image.text">
                </div>
              }
              @if (gridViewOptions.showTitles) {
                <div class="card-body">
                  <h5 class="card-title">{{ image.text }}</h5>
                  @if (gridViewOptions.showDates) {
                    <p class="card-text">
                      <small class="text-muted">{{ dateUtils.displayDate(image.date) }}
                        <span class="ms-2 float-end">{{ slideNumber(image) }}</span></small></p>
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>
      @if (lazyLoadingMetadata?.availableSlides?.length > lazyLoadingMetadata?.selectedSlides?.length) {
        <app-badge-button class="float-end mt-2" noRightMargin
                          [tooltip]="'load more images'"
                          [icon]="faSearch"
                          (click)="viewMoreImages()" caption="load more images"/>
      }
    `,
  imports: [BadgeButtonComponent, TooltipDirective, LazyLoadDirective, YoutubeEmbed]
})
export class AlbumGridComponent {

  @Input("preview") set previewValue(value: boolean) {
    this.preview = coerceBooleanProperty(value);
    this.logger.info("preview:", this.preview);
  }

  loggerFactory: LoggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AlbumGridComponent", NgxLoggerLevel.ERROR);
  public preview: boolean;

  @Input()
  public lazyLoadingMetadata: LazyLoadingMetadata;
  @Input()
  album: AlbumData;
  @Input()
  gridViewOptions: GridViewOptions;
  @Input()
  runtimeColumns: number | null = null;
  @Input()
  runtimeGap: number | null = null;
  public lazyLoadingMetadataService: LazyLoadingMetadataService = inject(LazyLoadingMetadataService);
  public gallery: Gallery = inject(Gallery);
  public pageService: PageService = inject(PageService);
  public dateUtils: DateUtilsService = inject(DateUtilsService);
  public contentMetadataService: ContentMetadataService = inject(ContentMetadataService);
  public urlService: UrlService = inject(UrlService);
  protected readonly take = take;
  protected readonly faImages = faImages;
  protected readonly faSearch = faSearch;

  viewMoreImages() {
    this.lazyLoadingMetadataService.add(this.lazyLoadingMetadata, 5);
  }

  slideNumber(image: ContentMetadataItem): string {
    return `${this.lazyLoadingMetadata?.selectedSlides.indexOf(image) + 1} of ${this.lazyLoadingMetadata?.selectedSlides.length}`;
  }

  loaded(item: ContentMetadataItem) {
    this.logger.info("loadedevent:", imageTracker(item), "index position:", this.lazyLoadingMetadata?.selectedSlides.indexOf(item));
  }

  hasYoutubeVideo(item: ContentMetadataItem): boolean {
    return !!item?.youtubeId;
  }

  isMasonryLayout(): boolean {
    return this.gridViewOptions?.layoutMode === GridLayoutMode.MASONRY;
  }

  effectiveColumns(): number {
    if (this.runtimeColumns !== null) {
      return this.runtimeColumns;
    }
    return this.gridViewOptions?.maxColumns || 2;
  }

  containerClasses(): string {
    const layoutClass = this.isMasonryLayout() ? "masonry-layout" : "fixed-aspect-layout";
    const colsClass = `cols-${this.effectiveColumns()}`;
    if (this.isMasonryLayout()) {
      const zeroGapClass = this.effectiveGap() === 0 ? "zero-gap" : "";
      return `album-grid-container ${layoutClass} ${colsClass} ${zeroGapClass}`.trim();
    }
    return `album-grid-container ${layoutClass} row g-3`;
  }

  cardColumnClasses(): string {
    if (this.isMasonryLayout()) {
      return "";
    }
    return cardClasses(this.effectiveColumns());
  }

  cardClasses(): string {
    if (this.isMasonryLayout() && this.effectiveGap() === 0) {
      return "card";
    }
    return "card h-100";
  }

  effectiveGap(): number {
    if (this.runtimeGap !== null) {
      return this.runtimeGap;
    }
    return this.gridViewOptions?.gap ?? DEFAULT_GRID_OPTIONS.gap;
  }

  containerStyles(): string {
    const gapRem = this.effectiveGap();
    if (this.isMasonryLayout()) {
      return `column-gap: ${gapRem}rem; --masonry-gap: ${gapRem}rem;`;
    }
    return `--bs-gutter-x: ${gapRem}rem; --bs-gutter-y: ${gapRem}rem;`;
  }

}
