import { Component, HostListener, inject, Input, OnDestroy, OnInit } from "@angular/core";
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
import { CarouselStoryNavigatorComponent } from "./carousel-story-navigator/carousel-story-navigator.component";
import { CarouselComponent as CarouselComponent_1, SlideComponent } from "ngx-bootstrap/carousel";
import { NgStyle } from "@angular/common";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { DisplayDatePipe } from "../../pipes/display-date.pipe";

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
            <carousel (mouseenter)="mouseEnter($event)" (mouseleave)="mouseLeave($event)" [isAnimated]="true"
                      [noPause]="noPause" [pauseOnFocus]="noPause"
                      [interval]="album.slideInterval || 5000"
                      [showIndicators]="album.showIndicators && showIndicators"
                      [(activeSlide)]="lazyLoadingMetadata.activeSlideIndex"
                      (activeSlideChange)="activeSlideChange(false, $event)">
              @for (slide of lazyLoadingMetadata?.selectedSlides; track slide.image || slide.base64Content) {
                <slide>
                  @if (slide) {
                    <img loading="lazy" [src]="imageSourceFor(slide)"
                         [alt]="slide.text" [ngStyle]="{
                 'height.px': album.height,
                  'min-width': '100%',
                   'max-width': '100%',
                   'object-fit': 'cover',
                   'object-position': 'center'}">
                  }
                  <div class="carousel-caption">
                    <h4>{{ slide.text || album.subtitle }}</h4>
                    @if (slide.eventId || album.eventId) {
                      <div>
                        <a delay="500" class="badge event-date"
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
          }
        </div>
      </div>
    </div>`,
  styleUrls: ["./carousel.sass"],
  imports: [CarouselStoryNavigatorComponent, CarouselComponent_1, SlideComponent, NgStyle, TooltipDirective, DisplayDatePipe]
})
export class CarouselComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("CarouselComponent", NgxLoggerLevel.ERROR);
  pageService = inject(PageService);
  private memberLoginService = inject(MemberLoginService);
  private lazyLoadingMetadataService = inject(LazyLoadingMetadataService);
  private imageDuplicatesService = inject(ImageDuplicatesService);
  contentMetadataService = inject(ContentMetadataService);
  urlService = inject(UrlService);
  public showIndicators: boolean;
  private subscriptions: Subscription[] = [];
  public faPencil = faPencil;
  public album: AlbumData;
  public preview: boolean;

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
  public noPause = true;

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
          this.duplicateImages = this.imageDuplicatesService.populateFrom(contentMetadata);
          this.lazyLoadingMetadata = this.lazyLoadingMetadataService.initialise(contentMetadata);
          this.lazyLoadingMetadataService.initialiseAvailableSlides(this.lazyLoadingMetadata, SlideInitialisation.COMPONENT_INIT, this.duplicateImages, ALL_PHOTOS);
          this.logger.info("internally initialised with", this?.lazyLoadingMetadata?.contentMetadata?.files?.length, "slides in total", "lazyLoadingMetadata:", this.lazyLoadingMetadata, "duplicateImages:", this.duplicateImages);
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

}
