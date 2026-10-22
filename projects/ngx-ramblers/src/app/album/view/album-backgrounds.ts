import { Component, HostListener, inject, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
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
import { ResizerComponent } from "../../modules/common/resizer/resizer";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { DisplayDayPipe } from "../../pipes/display-day.pipe";
import { PageService } from "../../services/page.service";
import { PageComponent } from "../../page/page.component";
import { DOCUMENT } from "@angular/common";

@Component({
  selector: "app-album-backgrounds",
  imports: [NgClass, MarkdownComponent, ResizerComponent, DisplayDayPipe],
  template: `
    <div class="hero-intro" [class.page-title-owned]="pageTitleOwned()">
      @if (album?.showTitle && album?.title) {
        <h1 class="hero-title font-weight-bold">{{ album.title }}</h1>
      }
      @if (album?.introductoryText) {
        <div class="intro-text body-text" [ngClass]="introductoryTextClasses(false)"
             markdown [data]="album.introductoryText">
        </div>
      }
    </div>
    <div class="hero"
         [style.border-radius.px]="album?.gridViewOptions?.borderRadius || 0"
         [style.--hero-height.px]="album?.height || 500">
      <div class="hero-photos">
        @for (entry of visibleAlbumSlides; track entry.key) {
          <img [src]="albumImageSource(entry.slide)"
               class="hero-photo"
               [class.is-active]="entry.active"
               [style.right.px]="-(overlay?.photoOffsetPercent || 0)"/>
        }
      </div>
      <div class="hero-backgrounds">
        @for (entry of visibleBackgroundSlides; track entry.key) {
          <img [src]="urlService.imageSource(entry.slide.awsFileName)"
               class="hero-background"
               [class.is-active]="entry.active"/>
        }
      </div>
      <div class="hero-overlay"
           [class.hero-overlay-centered]="!overlay?.paddingTop">
        <div class="hero-copy"
             [ngClass]="overlay?.textColourClass || 'colour-cloudy'"
             [style.padding-top.px]="overlay?.paddingTop ?? 0"
             [style.padding-left.px]="overlay?.paddingLeft ?? 40">
          @if (album?.showTitle && album?.title) {
            <h1 class="hero-title font-weight-bold" [ngClass]="overlay?.titleColourClass || 'colour-cloudy'"
                [style.--title-scale.rem]="overlay?.titleScale || 3">{{ album.title }}</h1>
          }
          @if (album?.introductoryText) {
            <div class="intro-text body-text" [ngClass]="introductoryTextClasses()"
                 [style.font-size.rem]="overlay?.textScale || 1"
                 markdown [data]="album.introductoryText">
            </div>
          }
        </div>
        @if ((overlay?.showEventLink || overlay?.showEventDate) && currentAlbumSlide) {
          <div class="hero-event body-text"
               [class.hero-event-paired]="overlay?.showEventDate && currentAlbumSlide?.date && overlay?.showEventLink && currentAlbumSlide?.text"
               [ngClass]="overlay?.textColourClass || 'colour-cloudy'"
               [style.font-size.rem]="overlay?.eventLinkScale || 1">
            @if (overlay?.showEventDate && currentAlbumSlide?.date) {
              <span class="hero-event-date">{{ currentAlbumSlide.date | displayDay }}</span>
            }
            @if (overlay?.showEventLink && currentAlbumSlide?.text) {
              @if (currentAlbumSlide?.eventId) {
                <a class="hero-event-title text-decoration-underline"
                   [href]="urlService.linkUrl({area: currentAlbumSlide.dateSource, id: currentAlbumSlide.eventId})">{{ currentAlbumSlide.text }}</a>
              } @else {
                <span class="hero-event-title">{{ currentAlbumSlide.text }}</span>
              }
            }
          </div>
        }
      </div>
    </div>
    @if (preview) {
      <app-resizer orientation="vertical" variant="tab" [size]="album?.height || 500"
                   [minSize]="200"
                   [maxSize]="800"
                   (sizeChange)="onHeightChange($event)"/>
    }
  `,
  styles: [`
    :host
      display: block

    .hero-photo,
    .hero-background
      pointer-events: none
      opacity: 0
      transition: opacity 1s ease-in-out

    .hero-photo.is-active,
    .hero-background.is-active
      opacity: 1

    :host ::ng-deep a
      color: inherit !important

    .intro-text ::ng-deep *
      font-size: inherit

    @media (min-width: 768px)
      .hero-intro
        display: none

      .hero
        position: relative
        overflow: hidden
        width: 100%
        height: var(--hero-height, 500px)

      .hero-photos
        position: absolute
        inset: 0
        z-index: 0

      .hero-backgrounds
        position: absolute
        inset: 0
        z-index: 1
        pointer-events: none

      .hero-photo
        position: absolute
        top: 0
        bottom: 0
        width: 100%
        height: 100%
        object-fit: cover

      .hero-background
        position: absolute
        top: 0
        left: 0
        height: 100%
        width: auto

      .hero-overlay
        position: absolute
        inset: 0
        z-index: 2
        display: flex
        flex-direction: column
        align-items: flex-start

      .hero-overlay-centered
        justify-content: center

      .hero-copy
        width: 50%
        max-width: 50%
        padding-right: 2.5rem
        box-sizing: border-box
        overflow-wrap: anywhere

      .hero-event
        width: 50%
        max-width: 50%
        padding: 0.75rem 2.5rem 0 40px
        box-sizing: border-box
        overflow-wrap: anywhere

      .hero-event-paired .hero-event-date::after
        content: " — "

      .hero-title
        font-size: clamp(1.5rem, 5vw, var(--title-scale, 3rem))
        margin-bottom: 0.5rem
        line-height: 1.15

    @media (max-width: 767.98px)
      .hero-intro
        margin: 0 0 0.85rem
        padding: 0 0.15rem

      .hero-intro.page-title-owned .hero-title
        display: none

      .hero-intro .intro-text
        font-size: 1rem
        color: inherit

      .hero-intro .intro-text ::ng-deep a
        color: inherit !important

      .hero-copy
        display: none

      .hero
        position: relative
        overflow: hidden
        width: 100%
        height: 180px !important

      .hero-photos,
      .hero-backgrounds
        position: absolute
        inset: 0

      .hero-photos
        z-index: 0

      .hero-backgrounds
        z-index: 1
        pointer-events: none

      .hero-photo,
      .hero-background
        position: absolute
        inset: 0
        width: 100%
        height: 100%
        object-fit: cover
        object-position: 48% center

      .hero-overlay
        position: absolute
        inset: 0
        z-index: 2
        display: flex
        flex-direction: column
        justify-content: center

      .hero-event
        width: 60%
        max-width: 60%
        padding: 0 0.4rem 0 0.5rem
        box-sizing: border-box
        overflow-wrap: break-word

      .hero-event-date
        display: block
        margin-bottom: 0.35rem
        line-height: 1.25
        white-space: nowrap

      .hero-event-title
        display: block
        max-width: 90%
        line-height: 1.3
        font-weight: 600
  `]
})
export class AlbumBackgroundsComponent implements OnInit, OnChanges, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("AlbumBackgroundsComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private pageService = inject(PageService);
  private pageShell = inject(PageComponent, {optional: true});
  private document = inject(DOCUMENT);
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

  pageTitleOwned(): boolean {
    return !!this.pageShell;
  }

  private publishMobilePageTitle(): void {
    const mobile = !!this.document.defaultView?.matchMedia("(max-width: 767.98px)").matches;
    if (this.pageTitleOwned() && mobile && this.album?.showTitle && this.album?.title) {
      this.pageService.setContentPageTitle(this.album.title);
    } else if (this.pageTitleOwned()) {
      this.pageService.setContentPageTitle(null);
    }
  }

  introductoryTextClasses(withOverlayColour = true): string[] {
    const classes: string[] = withOverlayColour ? [this.overlay?.textColourClass || "colour-cloudy"] : [];
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
    this.publishMobilePageTitle();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["lazyLoadingMetadata"]) {
      this.applyAlbumMetadata();
    }
    if (changes["album"] || changes["lazyLoadingMetadata"]) {
      this.publishMobilePageTitle();
    }
  }

  @HostListener("window:resize")
  onWindowResize() {
    this.publishMobilePageTitle();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.pageService.setContentPageTitle(null);
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
