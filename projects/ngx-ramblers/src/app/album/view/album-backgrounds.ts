import { Component, inject, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import { ContentMetadata, ContentMetadataItem, LazyLoadingMetadata } from "../../models/content-metadata.model";
import { AlbumData, BackgroundsOverlay, ListStyleMappings } from "../../models/content-text.model";
import { Image } from "../../models/system.model";
import { SystemConfigService } from "../../services/system/system-config.service";
import { Subscription } from "rxjs";
import { NgClass } from "@angular/common";
import { MarkdownComponent } from "ngx-markdown";
import { HeightResizerComponent } from "../../modules/common/height-resizer/height-resizer";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { DisplayDayPipe } from "../../pipes/display-day.pipe";

@Component({
  selector: "app-album-backgrounds",
  imports: [NgClass, MarkdownComponent, HeightResizerComponent, DisplayDayPipe],
  template: `
    <div class="d-flex flex-column flex-md-row position-relative"
         [style.border-radius.px]="album?.gridViewOptions?.borderRadius || 0"
         [style.height.px]="album?.height || 500"
         style="overflow: hidden;">
      <div class="wrapper w-100 h-100 position-relative">
        @for (entry of visibleAlbumSlides; track entry.key) {
          <img [src]="albumImageSource(entry.slide)"
               class="position-absolute"
               [style.object-fit]="'cover'"
               [style.opacity]="entry.active ? 1 : 0"
               [style.transition]="'opacity 1s ease-in-out'"
               [style.right.px]="-(overlay?.photoOffsetPercent || 0)"
               style="top: 0; bottom: 0; width: 100%; height: 100%;"/>
        }
        @for (entry of visibleBackgroundSlides; track entry.key) {
          <img [src]="urlService.imageSource(entry.slide.awsFileName)"
               class="h-100 position-absolute"
               [style.opacity]="entry.active ? 1 : 0"
               [style.transition]="'opacity 1s ease-in-out'"
               style="top: 0; left: 0;"/>
        }
      </div>
      <!-- Layer 3: Text overlay -->
      <div class="row position-md-absolute w-100 h-100"
           [class.align-items-center]="!overlay?.paddingTop">
        <div class="col-md-6 col-xl-6"
             [ngClass]="overlay?.textColourClass || 'colour-cloudy'"
             [style.padding-top.px]="overlay?.paddingTop ?? 0"
             [style.padding-left.px]="overlay?.paddingLeft ?? 40">
          @if (album?.showTitle && album?.title) {
            <h1 class="font-weight-bold" [ngClass]="overlay?.titleColourClass || 'colour-cloudy'"
                [style.font-size.rem]="overlay?.titleScale || 3">{{ album.title }}</h1>
          }
          @if (album?.introductoryText) {
            <div class="intro-text body-text" [ngClass]="introductoryTextClasses()"
                 [style.font-size.rem]="overlay?.textScale || 1"
                 markdown [data]="album.introductoryText">
            </div>
          }
          @if ((overlay?.showEventLink || overlay?.showEventDate) && currentAlbumSlide) {
            <div class="body-text mt-3"
                 [style.font-size.rem]="overlay?.eventLinkScale || 1">
              @if (overlay?.showEventDate && currentAlbumSlide?.date) {
                <span>{{ currentAlbumSlide.date | displayDay }}</span>
              }
              @if (overlay?.showEventDate && currentAlbumSlide?.date && overlay?.showEventLink && currentAlbumSlide?.text) {
                <span> — </span>
              }
              @if (overlay?.showEventLink && currentAlbumSlide?.text) {
                @if (currentAlbumSlide?.eventId) {
                  <a class="text-decoration-underline"
                     [href]="urlService.linkUrl({area: currentAlbumSlide.dateSource, id: currentAlbumSlide.eventId})">{{ currentAlbumSlide.text }}</a>
                } @else {
                  <span>{{ currentAlbumSlide.text }}</span>
                }
              }
            </div>
          }
        </div>
      </div>
    </div>
    @if (preview) {
      <app-height-resizer [height]="album?.height || 500"
                          [minHeight]="200"
                          [maxHeight]="800"
                          (heightChange)="onHeightChange($event)"/>
    }
  `,
  styles: [`
    :host
      display: block

    :host ::ng-deep a
      color: inherit !important

    img
      pointer-events: none

    .intro-text ::ng-deep *
      font-size: inherit
  `]
})
export class AlbumBackgroundsComponent implements OnInit, OnChanges, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("AlbumBackgroundsComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  protected urlService = inject(UrlService);
  private subscriptions: Subscription[] = [];
  private intervalId: ReturnType<typeof setInterval>;

  private allAlbumSlides: ContentMetadataItem[] = [];
  private allBackgroundSlides: Image[] = [];
  public visibleAlbumSlides: { slide: ContentMetadataItem; active: boolean; key: string }[] = [];
  public visibleBackgroundSlides: { slide: Image; active: boolean; key: string }[] = [];
  private activeAlbumIndex = 0;
  private previousAlbumIndex = -1;
  private activeBackgroundIndex = 0;
  private previousBackgroundIndex = -1;
  private contentMetadata: ContentMetadata;
  private allBackgrounds: Image[] = [];
  public preview: boolean;

  @Input() album: AlbumData;
  @Input() lazyLoadingMetadata: LazyLoadingMetadata;

  @Input("preview") set previewValue(value: boolean) {
    this.preview = coerceBooleanProperty(value);
  }

  get overlay(): BackgroundsOverlay {
    return this.album?.backgroundsOverlay;
  }

  introductoryTextClasses(): string[] {
    const classes: string[] = [this.overlay?.textColourClass || "colour-cloudy"];
    const styles = this.album?.introductoryTextStyles;
    if (styles?.list) {
      classes.push(ListStyleMappings[styles.list]);
    }
    if (styles?.link) {
      classes.push(styles.link);
    }
    return classes;
  }

  get currentAlbumSlide(): ContentMetadataItem {
    if (this.activeAlbumIndex >= 0 && this.activeAlbumIndex < this.allAlbumSlides.length) {
      return this.allAlbumSlides[this.activeAlbumIndex];
    } else {
      return null;
    }
  }

  ngOnInit() {
    this.logger.info("ngOnInit:album:", this.album);
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      if (systemConfig?.backgrounds?.images?.length > 0) {
        this.allBackgrounds = systemConfig.backgrounds.images.filter(img => img.awsFileName);
        this.applyBackgroundFilter();
        this.logger.info("loaded", this.allBackgroundSlides.length, "background images from system config");
      }
    }));
    this.applyAlbumMetadata();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["lazyLoadingMetadata"]) {
      this.applyAlbumMetadata();
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  onHeightChange(height: number) {
    this.album.height = height;
  }

  private applyBackgroundFilter() {
    const names = this.album?.backgroundImageNames;
    if (names?.length > 0) {
      this.allBackgroundSlides = this.allBackgrounds.filter(img =>
        names.includes(img.originalFileName) || names.includes(img.awsFileName)
      );
    } else {
      this.allBackgroundSlides = this.allBackgrounds;
    }
    this.logger.info("applyBackgroundFilter:", this.allBackgroundSlides.length, "backgrounds selected");
    this.rebuildVisibleBackgrounds();
  }

  private applyAlbumMetadata() {
    const metadata = this.lazyLoadingMetadata?.contentMetadata;
    if (metadata?.files?.length > 0) {
      this.contentMetadata = metadata;
      this.allAlbumSlides = metadata.files;
      this.logger.info("applyAlbumMetadata:", this.allAlbumSlides.length, "album slides from", metadata.name);
      this.rebuildVisibleAlbum();
      this.startAutoAdvance();
    } else {
      this.logger.info("applyAlbumMetadata: no files in metadata");
    }
  }

  albumImageSource(item: ContentMetadataItem): string {
    return this.urlService.imageSourceFor(item, this.contentMetadata);
  }

  private rebuildVisibleAlbum() {
    const slides = this.allAlbumSlides;
    if (slides.length === 0) {
      this.visibleAlbumSlides = [];
      return;
    }
    const current = slides[this.activeAlbumIndex];
    const entries: { slide: ContentMetadataItem; active: boolean; key: string }[] = [
      {slide: current, active: true, key: `album-${this.activeAlbumIndex}`}
    ];
    if (this.previousAlbumIndex >= 0 && this.previousAlbumIndex !== this.activeAlbumIndex) {
      entries.push({slide: slides[this.previousAlbumIndex], active: false, key: `album-${this.previousAlbumIndex}`});
    }
    this.visibleAlbumSlides = entries;
  }

  private rebuildVisibleBackgrounds() {
    const slides = this.allBackgroundSlides;
    if (slides.length === 0) {
      this.visibleBackgroundSlides = [];
      return;
    }
    const current = slides[this.activeBackgroundIndex];
    const entries: { slide: Image; active: boolean; key: string }[] = [
      {slide: current, active: true, key: `bg-${this.activeBackgroundIndex}`}
    ];
    if (this.previousBackgroundIndex >= 0 && this.previousBackgroundIndex !== this.activeBackgroundIndex) {
      entries.push({slide: slides[this.previousBackgroundIndex], active: false, key: `bg-${this.previousBackgroundIndex}`});
    }
    this.visibleBackgroundSlides = entries;
  }

  private startAutoAdvance() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    const interval = this.album?.slideInterval || 5000;
    this.logger.info("startAutoAdvance: interval", interval, "ms, backgrounds:", this.allBackgroundSlides.length, "album:", this.allAlbumSlides.length);
    this.intervalId = setInterval(() => {
      if (this.allAlbumSlides.length > 1) {
        this.previousAlbumIndex = this.activeAlbumIndex;
        this.activeAlbumIndex = (this.activeAlbumIndex + 1) % this.allAlbumSlides.length;
        this.rebuildVisibleAlbum();
      }
      if (this.allBackgroundSlides.length > 1) {
        this.previousBackgroundIndex = this.activeBackgroundIndex;
        this.activeBackgroundIndex = (this.activeBackgroundIndex + 1) % this.allBackgroundSlides.length;
        this.rebuildVisibleBackgrounds();
      }
      this.logger.info("advanced: bg", this.activeBackgroundIndex, "album", this.activeAlbumIndex);
    }, interval);
  }
}
