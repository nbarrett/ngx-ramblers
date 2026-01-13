import { Component, HostListener, inject, Input, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import {
  ALL_PHOTOS,
  ContentMetadataItem,
  DuplicateImages,
  ImageTag,
  LazyLoadingMetadata,
  SlideInitialisation
} from "../../models/content-metadata.model";
import { groupEventTypeFor } from "../../models/committee.model";
import { PageService } from "../../services/page.service";
import { MemberLoginService } from "../../services/member/member-login.service";
import { ContentMetadataService } from "../../services/content-metadata.service";
import { faPencil } from "@fortawesome/free-solid-svg-icons";
import { Subscription } from "rxjs";
import { AlbumData } from "../../models/content-text.model";
import { LazyLoadingMetadataService } from "../../services/lazy-loading-metadata.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ImageDuplicatesService } from "../../services/image-duplicates-service";
import { RootFolder } from "../../models/system.model";
import { FALLBACK_MEDIA } from "../../models/walk.model";
import { CarouselStoryNavigatorComponent } from "./carousel-story-navigator/carousel-story-navigator.component";
import { CarouselComponent as CarouselComponent_1, SlideComponent } from "ngx-bootstrap/carousel";
import { NgStyle } from "@angular/common";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";
import { YoutubeEmbed } from "../../modules/common/youtube-embed/youtube-embed";

@Component({
  selector: "app-carousel",
  template: `
    <div class="carousel-wrapper">
      <div class="slider-container">
        <div class="sc-inner">
          @if (preview ? false : !hideStoryNavigator && album.showStoryNavigator) {
            <app-carousel-story-navigator
              [imageTags]="lazyLoadingMetadata?.contentMetadata?.imageTags"
              [index]="index"
              (tagChanged)="tagChanged($event)"/>
          }
          @if (lazyLoadingMetadata?.selectedSlides.length > 0) {
            <carousel #carouselRef (mouseenter)="mouseEnter($event)" (mouseleave)="mouseLeave($event)" [isAnimated]="true"
                      [noPause]="noPause" [pauseOnFocus]="noPause"
                      [interval]="album.slideInterval || 5000"
                      [showIndicators]="album.showIndicators && showIndicators"
                      [(activeSlide)]="lazyLoadingMetadata.activeSlideIndex"
                      (activeSlideChange)="activeSlideChange(false, $event)">
              @for (slide of lazyLoadingMetadata?.selectedSlides; track imageSourceFor(slide)) {
                <slide>
                  @if (slide) {
                    @if (hasYoutubeVideo(slide)) {
                      <div class="youtube-embed-container" [ngStyle]="{'height.px': album.height || DEFAULT_HEIGHT}">
                        <app-youtube-embed
                          [youtubeId]="slide.youtubeId"
                          [title]="slide.text || 'YouTube video'"
                          (playbackStateChange)="onVideoPlaybackChange($event)"/>
                      </div>
                    } @else {
                      <img loading="lazy" [src]="imageSourceFor(slide)"
                           [alt]="slide.text" [ngStyle]="{
                   'height.px': album.height,
                     'min-width': '100%',
                      'max-width': '100%',
                      'object-fit': 'cover',
                      'object-position': 'center'}"
                           (load)="onImageLoad($event)"
                           (error)="onImageError($event)">
                    }
                  }
                  <div class="carousel-caption">
                    @if (album.showImageTitles) {
                      <h4>{{ slide.text || album.subtitle }}</h4>
                    }
                    @if (album.showImageDates && (slide.eventId || album.eventId)) {
                      <div>
                        <a [delay]="500" class="badge event-date"
                           [tooltip]="eventTooltip(slide.eventId? slide.dateSource : album.eventType)"
                           [placement]="!showIndicators?'bottom':'right'"
                           [href]="urlService.eventUrl(slide.eventId? slide : {dateSource:album.eventType, eventId: album.eventId})">
                          on {{ slide.date | displayDate }}</a>
                      </div>
                    }
                  </div>
                </slide>
              }
            </carousel>
          } @else {
            <div class="fallback-carousel" [ngStyle]="{'height.px': album?.height || DEFAULT_HEIGHT}">
              <img [src]="FALLBACK_MEDIA.url"
                   [alt]="FALLBACK_MEDIA.alt"
                   [ngStyle]="{
                     'height.px': album?.height || DEFAULT_HEIGHT,
                     'min-width': '100%',
                     'max-width': '100%',
                     'object-fit': 'cover',
                     'object-position': 'center'}">
              <div class="carousel-caption">
                <h4>{{ album?.subtitle || 'Loading...' }}</h4>
              </div>
            </div>
          }
        </div>
      </div>
    </div>`,
  styleUrls: ["./carousel.sass"],
  imports: [CarouselStoryNavigatorComponent, CarouselComponent_1, SlideComponent, NgStyle, TooltipDirective, DisplayDatePipe, YoutubeEmbed]
})
export class CarouselComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("CarouselComponent", NgxLoggerLevel.ERROR);
  pageService = inject(PageService);
  private memberLoginService = inject(MemberLoginService);
  private lazyLoadingMetadataService = inject(LazyLoadingMetadataService);
  private imageDuplicatesService = inject(ImageDuplicatesService);
  contentMetadataService = inject(ContentMetadataService);
  urlService = inject(UrlService);
  public showIndicators = false;
  private subscriptions: Subscription[] = [];
  public faPencil = faPencil;
  public album: AlbumData;
  public preview = false;
  public FALLBACK_MEDIA = FALLBACK_MEDIA;

  @Input("preview") set previewValue(value: boolean) {
    this.preview = coerceBooleanProperty(value);
    this.logger.info("preview:", this.preview);
  }

  @Input("album") set acceptChangesFrom(albumData: AlbumData) {
    this.carouselDataInput(albumData);
  }

  @Input()
  public duplicateImages: DuplicateImages;

  @Input()
  public lazyLoadingMetadata: LazyLoadingMetadata;

  @Input()
  public index: number;

  @Input()
  public hideStoryNavigator: boolean;

  @ViewChild("carouselRef") carouselRef: CarouselComponent_1;

  public noPause = true;
  public videoIsPlaying = false;
  DEFAULT_HEIGHT = 400;

  @HostListener("window:resize", ["$event"])
  onResize(event) {
    this.configureShowIndicators(event?.target?.innerWidth);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:querying metadata service with root folder", RootFolder.carousels, "album name:", this.album?.name, "lazyLoadingMetadata:", this.lazyLoadingMetadata);
    if (this.lazyLoadingMetadata) {
      this.logger.info("externally initialised with", this?.lazyLoadingMetadata?.contentMetadata?.files?.length, "slides in total", "lazyLoadingMetadata:", this.lazyLoadingMetadata, "duplicateImages:", this.duplicateImages);
    } else {
      this.contentMetadataService.items(RootFolder.carousels, this.album?.name)
        .then(contentMetadata => {
          setTimeout(() => {
            this.duplicateImages = this.imageDuplicatesService.populateFrom(contentMetadata);
            this.lazyLoadingMetadata = this.lazyLoadingMetadataService.initialise(contentMetadata);
            this.lazyLoadingMetadataService.initialiseAvailableSlides(this.lazyLoadingMetadata, SlideInitialisation.COMPONENT_INIT, this.duplicateImages, ALL_PHOTOS);
            this.logger.info("internally initialised with", this?.lazyLoadingMetadata?.contentMetadata?.files?.length, "slides in total", "lazyLoadingMetadata:", this.lazyLoadingMetadata, "duplicateImages:", this.duplicateImages);
          });
        });
    }
  }

  private carouselDataInput(album: AlbumData) {
    this.logger.info("carouselDataInput:", album);
    this.album = album;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }


  eventTooltip(dateSource: string) {
    return "Show details of this " + (groupEventTypeFor(dateSource)?.description || dateSource).toLowerCase();
  }

  activeSlideChange(force: boolean, $event: number) {
    this.logger.debug("activeSlideChange:force", force, "$event:", $event, "activeSlideIndex:", this.lazyLoadingMetadata?.activeSlideIndex || 0);
    if (this.videoIsPlaying) {
      this.videoIsPlaying = false;
      this.carouselRef?.play();
      this.logger.info("Carousel resumed after slide change");
    }
    this.lazyLoadingMetadataService.add(this.lazyLoadingMetadata, 1, "active slide change");
    this.configureShowIndicators(window.innerWidth);
  }

  private configureShowIndicators(width: number) {
    this.logger.debug("configureShowIndicators:window.innerWidth", window.innerWidth, "provided width:", width, "setting:");
    this.showIndicators = width > 768 && this.lazyLoadingMetadata?.selectedSlides?.length <= 20;
  }

  allowEdits() {
    return this.memberLoginService.allowContentEdits();
  }

  imageSourceFor(item: ContentMetadataItem): string {
    return this.urlService.imageSource(this.urlService.qualifiedFileNameWithRoot(this.lazyLoadingMetadata?.contentMetadata?.rootFolder, this.lazyLoadingMetadata?.contentMetadata?.name, item));
  }

  hasYoutubeVideo(item: ContentMetadataItem): boolean {
    return !!item?.youtubeId;
  }

  tagChanged(imageTag: ImageTag) {
    this.lazyLoadingMetadataService.initialiseAvailableSlides(this.lazyLoadingMetadata, SlideInitialisation.TAG_CHANGE, this.duplicateImages, imageTag);
  }

  mouseEnter($event: MouseEvent) {
    this.noPause = false;
    this.logger.info("mouseEnter:", $event, "noPause:", this.noPause);
  }

  mouseLeave($event: MouseEvent) {
    this.noPause = true;
    this.logger.info("mouseLeave:", $event, "noPause:", this.noPause);
  }

  onVideoPlaybackChange(isPlaying: boolean) {
    this.videoIsPlaying = isPlaying;
    this.noPause = !isPlaying;
    this.logger.info("Video playback changed. isPlaying:", isPlaying, "videoIsPlaying:", this.videoIsPlaying, "noPause:", this.noPause);
    if (isPlaying) {
      this.carouselRef?.pause();
      this.logger.info("Carousel paused due to video playback");
    } else {
      this.carouselRef?.play();
      this.logger.info("Carousel resumed after video stopped");
    }
  }

  onImageLoad($event: Event) {
    this.logger.info("Image loaded:", $event);
  }

  onImageError($event: ErrorEvent) {
    this.logger.error("Image failed to load:", $event);
  }

}
