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
          <div [class]="cardColumnClasses()" [style]="itemStyle(image)">
            <div [class]="cardClasses()" [style.border-radius.px]="effectiveBorderRadius()">
              @if (hasYoutubeVideo(image)) {
                <div class="album-media card-img-top" [style.border-radius.px]="effectiveBorderRadius()">
                  <app-youtube-embed
                    [youtubeId]="image.youtubeId"
                    [title]="image.text || 'YouTube video'"/>
                </div>
              } @else {
                <div class="album-media card-img-top" [style.border-radius.px]="effectiveBorderRadius()">
                  <img
                    (load)="loaded($event, image)"
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

  aspectRatios = new Map<string, number>();

  loaded(event: Event, item: ContentMetadataItem) {
    const img = event.target as HTMLImageElement;
    if (img.naturalWidth && img.naturalHeight) {
      this.aspectRatios.set(item._id, img.naturalWidth / img.naturalHeight);
    }
    this.logger.info("loadedevent:", imageTracker(item), "index position:", this.lazyLoadingMetadata?.selectedSlides.indexOf(item));
  }

  itemStyle(image: ContentMetadataItem): string {
    if (!this.isJustifiedLayout()) {
      return "";
    }
    const ar = this.aspectRatios.get(image._id) || 1.5;
    const targetCols = this.effectiveColumns();
    const normalAr = 1.5;
    const gap = this.effectiveGap();
    const basePct = (ar / normalAr) * (100 / targetCols);
    return `flex-grow: ${ar}; flex-basis: calc(${basePct}% - ${gap}rem);`;
  }

  hasYoutubeVideo(item: ContentMetadataItem): boolean {
    return !!item?.youtubeId;
  }

  isMasonryLayout(): boolean {
    return this.gridViewOptions?.layoutMode === GridLayoutMode.MASONRY;
  }

  isJustifiedLayout(): boolean {
    return this.gridViewOptions?.layoutMode === GridLayoutMode.JUSTIFIED;
  }

  effectiveColumns(): number {
    if (this.runtimeColumns !== null) {
      return this.runtimeColumns;
    }
    return this.gridViewOptions?.maxColumns || 2;
  }

  containerClasses(): string {
    const mode = this.gridViewOptions?.layoutMode;
    if (mode === GridLayoutMode.JUSTIFIED) {
      const colsClass = `cols-${this.effectiveColumns()}`;
      const zeroGapClass = this.effectiveGap() === 0 ? "zero-gap" : "";
      return `album-grid-container justified-layout ${colsClass} ${zeroGapClass}`.trim();
    }
    if (mode === GridLayoutMode.MASONRY) {
      const colsClass = `cols-${this.effectiveColumns()}`;
      const zeroGapClass = this.effectiveGap() === 0 ? "zero-gap" : "";
      return `album-grid-container masonry-layout ${colsClass} ${zeroGapClass}`.trim();
    }
    return `album-grid-container fixed-aspect-layout row g-3`;
  }

  cardColumnClasses(): string {
    if (this.isMasonryLayout() || this.isJustifiedLayout()) {
      return "";
    }
    return cardClasses(this.effectiveColumns());
  }

  cardClasses(): string {
    if ((this.isMasonryLayout() || this.isJustifiedLayout()) && this.effectiveGap() === 0) {
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

  effectiveBorderRadius(): number {
    return this.gridViewOptions?.borderRadius ?? DEFAULT_GRID_OPTIONS.borderRadius;
  }

  containerStyles(): string {
    const gapRem = this.effectiveGap();
    const radius = this.effectiveBorderRadius();
    const radiusVar = `--grid-border-radius: ${radius}px;`;
    if (this.isMasonryLayout()) {
      return `column-gap: ${gapRem}rem; --masonry-gap: ${gapRem}rem; ${radiusVar}`;
    }
    if (this.isJustifiedLayout()) {
      return `gap: ${gapRem}rem; --justified-gap: ${gapRem}rem; ${radiusVar}`;
    }
    return `--bs-gutter-x: ${gapRem}rem; --bs-gutter-y: ${gapRem}rem; ${radiusVar}`;
  }

}
